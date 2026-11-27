// Lógica del panel del productor (src/pages/panel.astro).
import { COLOR_MUSICMAFIA, datos, limpiarInstagram, limpiarSpotify, limpiarYoutube, SPOTIFY, YOUTUBE, type BeatPanel, type ColorPanel, type GeneroPanel, type Perfil } from './datos';
import { $, $$, avisar, contador, detener, dosToques, exigirSesion, fechaCorta, minutos, ocupado } from './ui';
import { analizarAudio, prepararImagen } from './archivos';
import { LEGAL } from '../../lib/legal';
import { SITIO } from '../../lib/sitio';

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const d = await datos();
const sesion = await exigirSesion(() => d.sesion());

if (await d.esAdmin()) {
  location.replace('/admin');
  await detener();
}

const encontrado = await d.miPerfil();
if (!encontrado) {
  $('[data-cargando]').textContent = 'Esta cuenta no tiene perfil de productor. Si crees que es un error, escríbenos.';
  await detener();
}
let perfil: Perfil = encontrado!;

const [generos, aceptaciones, colores] = await Promise.all([d.generos(), d.misAceptaciones(), d.colores()]);

/** Pinta el panel con el color elegido (o el que se está probando), como se verá su perfil. */
const hexDe = (id: string | null) => colores.find((c: ColorPanel) => c.id === id)?.hex ?? COLOR_MUSICMAFIA;
const probarColor = (id: string | null) => document.body.style.setProperty('--marca', hexDe(id));
let beats: BeatPanel[] = await d.misBeats();

const terminos = aceptaciones.find((a) => a.casilla === 'terminos' && a.aceptada);
if (!terminos) {
  // Entró sin terminar de activar la cuenta: primero contraseña y condiciones.
  location.replace('/bienvenida');
  await detener();
}

const nombreGenero = new Map(generos.map((g: GeneroPanel) => [g.id, g.nombre]));
const portadaDe = (b: BeatPanel) => (b.portada ? d.urlMedio(b.portada) : '/portada-generica.svg');

// ============================================================================================================
// Cabecera y estado
// ============================================================================================================
function pintarCabecera() {
  probarColor(perfil.color);
  $('[data-nombre]').textContent = (perfil.nombre || 'sin nombre').toLowerCase();
  $('[data-enlace]').textContent = perfil.enlace;
  $('[data-enlace-confirmar]').textContent = perfil.enlace;
  const foto = $('[data-cabecera-foto]');
  foto.style.setProperty('--foto', perfil.foto ? `url("${d.urlMedio(perfil.foto)}")` : 'none');
  foto.textContent = perfil.foto ? '' : (perfil.nombre.trim()[0] ?? '·').toLowerCase();
  const ver = document.querySelector<HTMLAnchorElement>('[data-ver-perfil]');
  if (ver) {
    ver.href = `/${perfil.enlace}`;
    ver.hidden = perfil.estado !== 'publicado' || d.modo === 'ensayo';
  }
}

function faltan(): string[] {
  const f: string[] = [];
  if (!perfil.nombre) f.push('tu nombre artístico');
  if (!perfil.abrebocas) f.push('un abrebocas');
  if (!perfil.instagram && !perfil.correo_contacto) f.push('un contacto: Instagram o correo');
  if (!beats.length) f.push('al menos un beat');
  return f;
}

