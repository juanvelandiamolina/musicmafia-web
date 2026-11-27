// Lógica de la administración (src/pages/admin.astro).
import { contrasteConNegro, datos, enlaceDesde, NOMBRES_ESTADO, type Estado, type FilaAdmin, type GeneroAdmin } from './datos';
import { $, $$, avisar, detener, dosToques, exigirSesion, fechaCorta, minutos, ocupado } from './ui';
import { SITIO } from '../../lib/sitio';

const d = await datos();
await exigirSesion(() => d.sesion());
if (!(await d.esAdmin())) {
  location.replace('/panel');
  await detener();
}

/** Nombre de cada género, para mostrar los beats. Se rehace al crear o quitar géneros. */
let generos = new Map<string, string>();
const reproductor = $<HTMLAudioElement>('[data-reproductor]');
let filas: FilaAdmin[] = [];
let filtro = '';

// ============================================================================================================
// Invitar
// ============================================================================================================
const formInvitar = $<HTMLFormElement>('[data-form-invitar]');
const iNombre = $<HTMLInputElement>('#i-nombre');
const iCorreo = $<HTMLInputElement>('#i-correo');
const iEnlace = $<HTMLInputElement>('#i-enlace');
const estadoEnlace = $('[data-enlace-estado]');
let enlaceTocado = false;
let reloj = 0;
let enlaceOk = false;

async function comprobarEnlace() {
  const e = iEnlace.value.trim();
  enlaceOk = false;
  if (!e) {
    estadoEnlace.textContent = 'Minúsculas, números y guiones. Es el enlace que pondrá en su bio.';
    return;
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,28}[a-z0-9])?$/.test(e) || e.includes('--')) {
    estadoEnlace.textContent = 'Solo minúsculas, números y guiones sueltos; sin guion al principio ni al final.';
    return;
  }
  estadoEnlace.textContent = 'comprobando…';
  enlaceOk = await d.enlaceLibre(e).catch(() => false);
  if (iEnlace.value.trim() !== e) return;
  estadoEnlace.textContent = enlaceOk ? `✓ ${SITIO.dominio}/${e} está libre.` : `✗ ${SITIO.dominio}/${e} ya está en uso o lo usa la web.`;
}
const programarComprobacion = () => {
  clearTimeout(reloj);
  reloj = window.setTimeout(comprobarEnlace, 350);
};

iNombre.addEventListener('input', () => {
  if (enlaceTocado) return;
  iEnlace.value = enlaceDesde(iNombre.value);
  programarComprobacion();
});
iEnlace.addEventListener('input', () => {
  enlaceTocado = iEnlace.value !== '';
  iEnlace.value = iEnlace.value.toLowerCase().replace(/\s+/g, '-');
  programarComprobacion();
});

formInvitar.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const mensaje = $('[data-mensaje]', formInvitar);
  const nombre = iNombre.value.trim();
  const correo = iCorreo.value.trim().toLowerCase();
  const enlace = iEnlace.value.trim();
  if (!nombre) return avisar(mensaje, 'Escribe su nombre artístico.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return avisar(mensaje, 'Ese correo no parece válido.');
  ocupado($<HTMLButtonElement>('[type=submit]', formInvitar), async () => {
    await comprobarEnlace();
    if (!enlaceOk) throw new Error('Elige otro enlace: ese no está disponible.');
    const enlaceEnsayo = await d.invitar(correo, nombre, enlace);
    formInvitar.reset();
    enlaceTocado = false;
    estadoEnlace.textContent = 'Minúsculas, números y guiones. Es el enlace que pondrá en su bio.';
    avisar(mensaje, `Invitación enviada a ${correo}. El enlace vence en 24 horas.`, 'ok');
    if (enlaceEnsayo) {
      mensaje.append(' En ensayo no se mandan correos: ');
      mensaje.append(Object.assign(document.createElement('a'), { href: enlaceEnsayo, textContent: 'abrir su enlace de activación' }), '.');
    }
    await cargar();
  }, mensaje);
});

// ============================================================================================================
// Productores
// ============================================================================================================
const lista = $<HTMLUListElement>('[data-filas]');
const plantilla = $<HTMLTemplateElement>('[data-tpl-fila]');

