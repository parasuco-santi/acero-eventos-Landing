(() => {
  const C = window.ACERO;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const waLink = (text) => `https://wa.me/${C.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

  // ---------- nav ----------
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  $("#year").textContent = new Date().getFullYear();
  $("#wa-float").href = waLink("Hola! Quiero info sobre una fiesta con Acero Eventos.");
  $("#ig-link").href = `https://instagram.com/${C.instagram}`;

  // ---------- reveal ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  const observe = (root = document) => root.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));

  // ---------- lugares ----------
  $("#venues").innerHTML = C.lugares.map((l) => `
    <article class="venue reveal" data-id="${esc(l.id)}" data-foto="${esc(l.id)}">
      <span class="venue-cap">${esc(l.capacidad)}</span>
      <h3>${esc(l.nombre)}</h3>
      <p>${esc(l.detalle)}</p>
      <a class="btn btn-ghost" href="#cotizar" data-pick-lugar="${esc(l.id)}">Cotizar en ${esc(l.nombre)}</a>
    </article>`).join("");

  // Fotos fijas opcionales (config.js → fotos)
  document.querySelectorAll("[data-foto]").forEach((el) => {
    const src = (C.fotos || {})[el.dataset.foto];
    if (src) el.style.setProperty("--img", `url('${src}')`);
  });

  // ---------- cotizador ----------
  const form = $("#quote");
  const range = $("#people");
  const out = $("#people-out");
  const P = C.personas;
  Object.assign(range, { min: P.min, max: P.max, step: P.paso, value: P.inicial });

  $("#lugar-options").innerHTML = C.lugares.map((l, i) => `
    <label class="card"><input type="radio" name="lugar" value="${esc(l.id)}" ${i === 0 ? "checked" : ""}>
      <span><strong>${esc(l.nombre)}</strong><small>${esc(l.capacidad)}</small></span></label>`).join("");
  $("#menu-options").innerHTML = C.menus.map((m, i) => `
    <label class="card"><input type="radio" name="menu" value="${esc(m.id)}" ${i === 0 ? "checked" : ""}>
      <span><strong>${esc(m.nombre)}</strong><small>${esc(m.detalle)}</small></span></label>`).join("");
  $("#extra-options").innerHTML = C.extras.map((x) => `
    <label class="extra"><input type="checkbox" name="extras" value="${esc(x)}"><span>${esc(x)}</span></label>`).join("");

  const ticketNo = String(Math.floor(1000 + Math.random() * 9000));
  $("#ticket-no").textContent = `#${ticketNo}`;

  const read = () => {
    const fd = new FormData(form);
    const lugar = C.lugares.find((l) => l.id === fd.get("lugar"));
    const menu = C.menus.find((m) => m.id === fd.get("menu"));
    const fecha = fd.get("fecha");
    return {
      tipo: fd.get("tipo"),
      personas: Number(fd.get("personas")),
      lugar: lugar ? lugar.nombre : "",
      menu: menu ? `${menu.nombre} (${menu.detalle})` : "",
      menuCorto: menu ? menu.nombre : "",
      extras: fd.getAll("extras"),
      nombre: String(fd.get("nombre") || "").trim(),
      fecha: fecha ? new Date(fecha + "T12:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "",
    };
  };

  const render = () => {
    const d = read();
    out.textContent = d.personas;
    const rows = [
      ["Fiesta", d.tipo],
      ["Personas", d.personas],
      ["Lugar", d.lugar],
      ["Comida", d.menuCorto],
      ["Extras", d.extras.length ? d.extras.join(", ") : "—"],
      ["Fecha", d.fecha || "A definir"],
    ];
    if (d.nombre) rows.unshift(["Nombre", d.nombre]);
    $("#ticket-list").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
  };

  const message = () => {
    const d = read();
    const lines = [
      `Hola! ${d.nombre ? `Soy ${d.nombre}. ` : ""}Quiero pedir presupuesto para una fiesta con Acero Eventos:`,
      "",
      `🎉 Tipo: ${d.tipo}`,
      `👥 Personas: ${d.personas}`,
      `📍 Lugar: ${d.lugar}`,
      `🍽️ Comida: ${d.menu}`,
    ];
    if (d.extras.length) lines.push(`✨ Extras: ${d.extras.join(", ")}`);
    lines.push(`📅 Fecha: ${d.fecha || "a definir"}`);
    lines.push("", `(Pedido #${ticketNo} desde la web)`);
    return lines.join("\n");
  };

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
    const v = Number(range.value) + Number(b.dataset.step) * P.paso;
    range.value = Math.min(P.max, Math.max(P.min, v));
    render();
  }));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    window.open(waLink(message()), "_blank", "noopener");
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-pick-lugar]");
    if (!a) return;
    const input = form.querySelector(`input[name="lugar"][value="${a.dataset.pickLugar}"]`);
    if (input) { input.checked = true; render(); }
  });
  render();

  // ---------- galería ----------
  const gallery = $("#gallery");
  const moreBtn = $("#gallery-more");
  const PAGE = 12;
  let items = [];
  let shown = 0;

  const mediaUrl = (it) => `/api/media/file/${encodeURIComponent(it.id)}`;
  const isVideo = (it) => it.type.startsWith("video/");

  const tile = (it, i) => {
    const cap = it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : "";
    const ratio = it.w && it.h ? `style="aspect-ratio:${it.w}/${it.h}"` : "";
    const media = isVideo(it)
      ? `<video src="${mediaUrl(it)}#t=0.1" muted playsinline loop preload="metadata" ${ratio}></video><span class="g-play">▶ Video</span>`
      : `<img src="${mediaUrl(it)}" alt="${esc(it.caption || "Foto de una fiesta de Acero Eventos")}" loading="lazy" ${ratio}>`;
    return `<figure class="g-item reveal" data-i="${i}" tabindex="0" role="button" aria-label="Ampliar ${isVideo(it) ? "video" : "foto"}">${media}${cap}</figure>`;
  };

  const showMore = () => {
    const next = items.slice(shown, shown + PAGE);
    gallery.insertAdjacentHTML("beforeend", next.map((it, k) => tile(it, shown + k)).join(""));
    shown += next.length;
    moreBtn.hidden = shown >= items.length;
    observe(gallery);
    gallery.querySelectorAll("video:not([data-hover])").forEach((v) => {
      v.dataset.hover = "1";
      v.addEventListener("mouseenter", () => v.play().catch(() => {}));
      v.addEventListener("mouseleave", () => v.pause());
    });
  };

  const loadGallery = async () => {
    gallery.innerHTML = [260, 340, 200, 300, 240, 320].map((h) => `<div class="g-skel" style="height:${h}px"></div>`).join("");
    try {
      const res = await fetch("/api/media", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      items = (await res.json()).items || [];
    } catch {
      items = [];
    }
    gallery.innerHTML = "";
    shown = 0;
    heroFromGallery();
    if (!items.length) {
      gallery.innerHTML = `<div class="g-empty"><strong>Muy pronto, fotos de nuestras fiestas.</strong>Mientras tanto, pedinos el book completo por WhatsApp.</div>`;
      moreBtn.hidden = true;
      return;
    }
    showMore();
  };
  moreBtn.addEventListener("click", showMore);

  // Fondo del hero con la última foto subida
  const heroFromGallery = () => {
    if ($(".hero-media")) return;
    const img = items.find((it) => !isVideo(it));
    const src = (C.fotos || {}).hero || (img && mediaUrl(img));
    if (!src) return;
    const div = document.createElement("div");
    div.className = "hero-media";
    div.setAttribute("aria-hidden", "true");
    div.style.backgroundImage = `url('${src}')`;
    $(".hero").prepend(div);
  };

  // ---------- lightbox ----------
  const lb = $("#lightbox");
  const stage = $("#lb-stage");
  let cur = 0;
  const openLb = (i) => {
    cur = (i + items.length) % items.length;
    const it = items[cur];
    stage.innerHTML = isVideo(it)
      ? `<video src="${mediaUrl(it)}" controls autoplay playsinline></video>`
      : `<img src="${mediaUrl(it)}" alt="${esc(it.caption || "Foto de una fiesta")}">`;
    $("#lb-caption").textContent = it.caption || "";
    if (!lb.open) lb.showModal();
  };
  gallery.addEventListener("click", (e) => { const f = e.target.closest(".g-item"); if (f) openLb(Number(f.dataset.i)); });
  gallery.addEventListener("keydown", (e) => {
    const f = e.target.closest(".g-item");
    if (f && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLb(Number(f.dataset.i)); }
  });
  $("#lb-prev").addEventListener("click", () => openLb(cur - 1));
  $("#lb-next").addEventListener("click", () => openLb(cur + 1));
  $("#lb-close").addEventListener("click", () => lb.close());
  lb.addEventListener("close", () => { stage.innerHTML = ""; });
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target === stage) lb.close(); });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") openLb(cur - 1);
    if (e.key === "ArrowRight") openLb(cur + 1);
  });

  observe();
  loadGallery();
})();
