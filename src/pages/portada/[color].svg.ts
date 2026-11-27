// /portada/<rrggbb>.svg: la portada de un beat que no tiene la suya, en el color de su productor.
// Se genera al compilar, una por cada color que usa algún productor publicado.
import type { APIRoute, GetStaticPaths } from 'astro';
import generica from '../../../public/portada-generica.svg?raw';
import { productores } from '../../data/catalogo';

export const getStaticPaths = (() =>
  [...new Set(productores().map((p) => p.color.slice(1).toLowerCase()))].map((color) => ({ params: { color } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const svg = generica.replaceAll('#e52420', `#${params.color}`).replaceAll('#ece9e3', '#f7f6f2');
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