type Accion = { texto: string; estado: Estado; pideNota?: boolean; clase?: string };
const ACCIONES: Record<Estado, Accion[]> = {
  en_revision: [
    { texto: 'publicar', estado: 'publicado' },
    { texto: 'devolver con una nota', estado: 'borrador', pideNota: true, clase: 'boton--secundario' },
    { texto: 'retirar', estado: 'retirado', pideNota: true, clase: 'boton--secundario' },
  ],
  borrador: [
    { texto: 'publicar ya', estado: 'publicado', clase: 'boton--secundario' },
    { texto: 'retirar', estado: 'retirado', pideNota: true, clase: 'boton--secundario' },
  ],
  publicado: [
    { texto: 'retirar de la web', estado: 'retirado', pideNota: true, clase: 'boton--secundario' },
    { texto: 'pasar a sin publicar', estado: 'borrador', pideNota: true, clase: 'boton--secundario' },
  ],
  retirado: [
    { texto: 'publicar', estado: 'publicado', clase: 'boton--secundario' },
    { texto: 'pasar a sin publicar', estado: 'borrador', pideNota: true, clase: 'boton--secundario' },
  ],
};

function pintarFiltros() {
  const cuantos = (e: string) => (e ? filas.filter((f) => f.estado === e).length : filas.length);
  for (const b of $$<HTMLButtonElement>('[data-filtro]')) {
    const e = b.dataset.filtro ?? '';
    b.setAttribute('aria-pressed', String(e === filtro));
    b.textContent = `${b.textContent!.replace(/\s\(\d+\)$/, '')} (${cuantos(e)})`;
  }
}

function pintarFilas() {
  const visibles = filas.filter((f) => !filtro || f.estado === filtro);
  // En revisión primero: es lo que espera una decisión.
  visibles.sort((a, b) => Number(b.estado === 'en_revision') - Number(a.estado === 'en_revision'));
  $('[data-vacio]').hidden = visibles.length > 0;
  lista.replaceChildren(...visibles.map(fila));
  pintarFiltros();
}

function fila(f: FilaAdmin): HTMLLIElement {
  const li = (plantilla.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
  const mensaje = $('[data-mensaje]', li);
  $('[data-nombre]', li).textContent = f.nombre.toLowerCase();
  const enlace = $<HTMLAnchorElement>('[data-enlace]', li);
  enlace.textContent = `/${f.enlace}`;
  enlace.href = `/${f.enlace}`;
  $('[data-correo]', li).textContent = f.correo;
  const estado = $('[data-estado]', li);
  estado.textContent = NOMBRES_ESTADO[f.estado];
  estado.dataset.de = f.estado;
  $('[data-meta]', li).textContent = [
    `invitado ${fechaCorta(f.invitado)}`,
    f.activo ? 'cuenta activada' : 'aún no activa su cuenta',
    `${f.beats} ${f.beats === 1 ? 'beat' : 'beats'}${f.ocultos ? ` (${f.ocultos} ocultos)` : ''}`,
    `última entrada: ${fechaCorta(f.ultima_entrada)}`,
    f.publicado_en ? `publicado desde ${fechaCorta(f.publicado_en)}` : '',
  ].filter(Boolean).join(' · ');
  avisar($('[data-nota]', li), f.nota ? `Nota enviada: ${f.nota}` : '', 'info');

  const acciones = $('[data-acciones]', li);
  const formNota = $<HTMLFormElement>('[data-form-nota]', li);
  let pendiente: Accion | null = null;

  const cambiar = async (a: Accion, nota: string, boton: HTMLButtonElement) =>
    ocupado(boton, async () => {
      await d.cambiarEstado(f.id, a.estado, nota);
      await cargar();
    }, mensaje);

  for (const a of ACCIONES[f.estado]) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: `boton boton--chico ${a.clase ?? ''}`, textContent: a.texto });
    b.addEventListener('click', () => {
      if (!a.pideNota) return cambiar(a, '', b);
      pendiente = a;
      formNota.hidden = false;
      $('[data-nota-etiqueta]', formNota).textContent = `nota para ${f.nombre} (${a.texto})`;
      $<HTMLTextAreaElement>('[data-nota-texto]', formNota).focus();
    });
    acciones.append(b);
  }

  const verBeats = Object.assign(document.createElement('button'), { type: 'button', className: 'boton boton--secundario boton--chico', textContent: 'ver beats' });
  verBeats.setAttribute('aria-expanded', 'false');
  verBeats.addEventListener('click', () => alternarBeats(f, li, verBeats));
  acciones.append(verBeats);

  formNota.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (pendiente) cambiar(pendiente, $<HTMLTextAreaElement>('[data-nota-texto]', formNota).value.trim(), $<HTMLButtonElement>('[data-nota-confirmar]', formNota));
  });
  $('[data-nota-cancelar]', formNota).addEventListener('click', () => {
    formNota.hidden = true;
    pendiente = null;
  });
  return li;
}