function pintarEstado() {
  const caja = $('[data-estado]');
  caja.dataset.de = perfil.estado;
  const titulo = $('[data-estado-titulo]');
  const texto = $('[data-estado-texto]');
  const lista = $('[data-faltan]');
  const acciones = $('[data-estado-acciones]');
  const nota = $('[data-estado-nota]');
  const mensaje = $('[data-mensaje]', caja);
  acciones.replaceChildren();
  lista.hidden = true;
  avisar(nota, perfil.nota && perfil.estado !== 'publicado' ? `Nota de MusicMafia: ${perfil.nota}` : '', 'info');

  if (perfil.estado === 'borrador') {
    const f = faltan();
    titulo.textContent = 'tu perfil aún no se ve.';
    texto.textContent = f.length
      ? 'Complétalo y envíalo a revisión. Te falta:'
      : 'Ya tiene lo necesario. Cuando quieras, envíalo a revisión: MusicMafia lo escucha antes de publicarlo.';
    lista.replaceChildren(...f.map((x) => Object.assign(document.createElement('li'), { textContent: x })));
    lista.hidden = !f.length;
    const enviar = Object.assign(document.createElement('button'), { type: 'button', className: 'boton', textContent: 'enviar a revisión', disabled: f.length > 0 });
    enviar.addEventListener('click', () =>
      ocupado(enviar, async () => {
        await d.enviarARevision();
        perfil = { ...perfil, estado: 'en_revision', nota: '' };
        pintarEstado();
      }, mensaje),
    );
    acciones.append(enviar);
  } else if (perfil.estado === 'en_revision') {
    titulo.textContent = 'lo estamos escuchando.';
    texto.textContent = 'MusicMafia revisa tu perfil antes de publicarlo y te avisa por correo. Mientras tanto puedes seguir editándolo.';
  } else if (perfil.estado === 'publicado') {
    titulo.textContent = 'estás publicado.';
    texto.textContent = `Tu perfil está en ${SITIO.dominio}/${perfil.enlace}. Lo que cambies aquí se ve en la web en unos minutos.`;
    if (d.modo === 'ensayo') {
      texto.textContent = 'En ensayo no hay web pública. Con Supabase conectado, aquí tendrías el enlace a tu perfil publicado.';
      return;
    }
    const ver = Object.assign(document.createElement('a'), { className: 'boton', href: `/${perfil.enlace}`, target: '_blank', rel: 'noopener', textContent: 'ver mi perfil' });
    const copiar = Object.assign(document.createElement('button'), { type: 'button', className: 'boton boton--secundario', textContent: 'copiar enlace' });
    copiar.addEventListener('click', async () => {
      await navigator.clipboard.writeText(`${SITIO.url}/${perfil.enlace}`).catch(() => {});
      copiar.textContent = 'enlace copiado';
      setTimeout(() => (copiar.textContent = 'copiar enlace'), 2000);
    });
    acciones.append(ver, copiar);
  } else {
    titulo.textContent = 'tu perfil no se muestra.';
    texto.textContent = `MusicMafia lo retiró de la web. Si crees que es un error, escríbenos a ${SITIO.contacto.correo}.`;
  }
}

// ============================================================================================================
// Pestañas
// ============================================================================================================
const pestanas = $$<HTMLButtonElement>('[data-pestana]');
function elegirPestana(nombre: string, foco = false) {
  for (const p of pestanas) {
    const activa = p.dataset.pestana === nombre;
    p.setAttribute('aria-selected', String(activa));
    p.tabIndex = activa ? 0 : -1;
    if (activa && foco) p.focus();
  }
  for (const s of $$('[data-seccion]')) s.hidden = s.dataset.seccion !== nombre;
  history.replaceState(null, '', nombre === 'perfil' ? location.pathname : `#${nombre}`);
}
pestanas.forEach((p, i) => {
  p.addEventListener('click', () => elegirPestana(p.dataset.pestana!));
  p.addEventListener('keydown', (ev) => {
    const paso = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (!paso) return;
    ev.preventDefault();
    elegirPestana(pestanas[(i + paso + pestanas.length) % pestanas.length].dataset.pestana!, true);
  });
});

// ============================================================================================================
// Perfil
// ============================================================================================================
const formPerfil = $<HTMLFormElement>('[data-form-perfil]');
const campo = (nombre: string) => formPerfil.elements.namedItem(nombre) as HTMLInputElement;
let sucio = false;
let fotoNueva: Blob | null | undefined; // undefined = sin cambios; null = quitarla
let fotoVistaUrl = '';

function pintarFoto() {
  const img = $<HTMLImageElement>('[data-foto-img]');
  const fuente = fotoNueva ? fotoVistaUrl : fotoNueva === null ? '' : perfil.foto ? d.urlMedio(perfil.foto) : '';
  img.hidden = !fuente;
  if (fuente) img.src = fuente;
  $('[data-foto-inicial]').textContent = fuente ? '' : (campo('nombre').value.trim()[0] ?? '·').toLowerCase();
  $('[data-foto-quitar]').hidden = !fuente;
  $('[data-foto-boton]').textContent = fuente ? 'cambiar foto' : 'elegir foto';
}

