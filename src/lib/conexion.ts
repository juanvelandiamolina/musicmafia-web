// Dónde están los datos y los archivos.
// Sin Supabase configurado, la web usa los datos de ejemplo y el panel funciona en modo de ensayo (en el navegador).
import { SITIO } from './sitio';

const env = import.meta.env;

export const CONEXION = {
  url: (env.PUBLIC_SUPABASE_URL as string | undefined) || SITIO.supabase.url,
  clave: (env.PUBLIC_SUPABASE_CLAVE as string | undefined) || SITIO.supabase.clave,
  /** Base de las direcciones de audios, portadas y fotos guardados en R2. */
  medios: ((env.PUBLIC_MEDIOS_URL as string | undefined) || SITIO.medios).replace(/\/$/, ''),
};

// `npm run dev:ensayo` (modo «ensayo» de Astro) ignora Supabase aunque esté configurado: sirve para probar el
// panel y /admin en local con datos de mentira, sin tocar el proyecto real.
export const HAY_SUPABASE = import.meta.env.MODE !== 'ensayo' && Boolean(CONEXION.url && CONEXION.clave);

/** Dirección pública de un archivo guardado en R2 a partir de su ruta ("<id>/audio/<uuid>.mp3"). */
export const urlMedio = (ruta: string) => `${CONEXION.medios}/${ruta}`;