async function alternarBeats(f: FilaAdmin, li: HTMLLIElement, boton: HTMLButtonElement) {
  const caja = $('[data-beats]', li);
  const abrir = caja.hidden;
  boton.setAttribute('aria-expanded', String(abrir));
  boton.textContent = abrir ? 'ocultar beats' : 'ver beats';
  caja.hidden = !abrir;
  if (!abrir) return;
  caja.textContent = 'cargando…';
  const beats = await d.adminBeatsDe(f.id).catch((e: Error) => {
    caja.textContent = e.message;
    return null;
  });
  if (!beats) return;
  if (!beats.length) {
    caja.textContent = 'Todavía no tiene beats.';
    return;
  }
  caja.replaceChildren(
    ...beats.map((b) => {
      const fila = document.createElement('div');
      fila.className = 'beat-admin';
      fila.toggleAttribute('data-oculto', b.oculto);
      const img = Object.assign(document.createElement('img'), { src: b.portada ? d.urlMedio(b.portada) : '/portada-generica.svg', alt: '' });
      const titulo = document.createElement('p');
      titulo.className = 'beat-admin__titulo';
      titulo.append(b.titulo, Object.assign(document.createElement('small'), { textContent: `${generos.get(b.genero) ?? b.genero} · ${minutos(b.duracion)}${b.oculto ? ' · oculto' : ''}` }));
      const acciones = document.createElement('div');
      acciones.className = 'acciones';
      const oir = Object.assign(document.createElement('button'), { type: 'button', className: 'boton boton--secundario boton--chico', textContent: 'escuchar' });
      oir.addEventListener('click', () => {
        if (reproductor.dataset.id === b.id && !reproductor.paused) return reproductor.pause();
        if (reproductor.dataset.id !== b.id) {
          reproductor.src = d.urlMedio(b.audio);
          reproductor.dataset.id = b.id;
        }
        reproductor.play().catch(() => {});
      });
      const ocultar = Object.assign(document.createElement('button'), { type: 'button', className: 'boton boton--secundario boton--chico', textContent: b.oculto ? 'volver a mostrar' : 'ocultar' });
      ocultar.addEventListener('click', () =>
        ocupado(ocultar, async () => {
          await d.ocultarBeat(b.id, !b.oculto);
          b.oculto = !b.oculto;
          fila.toggleAttribute('data-oculto', b.oculto);
          ocultar.textContent = b.oculto ? 'volver a mostrar' : 'ocultar';
          titulo.querySelector('small')!.textContent = `${generos.get(b.genero) ?? b.genero} · ${minutos(b.duracion)}${b.oculto ? ' · oculto' : ''}`;
          f.ocultos += b.oculto ? 1 : -1;
        }, $('[data-mensaje]', li)),
      );
      acciones.append(oir, ocultar);
      fila.append(img, titulo, acciones);
      return fila;
    }),
  );
}

for (const b of $$<HTMLButtonElement>('[data-filtro]')) {
  b.addEventListener('click', () => {
    filtro = b.dataset.filtro ?? '';
    pintarFilas();
  });
}

