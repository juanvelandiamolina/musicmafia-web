// Panel contra Supabase (datos y sesión) y /api/medios (archivos en R2). Las reglas de verdad están en la base
// de datos (el esquema de Supabase, que no forma parte de este repositorio): aquí solo se piden cosas y se traducen los errores.
import { createClient, FunctionsHttpError } from '@supabase/supabase-js';
import { CONEXION, urlMedio } from '../../lib/conexion';
import { enlaceDesde, type BeatPanel, type ColorAdmin, type ColorPanel, type Datos, type GeneroAdmin, type Perfil, type Publicacion, type TipoArchivo } from './datos';

const CAMPOS_PERFIL = 'id, enlace, nombre, ciudad, abrebocas, bio, etiquetas, instagram, correo_contacto, youtube, spotify, foto, color, estado, nota';
const CAMPOS_BEAT = 'id, titulo, genero, audio, portada, duracion, picos, orden, oculto';

const RESTRICCIONES: [RegExp, string][] = [
  [/productores_instagram_check/, 'Revisa tu usuario de Instagram: solo letras, números, puntos y guiones bajos.'],
  [/productores_correo_contacto_check/, 'Ese correo de contacto no parece válido.'],
  [/productores_nombre_check/, 'El nombre debe tener entre 1 y 40 caracteres.'],
  [/productores_etiquetas_check/, 'Elige hasta tres estilos.'],
  [/productores_color_fkey/, 'Ese color ya no existe. Elige otro.'],
  [/productores_youtube_check/, 'Revisa el enlace de YouTube: tiene que ser el de tu canal.'],
  [/productores_spotify_check/, 'Revisa el enlace de Spotify: tiene que ser el de tu perfil de artista.'],
  [/beats_titulo_check/, 'El título debe tener entre 1 y 60 caracteres.'],
];

const TRADUCCIONES: [RegExp, string][] = [
  [/Invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/Email not confirmed/i, 'Tu cuenta aún no está activada. Usa el enlace de tu invitación.'],
  [/rate limit|too many requests|over_email_send_rate_limit/i, 'Demasiados intentos. Espera unos minutos y vuelve a probar.'],
  [/Password should be at least|weak.?password/i, 'La contraseña debe tener al menos 10 caracteres.'],
  [/should be different from the old/i, 'La contraseña nueva debe ser distinta de la anterior.'],
  [/expired|invalid.*(token|link|otp)|(token|otp).*invalid/i, 'Este enlace ya se usó o venció. Pide otro.'],
  [/JWT|session.*(missing|expired|not found)|not authenticated/i, 'Tu sesión venció. Entra de nuevo.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'Sin conexión. Revisa tu internet y vuelve a probar.'],
  [/permission denied|row-level security/i, 'No tienes permiso para hacer esto.'],
  [/duplicate key.*enlace/i, 'Ese enlace ya está en uso.'],
  [/violates check constraint/i, 'Algún dato no es válido. Revísalo y vuelve a guardar.'],
];

function traducir(e: unknown): Error {
  const m = (e as { message?: string })?.message ?? String(e);
  for (const [re, texto] of [...RESTRICCIONES, ...TRADUCCIONES]) if (re.test(m)) return new Error(texto);
  return new Error(m); // Los avisos de la base de datos ya vienen en español.
}

/** Lanza el error traducido si la respuesta de Supabase trae uno. */
function exigir<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw traducir(r.error);
  return r.data;
}

