import { getStore } from "@netlify/blobs";
import { timingSafeEqual, randomUUID } from "node:crypto";

// Los archivos se guardan en pedazos de CHUNK bytes porque una función de Netlify
// no acepta ni devuelve cuerpos de más de ~6 MB. Los videos se sirven por rangos.
const CHUNK = 3 * 1024 * 1024;
const MAX_BYTES = 120 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;
const INDEX = "index";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const authed = (req) => {
  const pin = process.env.ADMIN_PIN;
  const got = req.headers.get("x-pin") || "";
  if (!pin) return false;
  const a = Buffer.from(pin);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
};

const store = () => getStore({ name: "acero-media", consistency: "strong" });

async function readIndex(s) {
  const entry = await s.getWithMetadata(INDEX, { type: "json" });
  return entry ? { items: entry.data.items || [], etag: entry.etag } : { items: [], etag: null };
}

// Modifica el índice con reintentos por si dos subidas terminan al mismo tiempo.
async function updateIndex(s, fn) {
  for (let i = 0; i < 5; i++) {
    const { items, etag } = await readIndex(s);
    const next = fn(items);
    const res = await s.setJSON(INDEX, { items: next }, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (res.modified) return next;
  }
  throw new Error("No se pudo actualizar el índice");
}

async function serveFile(req, s, id) {
  const meta = await s.get(`meta/${id}`, { type: "json" });
  if (!meta || !meta.done) return new Response("No encontrado", { status: 404 });

  const total = meta.size;
  const base = {
    "content-type": meta.type,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range");
  let start = 0;
  let end = total - 1;
  let partial = false;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (!m) return new Response(null, { status: 416, headers: { "content-range": `bytes */${total}` } });
    if (m[1] === "") { start = Math.max(0, total - Number(m[2])); }
    else { start = Number(m[1]); if (m[2] !== "") end = Math.min(Number(m[2]), total - 1); }
    if (start >= total || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${total}` } });
    partial = true;
  }

  // Nunca devolvemos más de un pedazo por respuesta: el navegador pide el resto.
  const n = Math.floor(start / CHUNK);
  const chunkEnd = Math.min((n + 1) * CHUNK, total) - 1;
  if (end > chunkEnd) { end = chunkEnd; partial = true; }

  const buf = await s.get(`file/${id}/${n}`, { type: "arrayBuffer" });
  if (!buf) return new Response("No encontrado", { status: 404 });
  const slice = buf.slice(start - n * CHUNK, end - n * CHUNK + 1);

  if (!partial) return new Response(slice, { status: 200, headers: { ...base, "content-length": String(total) } });
  return new Response(slice, {
    status: 206,
    headers: { ...base, "content-range": `bytes ${start}-${end}/${total}`, "content-length": String(slice.byteLength) },
  });
}

async function removeFile(s, id) {
  const { blobs } = await s.list({ prefix: `file/${id}/` });
  await Promise.all(blobs.map((b) => s.delete(b.key)));
  await s.delete(`meta/${id}`);
}

export default async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/media\/?/, "").split("/").filter(Boolean);
  const s = store();

  // Público: listado y archivos
  if (req.method === "GET" && parts.length === 0) {
    const { items } = await readIndex(s);
    return json({ items });
  }
  if (req.method === "GET" && parts[0] === "file" && parts[1]) return serveFile(req, s, parts[1]);

  // Todo lo demás requiere el PIN del dueño
  if (!authed(req)) return json({ error: "PIN incorrecto" }, 401);

  if (req.method === "POST" && parts[0] === "login") return json({ ok: true });

  if (req.method === "POST" && parts[0] === "init") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
    const { type, size, caption = "", w = 0, h = 0 } = body || {};
    if (!ALLOWED.test(type || "")) return json({ error: "Formato no permitido. Usá JPG, PNG, WEBP, MP4 o MOV." }, 400);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return json({ error: `El archivo supera ${MAX_BYTES / 1048576} MB` }, 400);
    const id = randomUUID();
    const meta = {
      id, type, size,
      chunks: Math.ceil(size / CHUNK),
      caption: String(caption).slice(0, 140),
      w: Number(w) || 0, h: Number(h) || 0,
      createdAt: new Date().toISOString(),
      done: false,
    };
    await s.setJSON(`meta/${id}`, meta);
    return json({ id, chunkSize: CHUNK, chunks: meta.chunks });
  }

  if (req.method === "PUT" && parts[0] === "chunk" && parts[1] && parts[2] !== undefined) {
    const id = parts[1];
    const n = Number(parts[2]);
    const meta = await s.get(`meta/${id}`, { type: "json" });
    if (!meta || meta.done) return json({ error: "Subida inexistente" }, 404);
    if (!Number.isInteger(n) || n < 0 || n >= meta.chunks) return json({ error: "Pedazo inválido" }, 400);
    const buf = await req.arrayBuffer();
    const expected = n === meta.chunks - 1 ? meta.size - n * CHUNK : CHUNK;
    if (buf.byteLength !== expected) return json({ error: "Tamaño de pedazo incorrecto" }, 400);
    await s.set(`file/${id}/${n}`, buf);
    return json({ ok: true });
  }

  if (req.method === "POST" && parts[0] === "finish" && parts[1]) {
    const id = parts[1];
    const meta = await s.get(`meta/${id}`, { type: "json" });
    if (!meta) return json({ error: "Subida inexistente" }, 404);
    const { blobs } = await s.list({ prefix: `file/${id}/` });
    if (blobs.length !== meta.chunks) return json({ error: "Faltan pedazos del archivo, probá de nuevo" }, 400);
    meta.done = true;
    await s.setJSON(`meta/${id}`, meta);
    const { done, chunks, ...item } = meta;
    await updateIndex(s, (items) => [item, ...items.filter((x) => x.id !== id)]);
    return json({ ok: true, item });
  }

  if (req.method === "PATCH" && parts[0] && parts.length === 1) {
    const id = parts[0];
    let body;
    try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
    const items = await updateIndex(s, (items) => {
      const i = items.findIndex((x) => x.id === id);
      if (i === -1) return items;
      const copy = [...items];
      const it = { ...copy[i] };
      if (typeof body.caption === "string") it.caption = body.caption.slice(0, 140);
      copy.splice(i, 1);
      const to = body.move === "up" ? Math.max(0, i - 1) : body.move === "down" ? Math.min(copy.length, i + 1) : i;
      copy.splice(to, 0, it);
      return copy;
    });
    return json({ items });
  }

  if (req.method === "DELETE" && parts[0] && parts.length === 1) {
    const id = parts[0];
    await updateIndex(s, (items) => items.filter((x) => x.id !== id));
    await removeFile(s, id);
    return json({ ok: true });
  }

  return json({ error: "Ruta no encontrada" }, 404);
};

export const config = { path: ["/api/media", "/api/media/*"] };