// ============================================================================================================
// Géneros
// ============================================================================================================
const listaGeneros = $<HTMLUListElement>('[data-generos]');
const plantillaGenero = $<HTMLTemplateElement>('[data-tpl-genero]');
const formGenero = $<HTMLFormElement>('[data-form-genero]');
const mensajeGeneros = $('[data-mensaje-generos]');

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

async function cargarGeneros() {
  const todos = await d.adminGeneros();
  generos = new Map(todos.map((g) => [g.id, g.nombre]));
  listaGeneros.replaceChildren(...todos.map((g) => filaGenero(g, todos)));
}

function filaGenero(g: GeneroAdmin, todos: GeneroAdmin[]): HTMLLIElement {
  const li = (plantillaGenero.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
  $('[data-nombre]', li).textContent = g.nombre;
  $('[data-uso]', li).textContent =
    g.beats || g.perfiles ? `${plural(g.beats, 'beat', 'beats')} · ${plural(g.perfiles, 'perfil', 'perfiles')}` : 'sin usar';
  const quitar = $<HTMLButtonElement>('[data-quitar]', li);
  quitar.setAttribute('aria-label', `Quitar el género ${g.nombre}`);
  const formPasar = $<HTMLFormElement>('[data-form-pasar]', li);
  const otros = todos.filter((x) => x.id !== g.id);

  const hecho = async (texto: string) => {
    await Promise.all([cargarGeneros(), cargar()]);
    avisar(mensajeGeneros, texto, 'ok');
  };

  if (todos.length <= 1) {
    quitar.disabled = true;
    quitar.title = 'Tiene que quedar al menos un género.';
  } else if (g.beats === 0) {
    // Sin beats: se quita con dos toques; los perfiles que lo tenían como estilo solo lo pierden.
    dosToques(quitar, '¿seguro? quitar', () =>
      ocupado(quitar, async () => {
        await d.quitarGenero(g.id);
        await hecho(`Quitaste «${g.nombre}».`);
      }, mensajeGeneros),
    );
  } else {
    // Con beats: hay que decir a qué género pasarlos.
    $('[data-pasar-etiqueta]', formPasar).textContent = `«${g.nombre}» tiene ${plural(g.beats, 'beat', 'beats')}. ¿A qué género los pasamos?`;
    const select = $<HTMLSelectElement>('[data-pasar-a]', formPasar);
    select.replaceChildren(...otros.map((x) => Object.assign(document.createElement('option'), { value: x.id, textContent: x.nombre })));
    const id = `pasar-${g.id}`;
    select.id = id;
    $('[data-pasar-etiqueta]', formPasar).setAttribute('for', id);
    quitar.addEventListener('click', () => {
      formPasar.hidden = false;
      select.focus();
    });
    $('[data-cancelar]', formPasar).addEventListener('click', () => (formPasar.hidden = true));
    formPasar.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const destino = otros.find((x) => x.id === select.value);
      if (!destino) return;
      ocupado($<HTMLButtonElement>('[type=submit]', formPasar), async () => {
        await d.quitarGenero(g.id, destino.id);
        await hecho(`Quitaste «${g.nombre}» y sus beats pasaron a «${destino.nombre}».`);
      }, mensajeGeneros);
    });
  }
  return li;
}

formGenero.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const campo = $<HTMLInputElement>('#g-nombre');
  const nombre = campo.value.trim();
  if (nombre.length < 2) return avisar(mensajeGeneros, 'Escribe el nombre del género (al menos 2 letras).');
  ocupado($<HTMLButtonElement>('[type=submit]', formGenero), async () => {
    await d.crearGenero(nombre);
    campo.value = '';
    await cargarGeneros();
    avisar(mensajeGeneros, `Listo: «${nombre}» ya aparece en los paneles de los productores.`, 'ok');
  }, mensajeGeneros);
});

// ============================================================================================================
// Colores
// ============================================================================================================
const listaColores = $<HTMLUListElement>('[data-colores-admin]');
const plantillaColor = $<HTMLTemplateElement>('[data-tpl-color]');
const formColor = $<HTMLFormElement>('[data-form-color]');
const mensajeColores = $('[data-mensaje-colores]');
const campoHex = $<HTMLInputElement>('#c-hex');

