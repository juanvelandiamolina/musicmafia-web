// Única puerta a los datos del catálogo público. Se lee al compilar la web:
// - con Supabase configurado (src/lib/sitio.ts o .env), los productores publicados y sus beats;
// - sin Supabase, los datos de ejemplo de catalogo-demo.json.
// Si Supabase falla al compilar, la compilación se detiene: Cloudflare sigue sirviendo la versión anterior.
import { createClient } from '@supabase/supabase-js';
import demo from './catalogo-demo.json';
import medios from './demo-medios.json';
import { ENLACES_RESERVADOS } from '../lib/sitio';
import { CONEXION, HAY_SUPABASE, urlMedio } from '../lib/conexion';

export interface Genero {
  slug: string;
  nombre: string;
}

export interface Beat {
  id: string;
  titulo: string;
  genero: Genero;
  portada: string;
  audio: string;
  duracion: number;
  picos: number[];
}

export interface Productor {
  slug: string;
  nombre: string;
  ciudad: string;
  /** Año en que se publicó su perfil. */
  desde: number;
  abrebocas: string;
  bio: string;
  tags: Genero[];
  instagram: string;
  correo: string;
  /** Canal de YouTube (dirección completa) o vacío. */
  youtube: string;
  /** Perfil de Spotify (dirección completa) o vacío. */
  spotify: string;
  /** Sin foto, las páginas muestran su inicial. */
  foto: string | null;
  /** Su color (#rrggbb): fondo de su perfil, marco de su foto y sus detalles. */
  color: string;
  beats: Beat[];
}

export const ES_DEMO = !HAY_SUPABASE;

/** Color de quien no ha elegido uno (o cuyo color quitó MusicMafia). */
export const COLOR_MUSICMAFIA = '#e52420';

/** Colores de los productores de ejemplo, en el orden de la lista. */
const COLORES_DEMO = ['#ff7a1a', '#4cb8ff', '#a3e635', '#ff70b5', '#1fd1c1', '#ffd60a'];

/** Portada de un beat que no tiene la suya, en el color de su productor (src/pages/portada/[color].svg.ts). */
const portadaGenerica = (hex: string) => `/portada/${hex.slice(1).toLowerCase()}.svg`;

/** Portada genérica en rojo (panel del productor). */
export const PORTADA_GENERICA = '/portada-generica.svg';

const slugDe = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function deDemo(): { generos: Genero[]; productores: Productor[] } {
  type Medios = {
    audio: Record<string, { url: string; duracion: number; picos: number[] }>;
    beats: Record<string, { audio: string; portada: string }>;
    fotos: Record<string, string>;
  };
  const M = medios as Medios;
  const generos = new Map<string, Genero>(demo.generos.map((g) => [g.slug, g]));
  const genero = (slug: string) => {
    const g = generos.get(slug);
    if (!g) throw new Error(`Género desconocido: ${slug}`);
    return g;
  };

  const productores = [...demo.productores]
    .sort((a, b) => a.invitacion - b.invitacion)
    .map((p, i): Productor => ({
      slug: p.slug,
      nombre: p.nombre,
      ciudad: p.ciudad,
      desde: p.desde,
      abrebocas: p.abrebocas,
      bio: p.bio,
      tags: p.tags.map(genero),
      instagram: p.instagram,
      correo: p.correo,
      youtube: (p as { youtube?: string }).youtube ?? '',
      spotify: (p as { spotify?: string }).spotify ?? '',
      foto: M.fotos[p.slug],
      color: COLORES_DEMO[i % COLORES_DEMO.length],
      beats: p.beats.map((b) => {
        const id = `${p.slug}-${slugDe(b.titulo)}`;
        const medio = M.beats[id];
        const audio = M.audio[medio.audio];
        return {
          id,
          titulo: b.titulo,
          genero: genero(b.genero),
          portada: medio.portada,
          audio: audio.url,
          duracion: audio.duracion,
          picos: audio.picos,
        };
      }),
    }));
  return { generos: [...generos.values()], productores };
}