export function crear(): Datos {
  const sb = createClient(CONEXION.url, CONEXION.clave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  async function token() {
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new Error('Tu sesión venció. Entra de nuevo.');
    return data.session;
  }

  const api = async (consulta: string, metodo: 'DELETE') => {
    const s = await token();
    const r = await fetch(`/api/medios?${consulta}`, { method: metodo, headers: { Authorization: `Bearer ${s.access_token}` } });
    if (!r.ok && r.status !== 404) {
      const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(cuerpo.error ?? `No se pudo borrar (${r.status}).`);
    }
  };

  return {
    modo: 'real',

    async sesion() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, correo: u.email ?? '' } : null;
    },

    async entrar(correo, clave) {
      exigir(await sb.auth.signInWithPassword({ email: correo.trim(), password: clave }));
    },

    async salir() {
      await sb.auth.signOut({ scope: 'local' });
    },

    async pedirCambioDeClave(correo) {
      exigir(await sb.auth.resetPasswordForEmail(correo.trim(), { redirectTo: `${location.origin}/restablecer` }));
      return null;
    },

    async abrirEnlace(tokenHash, tipo) {
      exigir(await sb.auth.verifyOtp({ token_hash: tokenHash, type: tipo }));
    },

    async cambiarClave(clave) {
      exigir(await sb.auth.updateUser({ password: clave }));
    },

    async esAdmin() {
      return Boolean(exigir(await sb.rpc('es_admin')));
    },

    async generos() {
      return exigir(await sb.from('generos').select('id, nombre').order('orden'));
    },

    async colores() {
      return exigir(await sb.from('colores').select('id, nombre, hex').order('orden')) as ColorPanel[];
    },

    async miPerfil() {
      const s = await token();
      return exigir(await sb.from('productores').select(CAMPOS_PERFIL).eq('id', s.user.id).maybeSingle()) as Perfil | null;
    },

    async guardarPerfil(cambios) {
      const s = await token();
      const p = exigir(await sb.from('productores').update(cambios).eq('id', s.user.id).select(CAMPOS_PERFIL).maybeSingle());
      if (!p) throw new Error('No se pudo guardar. Recarga la página y vuelve a probar.');
      return p as Perfil;
    },

    async misBeats() {
      const s = await token();
      return exigir(await sb.from('beats').select(CAMPOS_BEAT).eq('productor', s.user.id).order('orden')) as BeatPanel[];
    },

    async crearBeat(beat) {
      const s = await token();
      return exigir(await sb.from('beats').insert({ ...beat, productor: s.user.id }).select(CAMPOS_BEAT).single()) as BeatPanel;
    },

    async editarBeat(id, cambios) {
      return exigir(await sb.from('beats').update(cambios).eq('id', id).select(CAMPOS_BEAT).single()) as BeatPanel;
    },

    async borrarBeat(id) {
      const b = exigir(await sb.from('beats').delete().eq('id', id).select('audio, portada').maybeSingle());
      if (b) await this.borrarArchivos([b.audio, b.portada].filter(Boolean) as string[]).catch(() => {});
    },

    async misAceptaciones() {
      const s = await token();
      return exigir(
        await sb.from('aceptaciones').select('casilla, aceptada, version, fecha').eq('usuario', s.user.id).order('fecha', { ascending: false }),
      );
    },

    async aceptarDocumentos(version, novedades) {
      exigir(await sb.rpc('aceptar_documentos', { p_version: version, p_novedades: novedades }));
    },

    async cambiarNovedades(quiere, version) {
      exigir(await sb.rpc('cambiar_novedades', { p_quiere: quiere, p_version: version }));
    },

    async enviarARevision() {
      exigir(await sb.rpc('enviar_a_revision'));
    },

    async borrarMiCuenta() {
      await api('todo=1', 'DELETE');
      exigir(await sb.rpc('borrar_mi_cuenta'));
      await sb.auth.signOut({ scope: 'local' });
    },

    async subir(tipo: TipoArchivo, archivo, alProgresar) {
      const s = await token();
      return new Promise<string>((ok, mal) => {
        const x = new XMLHttpRequest();
        x.open('POST', `/api/medios?tipo=${tipo}`);
        x.setRequestHeader('Authorization', `Bearer ${s.access_token}`);
        x.setRequestHeader('Content-Type', archivo.type || 'application/octet-stream');
        x.upload.onprogress = (e) => e.lengthComputable && alProgresar?.(e.loaded / e.total);
        x.onload = () => {
          let r: { ruta?: string; error?: string } = {};
          try {
            r = JSON.parse(x.responseText);
          } catch {}
          if (x.status === 201 && r.ruta) ok(r.ruta);
          else mal(new Error(r.error ?? `No se pudo subir el archivo (${x.status}).`));
        };
        x.onerror = () => mal(new Error('Sin conexión. Revisa tu internet y vuelve a probar.'));
        x.send(archivo);
      });
    },

    async borrarArchivos(rutas) {
      if (!rutas.length) return;
      await api(rutas.map((r) => `ruta=${encodeURIComponent(r)}`).join('&'), 'DELETE');
    },

    urlMedio,

    async adminProductores() {
      return exigir(await sb.rpc('admin_productores'));
    },

    async adminBeatsDe(productor) {
      return exigir(await sb.from('beats').select(CAMPOS_BEAT).eq('productor', productor).order('orden')) as BeatPanel[];
    },

    async enlaceLibre(enlace) {
      return Boolean(exigir(await sb.rpc('enlace_libre', { p_enlace: enlace })));
    },

    async invitar(correo, nombre, enlace) {
      const { error } = await sb.functions.invoke('invitar', { body: { correo, nombre, enlace } });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          // Los errores de la función traen "error"; los de la puerta de Supabase, "message".
          const cuerpo = (await error.context.json().catch(() => ({}))) as { error?: string; message?: string };
          if (cuerpo.error) throw new Error(cuerpo.error);
          throw new Error(cuerpo.message ? `No se pudo enviar la invitación (${cuerpo.message}).` : 'No se pudo enviar la invitación.');
        }
        throw traducir(error);
      }
      return null;
    },

    async cambiarEstado(id, estado, nota = '') {
      exigir(await sb.rpc('admin_cambiar_estado', { p_id: id, p_estado: estado, p_nota: nota }));
    },

    async ocultarBeat(id, oculto) {
      exigir(await sb.rpc('admin_ocultar_beat', { p_id: id, p_oculto: oculto }));
    },

    async publicacion() {
      return exigir(await sb.rpc('admin_publicacion')) as Publicacion;
    },

    async reconstruir() {
      exigir(await sb.rpc('admin_reconstruir'));
    },

    async adminGeneros() {
      return exigir(await sb.rpc('admin_generos')) as GeneroAdmin[];
    },

    async crearGenero(nombre) {
      exigir(await sb.rpc('admin_crear_genero', { p_id: enlaceDesde(nombre).slice(0, 24).replace(/-+$/, ''), p_nombre: nombre }));
    },

    async quitarGenero(id, reemplazo) {
      exigir(await sb.rpc('admin_quitar_genero', { p_id: id, p_reemplazo: reemplazo ?? null }));
    },

    async adminColores() {
      return exigir(await sb.rpc('admin_colores')) as ColorAdmin[];
    },

    async crearColor(nombre, hex) {
      exigir(await sb.rpc('admin_crear_color', { p_id: enlaceDesde(nombre).slice(0, 24).replace(/-+$/, ''), p_nombre: nombre, p_hex: hex }));
    },

    async quitarColor(id) {
      exigir(await sb.rpc('admin_quitar_color', { p_id: id }));
    },
  };
}
