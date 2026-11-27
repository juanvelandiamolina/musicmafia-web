// Fuente única de lo legal: las cuatro páginas, el banner de cookies y (más adelante) el panel de productores
// leen de aquí, así un plazo o un proveedor nunca dice una cosa en un sitio y otra en otro.
// Al cambiar algo de fondo: subir LEGAL.version y la fecha. El panel pedirá aceptar de nuevo a los productores.
import { SITIO } from './sitio';

export const LEGAL = {
  version: '1.0',
  /** Fecha de entrada en vigencia (AAAA-MM-DD). Actualizar el día que la web se abra al público. */
  vigenteDesde: '2026-11-13',
  edadMinima: 18,
  /** Días calendario para borrar definitivamente los datos de una cuenta cerrada. */
  diasBorrado: 30,
  /** Años que se guarda la constancia de autorización tras cerrar la cuenta. */
  aniosConstancia: 3,
  /** Días de anticipación para avisar cambios importantes o un cierre por decisión editorial. */
  diasAviso: 15,
} as const;

export const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(
    new Date(`${iso}T12:00:00-05:00`),
  );

export const RESPONSABLE_TEXTO = `${SITIO.responsable.nombre}, persona natural identificada con cédula de ciudadanía ${SITIO.responsable.cedula} y NIT ${SITIO.responsable.nit}`;

export interface FilaDatos {
  quien: string;
  datos: string;
  para: string;
  cuanto: string;
}

/** Qué datos se tratan, para qué y cuánto tiempo se conservan. */
export const DATOS: FilaDatos[] = [
  {
    quien: 'Productores',
    datos: 'Correo de acceso y contraseña. La contraseña se guarda cifrada y nadie, ni siquiera MusicMafia, puede verla.',
    para: 'Crear la cuenta y permitir la entrada al panel.',
    cuanto: `Mientras la cuenta esté abierta. Al cerrarla se borran en un máximo de ${LEGAL.diasBorrado} días.`,
  },
  {
    quien: 'Productores',
    datos: 'Perfil público: nombre artístico, ciudad, presentación, foto (opcional), géneros, usuario de Instagram, correo de contacto y, si los da, sus enlaces de YouTube y Spotify.',
    para: 'Mostrar el perfil en la web y darlo a conocer en los canales de MusicMafia.',
    cuanto: `Mientras la cuenta esté abierta. Al cerrarla deja de verse en pocos minutos y se borra en un máximo de ${LEGAL.diasBorrado} días.`,
  },
  {
    quien: 'Productores',
    datos: 'Beats: archivos de audio, títulos, portadas y género.',
    para: 'Que se puedan escuchar en el perfil.',
    cuanto: `Hasta que el productor los quite o cierre la cuenta. Se borran en un máximo de ${LEGAL.diasBorrado} días.`,
  },
  {
    quien: 'Productores',
    datos: 'Constancia de aceptación: fecha y hora, versión de los documentos aceptados, correo de la cuenta y dirección IP.',
    para: 'Demostrar que el productor dio su autorización, como exige la ley.',
    cuanto: `${LEGAL.aniosConstancia} años después de cerrar la cuenta.`,
  },
  {
    quien: 'Productores',
    datos: 'Permiso para recibir novedades (solo si lo dio).',
    para: 'Enviar por correo novedades, convocatorias y oportunidades de MusicMafia.',
    cuanto: 'Hasta que lo retire. Desde ese momento no se usa más.',
  },
  {
    quien: 'Quien escribe a MusicMafia',
    datos: 'Correo, nombre y contenido del mensaje.',
    para: 'Responder.',
    cuanto: '2 años desde el último mensaje, o más si hace falta para atender un reclamo en curso.',
  },
  {
    quien: 'Quien ejerce sus derechos',
    datos: 'Consultas, reclamos y la respuesta que se les dio.',
    para: 'Atenderlos y poder demostrar que se atendieron.',
    cuanto: '3 años desde la respuesta.',
  },
  {
    quien: 'Visitantes',
    datos: 'Dirección IP y datos técnicos del navegador que reciben los proveedores al entregar la página.',
    para: 'Mostrar la web y protegerla de ataques.',
    cuanto: 'Los plazos cortos que define cada proveedor. MusicMafia no los usa para identificar a nadie.',
  },
  {
    quien: 'Visitantes que permiten la medición',
    datos: 'Páginas vistas, país, tipo de dispositivo y navegador, sin cookies.',
    para: 'Saber qué se visita más.',
    cuanto: 'Solo se conservan cifras agregadas, que no permiten identificar a nadie.',
  },
];

export interface Encargado {
  nombre: string;
  pais: string;
  funcion: string;
  privacidad: string;
}