async function cargarColores() {
  const todos = await d.adminColores();
  listaColores.replaceChildren(
    ...todos.map((c) => {
      const li = (plantillaColor.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
      $('[data-mancha]', li).style.background = c.hex;
      $('[data-nombre]', li).textContent = c.nombre;
      $('[data-uso]', li).textContent = c.perfiles ? plural(c.perfiles, 'perfil', 'perfiles') : 'sin usar';
      const quitar = $<HTMLButtonElement>('[data-quitar]', li);
      quitar.setAttribute('aria-label', `Quitar el color ${c.nombre}`);
      if (todos.length <= 1) {
        quitar.disabled = true;
        quitar.title = 'Tiene que quedar al menos un color.';
      } else {
        dosToques(quitar, c.perfiles ? '¿seguro? vuelven al rojo' : '¿seguro? quitar', () =>
          ocupado(quitar, async () => {
            await d.quitarColor(c.id);
            await Promise.all([cargarColores(), cargar()]);
            avisar(mensajeColores, c.perfiles
              ? `Quitaste «${c.nombre}»: ${plural(c.perfiles, 'perfil vuelve', 'perfiles vuelven')} al rojo de MusicMafia.`
              : `Quitaste «${c.nombre}».`, 'ok');
          }, mensajeColores),
        );
      }
      return li;
    }),
  );
}

// Muestra en vivo si el texto negro se lee sobre el color elegido.
function probarColorNuevo() {
  const hex = campoHex.value;
  const salida = $('[data-prueba-color]');
  const muestra = Object.assign(document.createElement('span'), { textContent: 'así se ve el texto' });
  muestra.style.background = hex;
  const legible = contrasteConNegro(hex) >= 4.5;
  salida.replaceChildren(muestra, legible ? '✓ se lee bien' : '✗ muy oscuro: el texto negro no se leería encima');
}
campoHex.addEventListener('input', probarColorNuevo);
probarColorNuevo();

formColor.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const campo = $<HTMLInputElement>('#c-nombre');
  const nombre = campo.value.trim();
  if (nombre.length < 2) return avisar(mensajeColores, 'Ponle un nombre al color (al menos 2 letras).');
  if (contrasteConNegro(campoHex.value) < 4.5) {
    return avisar(mensajeColores, 'Ese color es muy oscuro: el texto negro no se leería encima. Elige uno más claro.');
  }
  ocupado($<HTMLButtonElement>('[type=submit]', formColor), async () => {
    await d.crearColor(nombre, campoHex.value);
    campo.value = '';
    await cargarColores();
    avisar(mensajeColores, `Listo: «${nombre}» ya aparece en los paneles de los productores.`, 'ok');
  }, mensajeColores);
});

// ============================================================================================================
// La web
// ============================================================================================================
async function pintarWeb() {
  const p = await d.publicacion();
  const dl = $('[data-web]');
  const fila = (dt: string, dd: string) => [
    Object.assign(document.createElement('dt'), { textContent: dt }),
    Object.assign(document.createElement('dd'), { textContent: dd }),
  ];
  dl.replaceChildren(
    ...fila('último cambio publicado', fechaCorta(p.ultimo_cambio)),
    ...fila('última actualización', fechaCorta(p.ultima_reconstruccion)),
    ...fila('actualizaciones', String(p.reconstrucciones)),
  );
}

$('[data-reconstruir]').addEventListener('click', (ev) =>
  ocupado(ev.currentTarget as HTMLButtonElement, async () => {
    await d.reconstruir();
    const m = $('[data-mensaje]', $('[data-web]').parentElement!);
    avisar(m, d.modo === 'ensayo' ? 'En ensayo no hay web que actualizar; queda anotado.' : 'Listo: la web se actualiza en un par de minutos.', 'ok');
    await pintarWeb();
  }, $('[data-mensaje]', $('[data-web]').parentElement!)),
);

// ============================================================================================================
// Arranque
// ============================================================================================================
async function cargar() {
  filas = await d.adminProductores();
  pintarFilas();
  await pintarWeb();
}

await Promise.all([cargarGeneros(), cargarColores(), cargar()]);
$('[data-cargando]').hidden = true;
$('[data-admin]').hidden = false;
