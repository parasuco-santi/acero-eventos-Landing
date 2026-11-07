# Acero Eventos · Landing

Landing de Acero Eventos (fiestas de XV y egresos) con cotizador por WhatsApp y galería que el dueño administra.

## Estructura

- `public/index.html`, `styles.css`, `app.js`: la landing.
- `public/config.js`: **lo único que hace falta tocar** para cambiar el número de WhatsApp, Instagram, lugares, menús, extras, rango de personas y fotos fijas.
- `public/admin.html` (`/admin`): panel con PIN para subir, ordenar, poner texto y borrar fotos y videos.
- `netlify/functions/media.mjs`: API de la galería. Guarda los archivos en Netlify Blobs (incluido en el plan gratis).

## Publicar en Netlify

1. Netlify → Add new site → Import from GitHub → este repo. No hace falta comando de build (`netlify.toml` ya indica la carpeta `public`).
2. Site configuration → Environment variables → agregar `ADMIN_PIN` con el PIN del dueño (usá uno largo, no `1234`).
3. Redeploy. El panel queda en `https://TU-SITIO.netlify.app/admin`.

## Fotos fijas

Las tarjetas de XV, Egresos y los lugares usan un fondo de color mientras no haya fotos. Para poner fotos reales, copialas a `public/img/` y completá `fotos` en `config.js` (por ejemplo `xv: "img/xv.jpg"`). El fondo del inicio usa la última foto subida desde el panel si `hero` queda vacío.

## Límites de la galería

- Las fotos se reducen a 2000 px en el navegador antes de subir.
- Videos MP4, MOV o WEBM de hasta 120 MB. Se suben y se sirven en pedazos de 3 MB, por el límite de tamaño de las funciones de Netlify.