/** Proveedores que tratan datos por cuenta de MusicMafia (encargados). Todos están fuera de Colombia. */
export const ENCARGADOS: Encargado[] = [
  {
    nombre: 'Cloudflare, Inc.',
    pais: 'Estados Unidos (red mundial de servidores)',
    funcion: 'Alojamiento de la web, almacenamiento de audios e imágenes, protección contra ataques y estadísticas de visitas.',
    privacidad: 'https://www.cloudflare.com/privacypolicy/',
  },
  {
    nombre: 'Supabase, Inc.',
    pais: 'Estados Unidos (servidores en la región que elija MusicMafia)',
    funcion: 'Base de datos de perfiles y beats, y acceso de los productores al panel.',
    privacidad: 'https://supabase.com/privacy',
  },
  {
    nombre: 'Google LLC',
    pais: 'Estados Unidos',
    funcion: `Correo ${SITIO.contacto.correo} y envío de los correos de la cuenta (invitación y cambio de contraseña).`,
    privacidad: 'https://policies.google.com/privacy',
  },
  {
    nombre: 'GitHub, Inc.',
    pais: 'Estados Unidos',
    funcion: `Código de la web y copias de seguridad semanales de la base de datos, que se borran solas a los ${LEGAL.diasBorrado} días.`,
    privacidad: 'https://docs.github.com/es/site-policy/privacy-policies/github-general-privacy-statement',
  },
];

export interface Almacenamiento {
  nombre: string;
  tipo: string;
  de: string;
  categoria: 'Esencial' | 'Medición';
  para: string;
  duracion: string;
}

/** Todo lo que la web guarda o lee en el dispositivo del visitante. */
export const ALMACENAMIENTO: Almacenamiento[] = [
  {
    nombre: 'mm-consentimiento',
    tipo: 'Almacenamiento local',
    de: 'MusicMafia',
    categoria: 'Esencial',
    para: 'Recordar tu elección sobre la medición para no preguntarte en cada página.',
    duracion: '12 meses',
  },
  {
    nombre: 'sb-…-auth-token',
    tipo: 'Almacenamiento local',
    de: 'Supabase',
    categoria: 'Esencial',
    para: 'Mantener abierta la sesión de un productor en su panel. Solo existe si inicias sesión.',
    duracion: 'Hasta cerrar sesión',
  },
  {
    nombre: '__cf_bm y cf_clearance',
    tipo: 'Cookies',
    de: 'Cloudflare',
    categoria: 'Esencial',
    para: 'Distinguir personas de robots. Solo aparecen si Cloudflare detecta tráfico sospechoso.',
    duracion: 'Unos 30 minutos',
  },
  {
    nombre: 'Cloudflare Web Analytics',
    tipo: 'Sin cookies: no guarda nada en tu dispositivo',
    de: 'Cloudflare',
    categoria: 'Medición',
    para: 'Contar visitas de forma anónima. Solo se activa si lo permites.',
    duracion: 'No aplica',
  },
];

/** Clave y vigencia de la elección del banner. Subir `version` obliga a preguntar de nuevo. */
export const CONSENTIMIENTO = { clave: 'mm-consentimiento', version: 1, diasValidez: 365 } as const;

export interface Aceptacion {
  id: 'terminos' | 'datos' | 'derechos' | 'edad' | 'novedades';
  obligatoria: boolean;
  texto: string;
}

/**
 * Lo que marca un productor al activar su cuenta. Las obligatorias impiden continuar si faltan;
 * "novedades" es opcional y va desmarcada. Cada aceptación se guarda con fecha, versión e IP.
 */
export const ACEPTACIONES: Aceptacion[] = [
  { id: 'edad', obligatoria: true, texto: `Soy mayor de ${LEGAL.edadMinima} años.` },
  { id: 'terminos', obligatoria: true, texto: 'He leído y acepto los Términos y condiciones.' },
  {
    id: 'datos',
    obligatoria: true,
    texto: `Autorizo a ${SITIO.responsable.nombre} (MusicMafia) a tratar mis datos personales para crear mi cuenta, publicar mi perfil y mis beats y darlos a conocer, según la Política de tratamiento de datos personales. Esto incluye guardarlos con proveedores fuera de Colombia. Sé que la foto de perfil es opcional y que, si muestra mi rostro, puede considerarse un dato sensible que no estoy obligado a entregar.`,
  },
  {
    id: 'derechos',
    obligatoria: true,
    texto: 'Declaro que soy autor de los beats que subo, o que tengo los derechos para publicarlos, y que no infringen derechos de terceros, incluidos los samples.',
  },
  {
    id: 'novedades',
    obligatoria: false,
    texto: 'Quiero recibir por correo novedades, convocatorias y oportunidades de MusicMafia. Puedo retirar este permiso cuando quiera.',
  },
];

/** Aviso de privacidad corto que se muestra junto a las casillas al activar la cuenta. */
export const AVISO_PRIVACIDAD = `${SITIO.responsable.nombre} (MusicMafia), con domicilio en ${SITIO.contacto.ciudad}, tratará tus datos para crear tu cuenta, publicar tu perfil y tus beats, comunicarse contigo sobre la cuenta y, si lo autorizas, enviarte novedades. Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar tu autorización, escribiendo a ${SITIO.contacto.correo}. La política completa está en ${SITIO.dominio}/tratamiento-de-datos.`;
