// Lo que el panel puede pedir o guardar. Dos versiones con la misma forma:
// - real.ts: Supabase (datos y sesión) + /api/medios (archivos en R2). Es la de producción.
// - ensayo.ts: todo en este navegador, para ver y probar el panel sin Supabase.
// Las páginas del panel solo hablan con esta interfaz, nunca con Supabase directamente.
import { HAY_SUPABASE } from '../../lib/conexion';

export type Estado = 'borrador' | 'en_revision' | 'publicado' | 'retirado';
export type TipoArchivo = 'audio' | 'portada' | 'foto';

export interface Sesion {
  id: string;
  correo: string;
}

export interface Perfil {
  id: string;
  enlace: string;
  nombre: string;
  ciudad: string;
  abrebocas: string;
  bio: string;
  etiquetas: string[];
  instagram: string;
  correo_contacto: string;
  /** Dirección completa del canal, o vacío. */
  youtube: string;
  /** Dirección completa del perfil de artista o de usuario, o vacío. */
  spotify: string;
  foto: string | null;
  /** Id del color elegido (null = el rojo de MusicMafia). */
  color: string | null;
  estado: Estado;
  nota: string;
}

export type CambiosPerfil = Partial<
  Pick<Perfil, 'nombre' | 'ciudad' | 'abrebocas' | 'bio' | 'etiquetas' | 'instagram' | 'correo_contacto' | 'youtube' | 'spotify' | 'foto' | 'color'>
>;

export interface BeatPanel {
  id: string;
  titulo: string;
  genero: string;
  audio: string;
  portada: string | null;
  duracion: number;
  picos: number[];
  orden: number;
  oculto: boolean;
}

export type NuevoBeat = Pick<BeatPanel, 'titulo' | 'genero' | 'audio' | 'portada' | 'duracion' | 'picos'>;
export type CambiosBeat = Partial<Pick<BeatPanel, 'titulo' | 'genero' | 'portada' | 'orden'>>;

export interface AceptacionGuardada {
  casilla: string;
  aceptada: boolean;
  version: string;
  fecha: string;
}

export interface GeneroPanel {
  id: string;
  nombre: string;
}

export interface ColorPanel {
  id: string;
  nombre: string;
  /** #rrggbb */
  hex: string;
}

export interface ColorAdmin extends ColorPanel {
  orden: number;
  /** Perfiles que lo tienen elegido. */
  perfiles: number;
}

export interface GeneroAdmin extends GeneroPanel {
  orden: number;
  /** Beats que lo usan. */
  beats: number;
  /** Perfiles que lo tienen entre sus estilos. */
  perfiles: number;
}

export interface FilaAdmin {
  id: string;
  enlace: string;
  nombre: string;
  correo: string;
  estado: Estado;
  nota: string;
  beats: number;
  ocultos: number;
  invitado: string;
  activo: boolean;
  ultima_entrada: string | null;
  actualizado: string;
  publicado_en: string | null;
}

export interface Publicacion {
  ultimo_cambio: string | null;
  ultima_reconstruccion: string | null;
  reconstrucciones: number;
}

export interface Datos {
  modo: 'real' | 'ensayo';

  // Sesión
  sesion(): Promise<Sesion | null>;
  entrar(correo: string, clave: string): Promise<void>;
  salir(): Promise<void>;
  /** Devuelve el enlace solo en ensayo (en producción va por correo). */
  pedirCambioDeClave(correo: string): Promise<string | null>;
  /** Abre la sesión con el enlace de un correo (invitación o cambio de contraseña). */
  abrirEnlace(tokenHash: string, tipo: 'invite' | 'recovery'): Promise<void>;
  cambiarClave(clave: string): Promise<void>;
  esAdmin(): Promise<boolean>;
  generos(): Promise<GeneroPanel[]>;
  colores(): Promise<ColorPanel[]>;

  // Productor
  miPerfil(): Promise<Perfil | null>;
  guardarPerfil(cambios: CambiosPerfil): Promise<Perfil>;
  misBeats(): Promise<BeatPanel[]>;
  crearBeat(beat: NuevoBeat): Promise<BeatPanel>;
  editarBeat(id: string, cambios: CambiosBeat): Promise<BeatPanel>;
  borrarBeat(id: string): Promise<void>;
  misAceptaciones(): Promise<AceptacionGuardada[]>;
  aceptarDocumentos(version: string, novedades: boolean): Promise<void>;
  cambiarNovedades(quiere: boolean, version: string): Promise<void>;
  enviarARevision(): Promise<void>;
  /** Borra sus archivos, su perfil, sus beats y su usuario. */
  borrarMiCuenta(): Promise<void>;

