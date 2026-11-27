// Panel de ensayo: la misma interfaz que real.ts, pero todo vive en este navegador (localStorage para los datos e
// IndexedDB para los archivos). Sirve para ver y probar el panel sin Supabase. Nada sale del equipo.
// Copia las reglas principales de la base de datos para que los errores se parezcan a los de verdad.
import type {
  AceptacionGuardada, BeatPanel, ColorAdmin, ColorPanel, Datos, Estado, FilaAdmin, GeneroAdmin, GeneroPanel, Perfil, Publicacion, TipoArchivo,
} from './datos';
import { contrasteConNegro, enlaceDesde, SPOTIFY, YOUTUBE } from './datos';

const COLORES: ColorPanel[] = [
  { id: 'rojo', nombre: 'Rojo', hex: '#e52420' }, { id: 'naranja', nombre: 'Naranja', hex: '#ff7a1a' },
  { id: 'amarillo', nombre: 'Amarillo', hex: '#ffd60a' }, { id: 'lima', nombre: 'Lima', hex: '#a3e635' },
  { id: 'verde', nombre: 'Verde', hex: '#2fd27a' }, { id: 'turquesa', nombre: 'Turquesa', hex: '#1fd1c1' },
  { id: 'celeste', nombre: 'Celeste', hex: '#4cb8ff' }, { id: 'lila', nombre: 'Lila', hex: '#b79cff' },
  { id: 'rosa', nombre: 'Rosa', hex: '#ff70b5' }, { id: 'coral', nombre: 'Coral', hex: '#ff8a70' },
];
import { ENLACES_RESERVADOS } from '../../lib/sitio';

/** Cuentas del ensayo. No existen fuera de este navegador; la página de entrada las ofrece con un botón. */
export const CUENTAS_ENSAYO = {
  productor: { correo: 'productor@ensayo.local', clave: 'ensayo-productor' },
  admin: { correo: 'musicmafia@ensayo.local', clave: 'ensayo-musicmafia' },
} as const;

const CLAVE = 'mm-ensayo';

const GENEROS: GeneroPanel[] = [
  { id: 'trap', nombre: 'Trap' }, { id: 'drill', nombre: 'Drill' }, { id: 'rnb', nombre: 'R&B' },
  { id: 'reggaeton', nombre: 'Reggaetón' }, { id: 'dembow', nombre: 'Dembow' }, { id: 'afrobeat', nombre: 'Afrobeat' },
  { id: 'amapiano', nombre: 'Amapiano' }, { id: 'boom-bap', nombre: 'Boom Bap' }, { id: 'lofi', nombre: 'Lo-fi' },
  { id: 'phonk', nombre: 'Phonk' },
];

interface Usuario {
  id: string;
  correo: string;
  clave: string;
  admin: boolean;
  invitado: string;
  ultima_entrada: string | null;
}

interface Estado_ {
  generos: GeneroPanel[];
  colores: ColorPanel[];
  usuarios: Usuario[];
  perfiles: (Perfil & { actualizado: string; publicado_en: string | null })[];
  beats: (BeatPanel & { productor: string })[];
  aceptaciones: (AceptacionGuardada & { usuario: string })[];
  tokens: Record<string, { usuario: string; tipo: 'invite' | 'recovery' }>;
  publicacion: Publicacion;
  sesion: string | null;
}

const ahora = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function inicial(): Estado_ {
  const productor = id();
  const admin = id();
  const hoy = ahora();
  return {
    generos: GENEROS.map((g) => ({ ...g })),
    colores: COLORES.map((c) => ({ ...c })),
    usuarios: [
      { id: productor, correo: CUENTAS_ENSAYO.productor.correo, clave: CUENTAS_ENSAYO.productor.clave, admin: false, invitado: hoy, ultima_entrada: null },
      { id: admin, correo: CUENTAS_ENSAYO.admin.correo, clave: CUENTAS_ENSAYO.admin.clave, admin: true, invitado: hoy, ultima_entrada: null },
    ],
    perfiles: [
      {
        id: productor, enlace: 'productor-de-prueba', nombre: 'Productor de prueba', ciudad: '', abrebocas: '', bio: '',
        etiquetas: [], instagram: '', correo_contacto: '', youtube: '', spotify: '', foto: null, color: null, estado: 'borrador', nota: '',
        actualizado: hoy, publicado_en: null,
      },
    ],
    beats: [],
    aceptaciones: [],
    tokens: {},
    publicacion: { ultimo_cambio: null, ultima_reconstruccion: null, reconstrucciones: 0 },
    sesion: null,
  };
}

