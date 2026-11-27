// Datos fijos del sitio. Lo legal (responsable, contacto) sale de aquí para que sea uno solo en toda la web.
//
// En este repositorio público los datos del responsable y del contacto son de EJEMPLO: los reales solo viven en
// el repositorio privado que despliega https://musicmafia.pages.dev.
export const SITIO = {
  nombre: 'MusicMafia',
  dominio: 'musicmafia.pages.dev',
  url: 'https://musicmafia.pages.dev',
  descripcion: 'Un círculo cerrado de productores. Se entra solo por invitación.',
  responsable: {
    nombre: 'Nombre del responsable',
    cedula: '0000000000',
    nit: '0000000000-0',
    direccion: 'Dirección del responsable, Bogotá, Colombia',
  },
  contacto: {
    telefono: '+57 000 000 0000',
    telefonoHref: 'tel:+570000000000',
    correo: 'contacto@example.com',
    ciudad: 'Bogotá, Colombia',
  },
  // Proyecto de Supabase (Settings > API). Vacías = la web usa los datos de ejemplo y el panel funciona en ensayo,
  // todo dentro del navegador. Para conectar un proyecto propio se usan PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_CLAVE
  // en un archivo .env (ver .env.example).
  supabase: {
    url: '',
    clave: '',
  },
  // Audios, portadas y fotos: en producción, Cloudflare R2 servido por la propia web.
  medios: '/medios',
  analitica: {
    // Token de Cloudflare Web Analytics. Vacío = no se mide nada.
    // Solo se carga si el visitante la permite en el aviso de cookies.
    cloudflareToken: '',
  },
} as const;

/**
 * Enlace que abre Gmail en la ventana de redactar, con el destinatario (y el asunto) ya puestos.
 * Se usa en lugar de mailto:, que en un computador sin programa de correo no abre nada útil.
 * Va siempre con target="_blank" rel="noopener noreferrer".
 */
export const gmail = (para: string, asunto = '') =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(para)}${asunto ? `&su=${encodeURIComponent(asunto)}` : ''}`;

// Rutas que no puede usar un productor como su enlace (musicmafia.pages.dev/<enlace>).
// La base de datos de producción tiene la misma lista.
export const ENLACES_RESERVADOS = new Set([
  'productores', 'ingresar', 'entrar', 'login', 'panel', 'admin', 'administracion', 'cuenta',
  'privacidad', 'terminos', 'cookies', 'tratamiento-de-datos', 'legal', 'contacto',
  'api', 'demo', 'dev', 'assets', '_astro', 'favicon', 'robots', 'sitemap', 'musicmafia',
  'medios', 'bienvenida', 'restablecer', 'salir', 'beats', 'generos', 'buscar', 'ayuda', 'soporte',
  'nosotros', 'blog', 'www', 'static', 'functions', 'cdn', '404', 'portada',
]);