function llenarPerfil() {
  for (const n of ['nombre', 'ciudad', 'abrebocas', 'bio', 'instagram', 'correo_contacto', 'youtube', 'spotify'] as const) campo(n).value = perfil[n];
  const chips = $('[data-chips]');
  chips.replaceChildren(
    ...generos.map((g) => {
      const label = document.createElement('label');
      label.className = 'chip';
      const input = Object.assign(document.createElement('input'), { type: 'checkbox', name: 'etiqueta', value: g.id, checked: perfil.etiquetas.includes(g.id) });
      label.append(input, Object.assign(document.createElement('span'), { textContent: g.nombre }));
      return label;
    }),
  );
  limitarChips();
  $('[data-colores]').replaceChildren(
    ...colores.map((c) => {
      const label = document.createElement('label');
      label.className = 'color-muestra';
      label.title = c.nombre;
      const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'color', value: c.id, checked: perfil.color === c.id });
      const mancha = Object.assign(document.createElement('span'), { className: 'color-muestra__mancha' });
      mancha.style.background = c.hex;
      label.append(input, mancha, Object.assign(document.createElement('span'), { textContent: c.nombre }));
      return label;
    }),
  );
  fotoNueva = undefined;
  pintarFoto();
  $$<HTMLElement>('[data-cuenta-de]').forEach((s) => contador(document.getElementById(s.dataset.cuentaDe!) as HTMLInputElement, s));
}

function limitarChips() {
  const todas = $$<HTMLInputElement>('input[name=etiqueta]', formPerfil);
  const llenas = todas.filter((c) => c.checked).length >= 3;
  for (const c of todas) c.disabled = llenas && !c.checked;
}

formPerfil.addEventListener('input', (ev) => {
  sucio = true;
  $('[data-guardado]').textContent = '';
  if ((ev.target as HTMLInputElement).name === 'etiqueta') limitarChips();
  if ((ev.target as HTMLInputElement).name === 'color') probarColor((ev.target as HTMLInputElement).value);
  if ((ev.target as HTMLInputElement).name === 'nombre') pintarFoto();
});

$<HTMLInputElement>('[data-foto-input]').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const archivo = input.files?.[0];
  input.value = '';
  if (!archivo) return;
  const mensaje = $('[data-mensaje]', formPerfil);
  try {
    avisar(mensaje);
    fotoNueva = await prepararImagen(archivo, 800, 1000);
    if (fotoVistaUrl) URL.revokeObjectURL(fotoVistaUrl);
    fotoVistaUrl = URL.createObjectURL(fotoNueva);
    sucio = true;
    pintarFoto();
    $('[data-guardado]').textContent = 'Foto lista: guarda el perfil para subirla.';
  } catch (e) {
    avisar(mensaje, (e as Error).message);
  }
});

$('[data-foto-quitar]').addEventListener('click', () => {
  fotoNueva = null;
  sucio = true;
  pintarFoto();
});