function leer(): Estado_ {
  try {
    const t = localStorage.getItem(CLAVE);
    if (t) {
      const e = JSON.parse(t) as Estado_;
      e.generos ??= GENEROS.map((g) => ({ ...g })); // ensayos guardados antes de que existieran
      e.colores ??= COLORES.map((c) => ({ ...c }));
      for (const p of e.perfiles) {
        p.color ??= null;
        p.youtube ??= '';
        p.spotify ??= '';
      }
      return e;
    }
  } catch {}
  return inicial();
}

// ---------- Archivos en IndexedDB ----------
function abrirBD(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open('mm-ensayo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('archivos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

function operar<T>(bd: IDBDatabase, modo: IDBTransactionMode, hacer: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((ok, mal) => {
    const r = hacer(bd.transaction('archivos', modo).objectStore('archivos'));
    r.onsuccess = () => ok(r.result as T);
    r.onerror = () => mal(r.error);
  });
}

export async function crear(): Promise<Datos> {
  let e = leer();
  const guardar = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(e));
    } catch {
      throw new Error('El navegador no deja guardar más datos de ensayo.');
    }
  };
  guardar();

  const bd = await abrirBD();
  const urls = new Map<string, string>();
  const rutas = await operar<IDBValidKey[]>(bd, 'readonly', (s) => s.getAllKeys());
  for (const ruta of rutas) {
    const blob = await operar<Blob>(bd, 'readonly', (s) => s.get(ruta));
    urls.set(String(ruta), URL.createObjectURL(blob));
  }

  const yo = () => {
    const u = e.usuarios.find((x) => x.id === e.sesion);
    if (!u) throw new Error('Tu sesión venció. Entra de nuevo.');
    return u;
  };
  const adminOFalla = () => {
    if (!yo().admin) throw new Error('Solo MusicMafia puede hacer esto.');
  };
  const perfilDe = (uid: string) => e.perfiles.find((p) => p.id === uid);
  const haAceptado = (uid: string) => e.aceptaciones.some((a) => a.usuario === uid && a.casilla === 'terminos' && a.aceptada);
  const marcarCambio = (uid: string, antes?: Estado) => {
    const p = perfilDe(uid);
    if (p?.estado === 'publicado' || antes === 'publicado') e.publicacion.ultimo_cambio = ahora();
  };
  const limpio = <T extends object>(x: T): T => JSON.parse(JSON.stringify(x));
  const sinProductor = ({ productor: _, ...b }: BeatPanel & { productor: string }): BeatPanel => limpio(b);
  const perfilPublico = (p: Estado_['perfiles'][number]): Perfil => {
    const { actualizado: _a, publicado_en: _p, ...resto } = p;
    return limpio(resto);
  };

  function validarPerfil(p: Perfil) {
    if (p.nombre.length < 1 || p.nombre.length > 40) throw new Error('El nombre debe tener entre 1 y 40 caracteres.');
    if (p.etiquetas.length > 3) throw new Error('Elige hasta tres estilos.');
    if (p.instagram && !/^[A-Za-z0-9._]{1,30}$/.test(p.instagram)) {
      throw new Error('Revisa tu usuario de Instagram: solo letras, números, puntos y guiones bajos.');
    }
    if (p.correo_contacto && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.correo_contacto)) {
      throw new Error('Ese correo de contacto no parece válido.');
    }
    if (p.color && !e.colores.some((c) => c.id === p.color)) throw new Error('Ese color ya no existe. Elige otro.');
    if (p.youtube && !YOUTUBE.test(p.youtube)) throw new Error('Revisa el enlace de YouTube: tiene que ser el de tu canal.');
    if (p.spotify && !SPOTIFY.test(p.spotify)) throw new Error('Revisa el enlace de Spotify: tiene que ser el de tu perfil de artista.');
  }

  function registrar(uid: string, casilla: string, aceptada: boolean, version: string) {
    e.aceptaciones.unshift({ usuario: uid, casilla, aceptada, version, fecha: ahora() });
  }

  const datos: Datos = {
    modo: 'ensayo',

    async sesion() {
      const u = e.usuarios.find((x) => x.id === e.sesion);
      return u ? { id: u.id, correo: u.correo } : null;
    },

    async entrar(correo, clave) {
      const u = e.usuarios.find((x) => x.correo === correo.trim().toLowerCase() && x.clave && x.clave === clave);
      if (!u) throw new Error('Correo o contraseña incorrectos.');
      u.ultima_entrada = ahora();
      e.sesion = u.id;
      guardar();
    },

    async salir() {
      e.sesion = null;
      guardar();
    },

    async pedirCambioDeClave(correo) {
      const u = e.usuarios.find((x) => x.correo === correo.trim().toLowerCase());
      if (!u) return null; // Como en producción: no se revela si el correo existe.
      const t = id();
      e.tokens[t] = { usuario: u.id, tipo: 'recovery' };
      guardar();
      return `/restablecer?token_hash=${t}&type=recovery`;
    },

    async abrirEnlace(tokenHash, tipo) {
      const t = e.tokens[tokenHash];
      if (!t || t.tipo !== tipo) throw new Error('Este enlace ya se usó o venció. Pide otro.');
      delete e.tokens[tokenHash];
      e.sesion = t.usuario;
      guardar();
    },

    async cambiarClave(clave) {
      if (clave.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.');
      yo().clave = clave;
      guardar();
    },

    async esAdmin() {
      return e.usuarios.find((x) => x.id === e.sesion)?.admin ?? false;
    },

    async generos() {
      return limpio(e.generos);
    },

    async colores() {
      return limpio(e.colores);
    },

    async miPerfil() {
      const p = perfilDe(yo().id);
      return p ? perfilPublico(p) : null;
    },

    async guardarPerfil(cambios) {
      const u = yo();
      const p = perfilDe(u.id);
      if (!p || !haAceptado(u.id)) throw new Error('No se pudo guardar. Recarga la página y vuelve a probar.');
      const nuevo = { ...p, ...cambios };
      nuevo.nombre = nuevo.nombre.trim();
      nuevo.correo_contacto = nuevo.correo_contacto.trim().toLowerCase();
      validarPerfil(nuevo);
      Object.assign(p, nuevo, { actualizado: ahora() });
      marcarCambio(u.id);
      guardar();
      return perfilPublico(p);
    },

    async misBeats() {
      const u = yo();
      return e.beats.filter((b) => b.productor === u.id).sort((a, b) => a.orden - b.orden).map(sinProductor);
    },

    async crearBeat(beat) {
      const u = yo();
      if (!haAceptado(u.id)) throw new Error('No tienes permiso para hacer esto.');
      const mios = e.beats.filter((b) => b.productor === u.id);
      const nuevo = {
        ...beat, titulo: beat.titulo.trim(), id: id(), productor: u.id, oculto: false,
        orden: Math.max(0, ...mios.map((b) => b.orden)) + 1,
      };
      e.beats.push(nuevo);
      marcarCambio(u.id);
      guardar();
      return sinProductor(nuevo);
    },

    async editarBeat(beatId, cambios) {
      const u = yo();
      const b = e.beats.find((x) => x.id === beatId && x.productor === u.id);
      if (!b) throw new Error('No tienes permiso para hacer esto.');
      Object.assign(b, cambios);
      marcarCambio(u.id);
      guardar();
      return sinProductor(b);
    },

    async borrarBeat(beatId) {
      const u = yo();
      const b = e.beats.find((x) => x.id === beatId && x.productor === u.id);
      if (!b) return;
      e.beats = e.beats.filter((x) => x !== b);
      marcarCambio(u.id);
      guardar();
      await datos.borrarArchivos([b.audio, b.portada].filter(Boolean) as string[]);
    },

    async misAceptaciones() {
      const u = yo();
      return e.aceptaciones.filter((a) => a.usuario === u.id).map(({ usuario: _, ...a }) => a);
    },

    async aceptarDocumentos(version, novedades) {
      const u = yo();
      for (const c of ['edad', 'terminos', 'datos', 'derechos']) registrar(u.id, c, true, version);
      registrar(u.id, 'novedades', novedades, version);
      guardar();
    },

    async cambiarNovedades(quiere, version) {
      registrar(yo().id, 'novedades', quiere, version);
      guardar();
    },

    async enviarARevision() {
      const u = yo();
      const p = perfilDe(u.id);
      if (!p) throw new Error('No tienes un perfil de productor.');
      if (p.estado !== 'borrador') return;
      if (!p.nombre || !p.abrebocas) throw new Error('Falta tu nombre artístico o tu abrebocas.');
      if (!p.instagram && !p.correo_contacto) throw new Error('Pon al menos un contacto: Instagram o correo.');
      if (!e.beats.some((b) => b.productor === u.id)) throw new Error('Sube al menos un beat.');
      p.estado = 'en_revision';
      p.nota = '';
      guardar();
    },

    async borrarMiCuenta() {
      const u = yo();
      if (u.admin) throw new Error('Una cuenta de administración no se borra desde aquí.');
      const mias = [...urls.keys()].filter((r) => r.startsWith(`${u.id}/`));
      await datos.borrarArchivos(mias);
      const antes = perfilDe(u.id)?.estado;
      e.beats = e.beats.filter((b) => b.productor !== u.id);
      e.perfiles = e.perfiles.filter((p) => p.id !== u.id);
      e.usuarios = e.usuarios.filter((x) => x.id !== u.id);
      if (antes === 'publicado') e.publicacion.ultimo_cambio = ahora();
      e.sesion = null;
      guardar();
    },

    async subir(tipo: TipoArchivo, archivo, alProgresar) {
      const u = yo();
      const ext = archivo.type === 'audio/mpeg' ? 'mp3' : /wav|wave/.test(archivo.type) ? 'wav' : archivo.type.startsWith('audio/') ? 'm4a' : archivo.type === 'image/webp' ? 'webp' : 'jpg';
      const ruta = `${u.id}/${tipo}/${id()}.${ext}`;
      // Un avance de mentira, para ver la barra como se verá con archivos de verdad.
      for (const f of [0.2, 0.5, 0.8]) {
        alProgresar?.(f);
        await new Promise((r) => setTimeout(r, 120));
      }
      await operar(bd, 'readwrite', (s) => s.put(archivo, ruta));
      urls.set(ruta, URL.createObjectURL(archivo));
      alProgresar?.(1);
      return ruta;
    },

    async borrarArchivos(lista) {
      for (const ruta of lista) {
        await operar(bd, 'readwrite', (s) => s.delete(ruta));
        const u = urls.get(ruta);
        if (u) URL.revokeObjectURL(u);
        urls.delete(ruta);
      }
    },

    urlMedio(ruta) {
      return urls.get(ruta) ?? '';
    },

    async adminProductores() {
      adminOFalla();
      return e.perfiles.map((p): FilaAdmin => {
        const u = e.usuarios.find((x) => x.id === p.id);
        const suyos = e.beats.filter((b) => b.productor === p.id);
        return {
          id: p.id, enlace: p.enlace, nombre: p.nombre, correo: u?.correo ?? '', estado: p.estado, nota: p.nota,
          beats: suyos.length, ocultos: suyos.filter((b) => b.oculto).length, invitado: u?.invitado ?? '',
          activo: haAceptado(p.id), ultima_entrada: u?.ultima_entrada ?? null, actualizado: p.actualizado,
          publicado_en: p.publicado_en,
        };
      });
    },

    async adminBeatsDe(productor) {
      adminOFalla();
      return e.beats.filter((b) => b.productor === productor).sort((a, b) => a.orden - b.orden).map(sinProductor);
    },

    async enlaceLibre(enlace) {
      adminOFalla();
      return /^[a-z0-9]([a-z0-9-]{0,28}[a-z0-9])?$/.test(enlace) && !enlace.includes('--') &&
        !ENLACES_RESERVADOS.has(enlace) && !e.perfiles.some((p) => p.enlace === enlace);
    },

    async invitar(correo, nombre, enlace) {
      adminOFalla();
      const c = correo.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) throw new Error('Ese correo no parece válido.');
      if (e.usuarios.some((u) => u.correo === c)) throw new Error('Ese correo ya tiene una cuenta.');
      if (!(await datos.enlaceLibre(enlace))) throw new Error(`El enlace /${enlace} ya está en uso o reservado por la web.`);
      const nuevo = id();
      e.usuarios.push({ id: nuevo, correo: c, clave: '', admin: false, invitado: ahora(), ultima_entrada: null });
      e.perfiles.unshift({
        id: nuevo, enlace, nombre: nombre.trim(), ciudad: '', abrebocas: '', bio: '', etiquetas: [], instagram: '',
        correo_contacto: '', youtube: '', spotify: '', foto: null, color: null, estado: 'borrador', nota: '', actualizado: ahora(), publicado_en: null,
      });
      const t = id();
      e.tokens[t] = { usuario: nuevo, tipo: 'invite' };
      guardar();
      return `/bienvenida?token_hash=${t}&type=invite`;
    },

    async cambiarEstado(pid, estado, nota = '') {
      adminOFalla();
      const p = perfilDe(pid);
      if (!p) throw new Error('Ese productor no existe.');
      const antes = p.estado;
      p.estado = estado;
      p.nota = nota;
      if (estado === 'publicado') p.publicado_en ??= ahora();
      marcarCambio(pid, antes);
      guardar();
    },

    async ocultarBeat(beatId, oculto) {
      adminOFalla();
      const b = e.beats.find((x) => x.id === beatId);
      if (!b) return;
      b.oculto = oculto;
      marcarCambio(b.productor);
      guardar();
    },

    async publicacion() {
      adminOFalla();
      return limpio(e.publicacion);
    },

    async reconstruir() {
      adminOFalla();
      e.publicacion.ultimo_cambio = ahora();
      e.publicacion.ultima_reconstruccion = ahora();
      e.publicacion.reconstrucciones++;
      guardar();
    },

    async adminGeneros() {
      adminOFalla();
      return e.generos.map((g, i): GeneroAdmin => ({
        ...g,
        orden: i + 1,
        beats: e.beats.filter((b) => b.genero === g.id).length,
        perfiles: e.perfiles.filter((p) => p.etiquetas.includes(g.id)).length,
      }));
    },

    async crearGenero(nombre) {
      adminOFalla();
      const n = nombre.trim();
      const gid = enlaceDesde(n).slice(0, 24).replace(/-+$/, '');
      if (n.length < 2 || n.length > 24) throw new Error('El nombre del género debe tener entre 2 y 24 caracteres.');
      if (!gid) throw new Error('Ese nombre no sirve para un género: usa letras o números.');
      if (e.generos.some((g) => g.id === gid || g.nombre.toLowerCase() === n.toLowerCase())) {
        throw new Error(`El género «${n}» ya existe.`);
      }
      e.generos.push({ id: gid, nombre: n });
      guardar();
    },

    async quitarGenero(gid, reemplazo) {
      adminOFalla();
      if (!e.generos.some((g) => g.id === gid)) throw new Error('Ese género ya no existe.');
      if (e.generos.length <= 1) throw new Error('Tiene que quedar al menos un género.');
      const suyos = e.beats.filter((b) => b.genero === gid);
      if (suyos.length) {
        if (!reemplazo) throw new Error(`Hay ${suyos.length} beats con este género: elige a qué género pasarlos.`);
        if (reemplazo === gid || !e.generos.some((g) => g.id === reemplazo)) throw new Error('Elige otro género para pasar esos beats.');
        for (const b of suyos) {
          b.genero = reemplazo;
          marcarCambio(b.productor);
        }
      }
      for (const p of e.perfiles) {
        if (p.etiquetas.includes(gid)) {
          p.etiquetas = p.etiquetas.filter((x) => x !== gid);
          marcarCambio(p.id);
        }
      }
      e.generos = e.generos.filter((g) => g.id !== gid);
      guardar();
    },

    async adminColores() {
      adminOFalla();
      return e.colores.map((c, i): ColorAdmin => ({ ...c, orden: i + 1, perfiles: e.perfiles.filter((p) => p.color === c.id).length }));
    },

    async crearColor(nombre, hex) {
      adminOFalla();
      const n = nombre.trim();
      const cid = enlaceDesde(n).slice(0, 24).replace(/-+$/, '');
      const h = hex.trim().toLowerCase();
      if (n.length < 2 || n.length > 24) throw new Error('El nombre del color debe tener entre 2 y 24 caracteres.');
      if (!cid) throw new Error('Ese nombre no sirve para un color: usa letras o números.');
      if (!/^#[0-9a-f]{6}$/.test(h)) throw new Error('Ese color no es válido.');
      if (contrasteConNegro(h) < 4.5) throw new Error('Ese color es muy oscuro: el texto negro no se leería encima. Elige uno más claro.');
      if (e.colores.some((c) => c.id === cid || c.nombre.toLowerCase() === n.toLowerCase())) throw new Error(`El color «${n}» ya existe.`);
      e.colores.push({ id: cid, nombre: n, hex: h });
      guardar();
    },

    async quitarColor(cid) {
      adminOFalla();
      if (!e.colores.some((c) => c.id === cid)) throw new Error('Ese color ya no existe.');
      if (e.colores.length <= 1) throw new Error('Tiene que quedar al menos un color.');
      for (const p of e.perfiles) {
        if (p.color === cid) {
          p.color = null;
          marcarCambio(p.id);
        }
      }
      e.colores = e.colores.filter((c) => c.id !== cid);
      guardar();
    },
  };

  // Si otra pestaña cambia el ensayo, esta lo vuelve a leer.
  addEventListener('storage', (ev) => {
    if (ev.key === CLAVE) e = leer();
  });

  return datos;
}
