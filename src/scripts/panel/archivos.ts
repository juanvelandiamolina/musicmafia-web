// Preparación de archivos en el navegador, antes de subirlos:
// - imágenes: se recortan al centro y se reducen (la foto a 800×1000, las portadas a 600×600), en WebP;
// - audio: se calcula la duración y la forma de onda (160 picos de 0 a 100) que dibuja el perfil.

const MB = 1024 * 1024;
export const MAX_AUDIO = 50 * MB;
export const MAX_DURACION = 15 * 60;

export async function prepararImagen(archivo: File, ancho: number, alto: number): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) throw new Error('Eso no es una imagen. Usa un JPG, PNG o WebP.');
  if (archivo.size > 25 * MB) throw new Error('La imagen pesa demasiado (más de 25 MB).');

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(archivo);
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con un JPG o PNG.');
  }

  // Recorte centrado a la proporción pedida; en retratos se sube un poco, que es donde suele estar la cara.
  const proporcion = ancho / alto;
  let sw = bmp.width;
  let sh = bmp.height;
  let sx = 0;
  let sy = 0;
  if (sw / sh > proporcion) {
    sw = sh * proporcion;
    sx = (bmp.width - sw) / 2;
  } else {
    sh = sw / proporcion;
    sy = (bmp.height - sh) * 0.35;
  }

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo preparar la imagen.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, ancho, alto);
  bmp.close();

  const comoBlob = (tipo: string, calidad: number) =>
    new Promise<Blob | null>((ok) => lienzo.toBlob(ok, tipo, calidad));
  const webp = await comoBlob('image/webp', 0.85);
  if (webp?.type === 'image/webp') return webp;
  const jpg = await comoBlob('image/jpeg', 0.88); // Navegadores que aún no exportan WebP.
  if (!jpg) throw new Error('El navegador no pudo preparar la imagen.');
  return jpg;
}

export async function analizarAudio(archivo: File): Promise<{ duracion: number; picos: number[] }> {
  if (!/^audio\/(mpeg|mp3|mp4|x-m4a|aac|wav|x-wav|wave|vnd\.wave)$/.test(archivo.type) && !/\.(mp3|m4a|wav)$/i.test(archivo.name)) {
    throw new Error('Sube el beat en MP3, M4A o WAV.');
  }
  if (archivo.size > MAX_AUDIO) throw new Error('El audio pasa de 50 MB. Sube un fragmento más corto o expórtalo en MP3.');

  // Se decodifica a 8 kHz y en mono: basta para la forma de onda y gasta mucha menos memoria (importa en móviles).
  const contexto = new OfflineAudioContext(1, 1, 8000);
  let audio: AudioBuffer;
  try {
    audio = await contexto.decodeAudioData(await archivo.arrayBuffer());
  } catch {
    throw new Error('No se pudo leer el audio. Revisa que sea un MP3, M4A o WAV que suene bien.');
  }
  if (audio.duration > MAX_DURACION) throw new Error('El beat dura más de 15 minutos.');
  if (audio.duration < 1) throw new Error('El audio dura menos de un segundo.');

  const canales = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  const n = 160;
  const tramo = Math.max(1, Math.floor(audio.length / n));
  const crudos: number[] = [];
  for (let i = 0; i < n; i++) {
    let max = 0;
    const fin = Math.min(audio.length, (i + 1) * tramo);
    for (let j = i * tramo; j < fin; j++) {
      for (const c of canales) {
        const v = Math.abs(c[j]);
        if (v > max) max = v;
      }
    }
    crudos.push(max);
  }
  const tope = Math.max(...crudos) || 1;
  return {
    duracion: Math.round(audio.duration * 10) / 10,
    picos: crudos.map((v) => Math.round((v / tope) * 100)),
  };
}