  // Archivos
  subir(tipo: TipoArchivo, archivo: Blob, alProgresar?: (fraccion: number) => void): Promise<string>;
  borrarArchivos(rutas: string[]): Promise<void>;
  urlMedio(ruta: string): string;

  // MusicMafia
  adminProductores(): Promise<FilaAdmin[]>;
  adminBeatsDe(productor: string): Promise<BeatPanel[]>;
  enlaceLibre(enlace: string): Promise<boolean>;
  /** Devuelve el enlace de activación solo en ensayo (en producción va por correo). */
  invitar(correo: string, nombre: string, enlace: string): Promise<string | null>;
  cambiarEstado(id: string, estado: Estado, nota?: string): Promise<void>;
  ocultarBeat(id: string, oculto: boolean): Promise<void>;
  publicacion(): Promise<Publicacion>;
  reconstruir(): Promise<void>;
  adminGeneros(): Promise<GeneroAdmin[]>;
  crearGenero(nombre: string): Promise<void>;
  /** Si hay beats con ese género, `reemplazo` dice a qué género pasarlos. */
  quitarGenero(id: string, reemplazo?: string): Promise<void>;
  adminColores(): Promise<ColorAdmin[]>;
  crearColor(nombre: string, hex: string): Promise<void>;
  /** Sus productores vuelven al rojo de MusicMafia. */
  quitarColor(id: string): Promise<void>;
}

let promesa: Promise<Datos> | null = null;

/** Carga la versión que toca (solo se descarga una de las dos). */
export function datos(): Promise<Datos> {
  promesa ??= HAY_SUPABASE
    ? import('./real').then((m) => m.crear())
    : import('./ensayo').then((m) => m.crear());
  return promesa;
}

/** Enlace público sugerido a partir del nombre artístico: "Lía Ríos" → "lia-rios". */
export const enlaceDesde = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');

/** Acepta "@usuario", "usuario" o la dirección completa del perfil y deja solo el usuario. */
export function limpiarInstagram(valor: string): string {
  let v = valor.trim();
  const m = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) v = m[1];
  return v.replace(/^@+/, '').trim();
}

/** Canal de YouTube válido (la base de datos exige lo mismo). */
export const YOUTUBE = /^https:\/\/www\.youtube\.com\/(@[A-Za-z0-9._-]{3,30}|channel\/UC[A-Za-z0-9_-]{22}|c\/[A-Za-z0-9._-]{1,100}|user\/[A-Za-z0-9._-]{1,100})$/;

/** Perfil de Spotify válido: de artista o de usuario. */
export const SPOTIFY = /^https:\/\/open\.spotify\.com\/(artist\/[A-Za-z0-9]{22}|user\/[A-Za-z0-9._-]{1,64})$/;

/** Acepta "@canal", "youtube.com/@canal" o la dirección copiada de cualquier pestaña del canal. */
export function limpiarYoutube(valor: string): string {
  let v = valor.trim();
  if (!v) return '';
  if (/^@?[A-Za-z0-9._-]{3,30}$/.test(v)) return `https://www.youtube.com/@${v.replace(/^@/, '')}`;
  v = v.replace(/^(https?:\/\/)?((www|m)\.)?youtube\.com\//i, 'https://www.youtube.com/');
  v = v.split(/[?#]/)[0].replace(/\/+$/, '');
  return v.replace(/\/(videos|featured|shorts|streams|playlists|about|community|releases|podcasts)$/i, '');
}

/** Acepta la dirección de Spotify (con o sin «?si=…» ni idioma) o el código «spotify:artist:…». */
export function limpiarSpotify(valor: string): string {
  const v = valor.trim();
  if (!v) return '';
  const uri = v.match(/^spotify:(artist|user):([A-Za-z0-9._-]+)$/);
  if (uri) return `https://open.spotify.com/${uri[1]}/${uri[2]}`;
  return v
    .replace(/^(https?:\/\/)?open\.spotify\.com\//i, 'https://open.spotify.com/')
    .replace(/^https:\/\/open\.spotify\.com\/intl-[a-z]{2}(-[a-z]{2})?\//i, 'https://open.spotify.com/')
    .split(/[?#]/)[0]
    .replace(/\/+$/, '');
}

/** Rojo de MusicMafia: el color de quien no ha elegido uno. */
export const COLOR_MUSICMAFIA = '#e52420';

/** Contraste WCAG de un color #rrggbb con el negro. El color de un productor necesita al menos 4,5. */
export function contrasteConNegro(hex: string): number {
  const lineal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lineal(parseInt(hex.slice(i, i + 2), 16) / 255));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05) / 0.05;
}

export const NOMBRES_ESTADO: Record<Estado, string> = {
  borrador: 'sin publicar',
  en_revision: 'en revisión',
  publicado: 'publicado',
  retirado: 'retirado',
};
