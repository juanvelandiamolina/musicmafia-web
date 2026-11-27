// @ts-check
import { defineConfig } from 'astro/config';

// Mientras no haya dominio propio, la web vive en el subdominio gratuito de Cloudflare Pages.
export default defineConfig({
  site: 'https://musicmafia.pages.dev',
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  build: {
    // nocturno.html -> Cloudflare Pages lo sirve como /nocturno (sin barra final),
    // que es el enlace que cada productor pondrá en su bio.
    format: 'file',
  },
  vite: {
    // Los scripts del panel usan await en el nivel superior (navegadores de 2021 en adelante).
    build: { target: 'es2022' },
    esbuild: { target: 'es2022' },
  },
});
