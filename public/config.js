// Datos editables de la landing. Cambiá acá el número y las opciones sin tocar el resto.
window.ACERO = {
  // Número del dueño en formato internacional, sin "+", espacios ni guiones.
  // Ejemplo Argentina: 54 9 + característica + número → 5491122334455
  whatsapp: "5491100000000",

  instagram: "aceroeventos",

  lugares: [
    {
      id: "acero",
      nombre: "Salón Acero",
      detalle: "Nuestro salón propio. Pista amplia, pantalla LED y barra.",
      capacidad: "Hasta 400 invitados",
    },
    {
      id: "larural",
      nombre: "La Rural",
      detalle: "Para las fiestas grandes. Pabellones con producción completa.",
      capacidad: "Desde 300 invitados",
    },
  ],

  menus: [
    { id: "clasico", nombre: "Clásico", detalle: "Recepción, plato principal y postre" },
    { id: "coctel", nombre: "Cóctel", detalle: "Finger food y estaciones toda la noche" },
    { id: "asado", nombre: "Asado", detalle: "Parrilla libre con entradas y ensaladas" },
    { id: "teen", nombre: "Teen", detalle: "Pizzas, hamburguesas y papas" },
  ],

  extras: [
    "Mesa dulce",
    "Fin de fiesta",
    "Barra de tragos sin alcohol",
    "Cabina de fotos",
    "Carioca / cotillón",
  ],

  // Fotos fijas de las secciones. Poné los archivos en public/img/ y escribí la ruta,
  // por ejemplo xv: "img/xv.jpg". Vacío = se usa el fondo de color del diseño.
  // hero vacío = se usa la última foto subida desde el panel.
  fotos: { hero: "", xv: "", egresos: "", acero: "", larural: "" },

  personas: { min: 50, max: 800, paso: 10, inicial: 150 },
};