formPerfil.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const mensaje = $('[data-mensaje]', formPerfil);
  const boton = $<HTMLButtonElement>('[type=submit]', formPerfil);
  const instagram = limpiarInstagram(campo('instagram').value);
  const correo = campo('correo_contacto').value.trim().toLowerCase();
  const nombre = campo('nombre').value.trim();
  const youtube = limpiarYoutube(campo('youtube').value);
  const spotify = limpiarSpotify(campo('spotify').value);

  for (const n of ['nombre', 'instagram', 'correo_contacto', 'youtube', 'spotify']) campo(n).removeAttribute('aria-invalid');
  const invalido = (n: string, texto: string) => {
    campo(n).setAttribute('aria-invalid', 'true');
    campo(n).focus();
    avisar(mensaje, texto);
  };
  if (!nombre) return invalido('nombre', 'Escribe tu nombre artístico.');
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
    return invalido('instagram', 'Revisa tu usuario de Instagram: solo letras, números, puntos y guiones bajos (máximo 30).');
  }
  if (correo && !CORREO.test(correo)) return invalido('correo_contacto', 'Ese correo de contacto no parece válido.');
  if (youtube && !YOUTUBE.test(youtube)) {
    return invalido('youtube', 'Pon el enlace de tu canal de YouTube (por ejemplo, youtube.com/@tucanal), no el de un video.');
  }
  if (spotify && !SPOTIFY.test(spotify)) {
    return invalido('spotify', 'Pon el enlace de tu perfil de artista en Spotify (open.spotify.com/artist/…), no el de una canción.');
  }

  ocupado(boton, async () => {
    const anterior = perfil.foto;
    let foto = perfil.foto;
    if (fotoNueva) {
      boton.textContent = 'subiendo foto…';
      foto = await d.subir('foto', fotoNueva, (f) => (boton.textContent = `subiendo foto… ${Math.round(f * 100)} %`));
    } else if (fotoNueva === null) {
      foto = null;
    }
    boton.textContent = 'guardando…';
    perfil = await d.guardarPerfil({
      nombre,
      ciudad: campo('ciudad').value.trim(),
      abrebocas: campo('abrebocas').value.trim(),
      bio: campo('bio').value.trim(),
      etiquetas: $$<HTMLInputElement>('input[name=etiqueta]:checked', formPerfil).map((c) => c.value),
      instagram,
      correo_contacto: correo,
      youtube,
      spotify,
      foto,
      color: $<HTMLInputElement>('input[name=color]:checked', formPerfil)?.value ?? perfil.color,
    });
    if (anterior && anterior !== perfil.foto) d.borrarArchivos([anterior]).catch(() => {});
    sucio = false;
    llenarPerfil();
    pintarCabecera();
    pintarEstado();
    $('[data-guardado]').textContent = `Guardado a las ${new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
  }, mensaje);
});

addEventListener('beforeunload', (ev) => {
  if (sucio) ev.preventDefault();
});

// ============================================================================================================
// Beats
// ============================================================================================================
const lista = $<HTMLOListElement>('[data-lista-beats]');
const plantilla = $<HTMLTemplateElement>('[data-tpl-beat]');
const reproductor = $<HTMLAudioElement>('[data-reproductor]');
const formBeat = $<HTMLFormElement>('[data-form-beat]');
const selectGenero = $<HTMLSelectElement>('[data-select-genero]');
let sonando: string | null = null;

selectGenero.replaceChildren(
  Object.assign(document.createElement('option'), { value: '', textContent: 'elige uno…' }),
  ...generos.map((g) => Object.assign(document.createElement('option'), { value: g.id, textContent: g.nombre })),
);

function pintarBeats() {
  $('[data-n-beats]').textContent = String(beats.length);
  $('[data-tope]').textContent = 'El orden de esta lista es el de tu perfil.';
  $('[data-sin-beats]').hidden = beats.length > 0;
  lista.replaceChildren(
    ...beats.map((b, i) => {
      const fila = (plantilla.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
      fila.dataset.id = b.id;
      if (sonando === b.id) fila.dataset.sonando = '';
      $<HTMLImageElement>('img', fila).src = portadaDe(b);
      $('[data-titulo]', fila).textContent = b.titulo;
      $('[data-meta]', fila).textContent = `${nombreGenero.get(b.genero) ?? b.genero} · ${minutos(b.duracion)}`;
      $('[data-oculto]', fila).hidden = !b.oculto;
      const tocar = $<HTMLButtonElement>('[data-escuchar]', fila);
      tocar.setAttribute('aria-label', `${sonando === b.id ? 'Pausar' : 'Escuchar'} ${b.titulo}`);
      $('.fila-beat__icono', fila).textContent = sonando === b.id ? '❚❚' : '▶';
      tocar.addEventListener('click', () => escuchar(b));
      const arriba = $<HTMLButtonElement>('[data-arriba]', fila);
      const abajo = $<HTMLButtonElement>('[data-abajo]', fila);
      arriba.disabled = i === 0;
      abajo.disabled = i === beats.length - 1;
      arriba.addEventListener('click', () => mover(i, -1));
      abajo.addEventListener('click', () => mover(i, 1));
      $('[data-editar]', fila).addEventListener('click', () => abrirFormBeat(b));
      dosToques($<HTMLButtonElement>('[data-quitar]', fila), '¿seguro? quitar', async () => {
        await ocupado(null, async () => {
          if (reproductor.dataset.id === b.id) {
            reproductor.pause();
            reproductor.removeAttribute('src');
            delete reproductor.dataset.id;
          }
          await d.borrarBeat(b.id);
          beats = beats.filter((x) => x.id !== b.id);
          pintarBeats();
          pintarEstado();
        });
      });
      return fila;
    }),
  );
}

function escuchar(b: BeatPanel) {
  if (reproductor.dataset.id === b.id && !reproductor.paused) {
    reproductor.pause();
    return;
  }
  if (reproductor.dataset.id !== b.id) {
    reproductor.src = d.urlMedio(b.audio);
    reproductor.dataset.id = b.id;
  }
  reproductor.play().catch(() => {});
}

// El estado sale de los eventos del audio (cambiar de pista dispara "pause" y luego "play").
function pintarSonando() {
  sonando = reproductor.paused ? null : (reproductor.dataset.id ?? null);
  for (const fila of $$<HTMLLIElement>('.fila-beat', lista)) {
    const activa = fila.dataset.id === sonando;
    fila.toggleAttribute('data-sonando', activa);
    $('.fila-beat__icono', fila).textContent = activa ? '❚❚' : '▶';
    const titulo = $('[data-titulo]', fila).textContent;
    $('[data-escuchar]', fila).setAttribute('aria-label', `${activa ? 'Pausar' : 'Escuchar'} ${titulo}`);
  }
}
for (const ev of ['play', 'pause', 'ended']) reproductor.addEventListener(ev, pintarSonando);

async function mover(i: number, paso: -1 | 1) {
  const a = beats[i];
  const b = beats[i + paso];
  if (!a || !b) return;
  await ocupado(null, async () => {
    const [ordenA, ordenB] = [a.orden, b.orden === a.orden ? a.orden + paso : b.orden];
    await d.editarBeat(a.id, { orden: ordenB });
    await d.editarBeat(b.id, { orden: ordenA });
    a.orden = ordenB;
    b.orden = ordenA;
    beats.sort((x, y) => x.orden - y.orden);
    pintarBeats();
    // El foco sigue al beat movido; si llegó a un extremo, pasa a la flecha contraria.
    const filaA = lista.querySelector(`[data-id="${a.id}"]`);
    const misma = filaA?.querySelector<HTMLButtonElement>(paso < 0 ? '[data-arriba]' : '[data-abajo]');
    const contraria = filaA?.querySelector<HTMLButtonElement>(paso < 0 ? '[data-abajo]' : '[data-arriba]');
    (misma && !misma.disabled ? misma : contraria)?.focus();
  });
}

// ---------- Formulario de beat (nuevo o editar) ----------
let editando: BeatPanel | null = null;
let audioListo: { archivo: File; duracion: number; picos: number[] } | null = null;
let portadaNueva: Blob | null | undefined;
let portadaVistaUrl = '';

function pintarPortada() {
  const img = $<HTMLImageElement>('[data-portada-img]');
  const fuente = portadaNueva ? portadaVistaUrl : portadaNueva === null ? '' : editando?.portada ? d.urlMedio(editando.portada) : '';
  img.hidden = !fuente;
  if (fuente) img.src = fuente;
  $('[data-portada-quitar]').hidden = !fuente;
}

function abrirFormBeat(b: BeatPanel | null) {
  editando = b;
  audioListo = null;
  portadaNueva = undefined;
  formBeat.hidden = false;
  avisar($('[data-mensaje]', formBeat));
  $('[data-progreso]').hidden = true;
  $('[data-beat-form-titulo]').textContent = b ? `editar «${b.titulo}»` : 'nuevo beat';
  $('[data-campo-audio]').hidden = Boolean(b);
  $('[data-audio-nombre]').textContent = 'MP3, M4A o WAV, hasta 50 MB.';
  $<HTMLInputElement>('#b-titulo').value = b?.titulo ?? '';
  selectGenero.value = b?.genero ?? '';
  pintarPortada();
  formBeat.scrollIntoView({ behavior: 'smooth', block: 'start' });
  (b ? $<HTMLInputElement>('#b-titulo') : $<HTMLInputElement>('[data-audio-input]')).focus({ preventScroll: true });
}

function cerrarFormBeat() {
  formBeat.hidden = true;
  editando = null;
  audioListo = null;
}

$('[data-nuevo-beat]').addEventListener('click', () => abrirFormBeat(null));
$('[data-cancelar-beat]').addEventListener('click', cerrarFormBeat);

$<HTMLInputElement>('[data-audio-input]').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const archivo = input.files?.[0];
  const mensaje = $('[data-mensaje]', formBeat);
  const nombre = $('[data-audio-nombre]');
  audioListo = null;
  if (!archivo) return;
  nombre.textContent = `analizando ${archivo.name}…`;
  avisar(mensaje);
  try {
    const { duracion, picos } = await analizarAudio(archivo);
    audioListo = { archivo, duracion, picos };
    if (duracion > 120) {
      avisar(mensaje, `Este audio dura ${minutos(duracion)}. Puedes subirlo, pero te recomendamos subir solo un fragmento y no el beat completo.`, 'info');
    }
    nombre.textContent = `${archivo.name} · ${minutos(duracion)} · ${(archivo.size / 1024 / 1024).toFixed(1)} MB`;
    const titulo = $<HTMLInputElement>('#b-titulo');
    if (!titulo.value) {
      titulo.value = archivo.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    }
  } catch (e) {
    input.value = '';
    nombre.textContent = 'MP3, M4A o WAV, hasta 50 MB.';
    avisar(mensaje, (e as Error).message);
  }
});

$<HTMLInputElement>('[data-portada-input]').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const archivo = input.files?.[0];
  input.value = '';
  if (!archivo) return;
  try {
    portadaNueva = await prepararImagen(archivo, 600, 600);
    if (portadaVistaUrl) URL.revokeObjectURL(portadaVistaUrl);
    portadaVistaUrl = URL.createObjectURL(portadaNueva);
    pintarPortada();
  } catch (e) {
    avisar($('[data-mensaje]', formBeat), (e as Error).message);
  }
});

$('[data-portada-quitar]').addEventListener('click', () => {
  portadaNueva = null;
  pintarPortada();
});

formBeat.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const mensaje = $('[data-mensaje]', formBeat);
  const boton = $<HTMLButtonElement>('[type=submit]', formBeat);
  const titulo = $<HTMLInputElement>('#b-titulo').value.trim();
  const genero = selectGenero.value;
  if (!editando && !audioListo) return avisar(mensaje, 'Elige el archivo de audio.');
  if (!titulo) return avisar(mensaje, 'Ponle un título.');
  if (!genero) return avisar(mensaje, 'Elige un género.');

  const progreso = $('[data-progreso]');
  const barra = (texto: string, f: number) => {
    progreso.hidden = false;
    $('[data-progreso-texto]').textContent = texto;
    progreso.style.setProperty('--avance', String(f));
  };

  ocupado(boton, async () => {
    const subidos: string[] = [];
    try {
      let portada = editando?.portada ?? null;
      if (!editando && audioListo) {
        const audioRuta = await d.subir('audio', audioListo.archivo, (f) => barra(`subiendo audio… ${Math.round(f * 100)} %`, f * 0.9));
        subidos.push(audioRuta);
        if (portadaNueva) {
          barra('subiendo portada…', 0.92);
          portada = await d.subir('portada', portadaNueva);
          subidos.push(portada);
        }
        barra('guardando…', 0.97);
        const nuevo = await d.crearBeat({ titulo, genero, audio: audioRuta, portada, duracion: audioListo.duracion, picos: audioListo.picos });
        beats.push(nuevo);
      } else if (editando) {
        if (portadaNueva) {
          barra('subiendo portada…', 0.5);
          portada = await d.subir('portada', portadaNueva);
          subidos.push(portada);
        } else if (portadaNueva === null) {
          portada = null;
        }
        const anterior = editando.portada;
        const cambiado = await d.editarBeat(editando.id, { titulo, genero, portada });
        beats = beats.map((b) => (b.id === cambiado.id ? cambiado : b));
        if (anterior && anterior !== portada) d.borrarArchivos([anterior]).catch(() => {});
      }
      barra('listo', 1);
      cerrarFormBeat();
      pintarBeats();
      pintarEstado();
    } catch (e) {
      // Si falló al guardar, no se dejan archivos huérfanos en R2.
      if (subidos.length) d.borrarArchivos(subidos).catch(() => {});
      progreso.hidden = true;
      throw e;
    }
  }, mensaje);
});

// ============================================================================================================
// Cuenta
// ============================================================================================================
$('[data-correo-acceso]').textContent = sesion.correo;

const formClave = $<HTMLFormElement>('[data-form-clave]');
formClave.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const mensaje = $('[data-mensaje]', formClave);
  const clave = $<HTMLInputElement>('#c-clave').value;
  if (clave.length < 10) return avisar(mensaje, 'La contraseña debe tener al menos 10 caracteres.');
  if (clave !== $<HTMLInputElement>('#c-clave2').value) return avisar(mensaje, 'Las dos contraseñas no coinciden.');
  ocupado($<HTMLButtonElement>('[type=submit]', formClave), async () => {
    await d.cambiarClave(clave);
    formClave.reset();
    avisar(mensaje, 'Contraseña cambiada.', 'ok');
  }, mensaje);
});

const novedades = $<HTMLInputElement>('[data-novedades]');
const ultimaNovedad = aceptaciones.find((a) => a.casilla === 'novedades');
novedades.checked = ultimaNovedad?.aceptada ?? false;
const pintarNovedades = (fecha: string | null) =>
  ($('[data-novedades-estado]').textContent = fecha ? `Última elección: ${fechaCorta(fecha)}` : '');
pintarNovedades(ultimaNovedad?.fecha ?? null);
novedades.addEventListener('change', async () => {
  novedades.disabled = true;
  try {
    await d.cambiarNovedades(novedades.checked, LEGAL.version);
    pintarNovedades(new Date().toISOString());
  } catch (e) {
    novedades.checked = !novedades.checked;
    $('[data-novedades-estado]').textContent = (e as Error).message;
  } finally {
    novedades.disabled = false;
  }
});

$('[data-descargar]').addEventListener('click', async () => {
  const [p, b, a] = await Promise.all([d.miPerfil(), d.misBeats(), d.misAceptaciones()]);
  const conUrl = (ruta: string | null) => (ruta ? new URL(d.urlMedio(ruta), location.href).href : null);
  const archivo = {
    exportado: new Date().toISOString(),
    responsable: `${SITIO.responsable.nombre} (MusicMafia), ${SITIO.contacto.correo}`,
    cuenta: { correo: sesion.correo },
    perfil: p && { ...p, foto: conUrl(p.foto) },
    beats: b.map((x) => ({ ...x, audio: conUrl(x.audio), portada: conUrl(x.portada) })),
    aceptaciones: a,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(archivo, null, 2)], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: `musicmafia-${perfil.enlace}-mis-datos.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

const confirmar = $<HTMLInputElement>('[data-confirmar]');
const borrarCuenta = $<HTMLButtonElement>('[data-borrar-cuenta]');
confirmar.addEventListener('input', () => (borrarCuenta.disabled = confirmar.value.trim().toLowerCase() !== perfil.enlace));
borrarCuenta.addEventListener('click', () =>
  ocupado(borrarCuenta, async () => {
    borrarCuenta.textContent = 'borrando…';
    await d.borrarMiCuenta();
    sucio = false;
    location.replace('/ingresar?cuenta=borrada');
  }, $('[data-mensaje]', borrarCuenta.closest('.bloque')!)),
);

// ============================================================================================================
// Condiciones nuevas
// ============================================================================================================
const formReaceptar = $<HTMLFormElement>('[data-reaceptar]');
function bloquearPorCondiciones(bloquear: boolean) {
  formReaceptar.hidden = !bloquear;
  $('.pestanas').hidden = bloquear;
  for (const s of $$('[data-seccion]')) if (bloquear) s.hidden = true;
}
formReaceptar.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const mensaje = $('[data-mensaje]', formReaceptar);
  if ($$<HTMLInputElement>('input[name=casilla]', formReaceptar).some((c) => !c.checked)) {
    return avisar(mensaje, 'Para seguir tienes que marcar las cuatro casillas.');
  }
  ocupado($<HTMLButtonElement>('[type=submit]', formReaceptar), async () => {
    await d.aceptarDocumentos(LEGAL.version, novedades.checked);
    bloquearPorCondiciones(false);
    elegirPestana('perfil');
  }, mensaje);
});

// ============================================================================================================
// Arranque
// ============================================================================================================
llenarPerfil();
pintarCabecera();
pintarEstado();
pintarBeats();
$('[data-cargando]').hidden = true;
$('[data-panel]').hidden = false;

if (terminos!.version !== LEGAL.version) {
  bloquearPorCondiciones(true);
} else {
  const inicio = location.hash.slice(1);
  elegirPestana(['perfil', 'beats', 'cuenta'].includes(inicio) ? inicio : 'perfil');
}