async function deSupabase(): Promise<{ generos: Genero[]; productores: Productor[] }> {
  const sb = createClient(CONEXION.url, CONEXION.clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const [g, p] = await Promise.all([
    sb.from('generos').select('id, nombre').order('orden'),
    sb
      .from('productores')
      .select(
        'enlace, nombre, ciudad, abrebocas, bio, etiquetas, instagram, correo_contacto, youtube, spotify, foto, publicado_en, colores (hex), ' +
          'beats (id, titulo, genero, audio, portada, duracion, picos, orden)',
      )
      .eq('estado', 'publicado')
      .order('publicado_en', { ascending: true })
      .order('orden', { referencedTable: 'beats', ascending: true }),
  ]);
  const error = g.error ?? p.error;
  if (error) throw new Error(`No se pudo leer Supabase al compilar la web: ${error.message}`);

  const generos = new Map<string, Genero>(g.data.map((x) => [x.id, { slug: x.id, nombre: x.nombre }]));
  const genero = (id: string): Genero => generos.get(id) ?? { slug: id, nombre: id };

  type Fila = {
    enlace: string; nombre: string; ciudad: string; abrebocas: string; bio: string; etiquetas: string[];
    instagram: string; correo_contacto: string; youtube: string; spotify: string; foto: string | null; publicado_en: string; colores: { hex: string } | null;
    beats: { id: string; titulo: string; genero: string; audio: string; portada: string | null; duracion: number; picos: number[] }[];
  };

  const productores = (p.data as unknown as Fila[])
    .filter((f) => !ENLACES_RESERVADOS.has(f.enlace))
    .map((f): Productor => ({
      slug: f.enlace,
      nombre: f.nombre,
      ciudad: f.ciudad,
      desde: new Date(f.publicado_en).getFullYear(),
      abrebocas: f.abrebocas,
      bio: f.bio,
      tags: f.etiquetas.map(genero),
      instagram: f.instagram,
      correo: f.correo_contacto,
      youtube: f.youtube,
      spotify: f.spotify,
      foto: f.foto ? urlMedio(f.foto) : null,
      color: f.colores?.hex ?? COLOR_MUSICMAFIA,
      beats: f.beats.map((b) => ({
        id: b.id,
        titulo: b.titulo,
        genero: genero(b.genero),
        portada: b.portada ? urlMedio(b.portada) : portadaGenerica(f.colores?.hex ?? COLOR_MUSICMAFIA),
        audio: urlMedio(b.audio),
        duracion: b.duracion,
        picos: b.picos,
      })),
    }));

  return { generos: [...generos.values()], productores };
}

const DATOS = HAY_SUPABASE ? await deSupabase() : deDemo();

for (const p of DATOS.productores) {
  if (ENLACES_RESERVADOS.has(p.slug)) throw new Error(`El enlace "${p.slug}" está reservado por la web.`);
}

export const productores = (): Productor[] => DATOS.productores;
export const productor = (slug: string): Productor | undefined => DATOS.productores.find((p) => p.slug === slug);
export const todosLosGeneros = (): Genero[] => DATOS.generos;

/** Géneros que aparecen en los beats de un productor, del más frecuente al menos. */
export function generosDe(p: Productor): { genero: Genero; cuantos: number }[] {
  const cuenta = new Map<string, { genero: Genero; cuantos: number }>();
  for (const b of p.beats) {
    const c = cuenta.get(b.genero.slug) ?? { genero: b.genero, cuantos: 0 };
    c.cuantos++;
    cuenta.set(b.genero.slug, c);
  }
  return [...cuenta.values()].sort((a, b) => b.cuantos - a.cuantos || a.genero.nombre.localeCompare(b.genero.nombre, 'es'));
}

export const minutos = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
