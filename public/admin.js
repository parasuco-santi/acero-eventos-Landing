(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let pin = "";
  try { pin = sessionStorage.getItem("acero-pin") || ""; } catch {}

  const api = async (path, opts = {}) => {
    const res = await fetch(`/api/media${path}`, { ...opts, headers: { "x-pin": pin, ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
    return data;
  };

  // ---------- login ----------
  const show = (logged) => {
    $("#login-view").hidden = logged;
    $("#app-view").hidden = !logged;
    $("#logout").hidden = !logged;
    if (logged) loadList();
  };
  const tryLogin = async () => {
    try { await api("/login", { method: "POST" }); show(true); return true; }
    catch (e) { return e; }
  };
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    pin = $("#pin").value.trim();
    const r = await tryLogin();
    if (r === true) { try { sessionStorage.setItem("acero-pin", pin); } catch {} $("#login-err").textContent = ""; }
    else $("#login-err").textContent = r.status === 401 ? "PIN incorrecto." : "No se pudo conectar. Probá de nuevo.";
  });
  $("#logout").addEventListener("click", () => {
    pin = ""; try { sessionStorage.removeItem("acero-pin"); } catch {}
    show(false);
  });

  // ---------- listado ----------
  let items = [];
  const fileUrl = (it) => `/api/media/file/${encodeURIComponent(it.id)}`;
  const renderList = () => {
    $("#count").textContent = items.length === 1 ? "1 archivo" : `${items.length} archivos`;
    if (!items.length) { $("#grid").innerHTML = `<p class="muted">Todavía no subiste nada.</p>`; return; }
    $("#grid").innerHTML = items.map((it, i) => `
      <div class="tile" data-id="${esc(it.id)}">
        <div class="thumb">${it.type.startsWith("video/")
          ? `<video src="${fileUrl(it)}#t=0.1" muted playsinline preload="metadata"></video>`
          : `<img src="${fileUrl(it)}" alt="" loading="lazy">`}</div>
        <div class="meta">
          <input type="text" value="${esc(it.caption || "")}" maxlength="140" placeholder="Sin texto" aria-label="Texto">
          <div class="actions">
            <button class="mini" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="Mover antes">←</button>
            <button class="mini" data-act="down" ${i === items.length - 1 ? "disabled" : ""} aria-label="Mover después">→</button>
            <button class="mini del" data-act="del">Borrar</button>
          </div>
        </div>
      </div>`).join("");
  };
  const loadList = async () => {
    const res = await fetch("/api/media", { cache: "no-store" });
    items = (await res.json()).items || [];
    renderList();
  };

  $("#grid").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.closest(".tile").dataset.id;
    b.disabled = true;
    try {
      if (b.dataset.act === "del") {
        if (!confirm("¿Borrar este archivo de la web? No se puede deshacer.")) { b.disabled = false; return; }
        await api(`/${id}`, { method: "DELETE" });
        items = items.filter((x) => x.id !== id);
      } else {
        items = (await api(`/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ move: b.dataset.act }) })).items;
      }
      renderList();
    } catch (err) { alert(err.message); b.disabled = false; }
  });
  $("#grid").addEventListener("change", async (e) => {
    if (e.target.tagName !== "INPUT") return;
    const id = e.target.closest(".tile").dataset.id;
    try {
      items = (await api(`/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ caption: e.target.value }) })).items;
      e.target.style.borderColor = "#2f6b45";
    } catch (err) { alert(err.message); }
  });

  // ---------- subida ----------
  // Reduce las fotos a 2000 px para que carguen rápido en el celular.
  const compressImage = async (file) => {
    if (file.type === "image/gif") return { blob: file, w: 0, h: 0 };
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return { blob: file, w: 0, h: 0 };
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return { blob: blob && blob.size < file.size ? blob : file, w, h };
  };
  const videoSize = (file) => new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve({ w: v.videoWidth, h: v.videoHeight }); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve({ w: 0, h: 0 });
    v.src = URL.createObjectURL(file);
  });

  const upload = async (file, caption) => {
    const row = document.createElement("div");
    row.className = "q";
    row.innerHTML = `<span>${esc(file.name)}</span><span class="st">Preparando…</span><progress max="1" value="0"></progress>`;
    $("#queue").prepend(row);
    const st = row.querySelector(".st");
    const bar = row.querySelector("progress");
    try {
      let blob = file, w = 0, h = 0;
      if (file.type.startsWith("image/")) ({ blob, w, h } = await compressImage(file));
      else ({ w, h } = await videoSize(file));
      const type = blob.type || file.type;
      const init = await api("/init", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, size: blob.size, caption, w, h }),
      });
      for (let n = 0; n < init.chunks; n++) {
        const part = blob.slice(n * init.chunkSize, (n + 1) * init.chunkSize);
        for (let attempt = 0; ; attempt++) {
          try { await api(`/chunk/${init.id}/${n}`, { method: "PUT", body: part }); break; }
          catch (e) { if (attempt >= 2 || e.status === 401) throw e; }
        }
        bar.value = (n + 1) / init.chunks;
        st.textContent = `${Math.round(((n + 1) / init.chunks) * 100)}%`;
      }
      const { item } = await api(`/finish/${init.id}`, { method: "POST" });
      items = [item, ...items];
      renderList();
      row.classList.add("ok");
      st.textContent = "Publicado";
    } catch (e) {
      row.classList.add("bad");
      st.textContent = e.message;
    }
  };

  const handle = async (files) => {
    const caption = $("#caption").value.trim();
    for (const f of files) await upload(f, caption);
    $("#file").value = "";
  };
  $("#file").addEventListener("change", (e) => handle([...e.target.files]));
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => handle([...e.dataTransfer.files]));

  if (pin) tryLogin().then((r) => { if (r !== true) show(false); });
})();
