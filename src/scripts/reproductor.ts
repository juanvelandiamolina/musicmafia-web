// Reproductor del perfil: un solo <audio> para toda la página, así nunca suenan dos beats a la vez.
// Lee todo del HTML (data-*), de modo que funciona igual con datos de ejemplo o con los de Supabase.

const fmt = (s: number) => {
  const t = Number.isFinite(s) && s > 0 ? s : 0;
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};
const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel);

const lista = $<HTMLOListElement>('[data-beats]');
if (lista) iniciar(lista);
iniciarCopiar();

function iniciar(lista: HTMLOListElement) {
  const filas = [...lista.querySelectorAll<HTMLLIElement>('[data-beat]')];
  const autor = lista.dataset.autor ?? '';
  const audio = new Audio();
  audio.preload = 'metadata';
  let actual: HTMLLIElement | null = null;
  let raf = 0;

  const barra = $<HTMLElement>('[data-barra]')!;
  const b = {
    titulo: $('[data-b-titulo]', barra)!,
    autor: $('[data-b-autor]', barra)!,
    portada: $<HTMLImageElement>('[data-b-portada]', barra)!,
    actual: $('[data-b-actual]', barra)!,
    total: $('[data-b-total]', barra)!,
    progreso: $('[data-b-progreso]', barra)!,
    tocar: $<HTMLButtonElement>('[data-b-tocar]', barra)!,
  };

  const duracion = () =>
    Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(actual?.dataset.duracion ?? 0);
  const visibles = () => filas.filter((f) => !f.hidden);

  function pintar() {
    if (!actual) return;
    const d = duracion();
    const t = audio.currentTime;
    const p = d ? Math.min(1, t / d) : 0;
    for (const el of [$('[data-onda]', actual)!, b.progreso]) {
      el.style.setProperty('--p', String(p));
      el.setAttribute('aria-valuemax', String(Math.round(d)));
      el.setAttribute('aria-valuenow', String(Math.round(t)));
      el.setAttribute('aria-valuetext', `${fmt(t)} de ${fmt(d)}`);
    }
    $('[data-actual]', actual)!.textContent = fmt(t);
    b.actual.textContent = fmt(t);
    b.total.textContent = fmt(d);
  }

  const bucle = () => {
    pintar();
    if (!audio.paused) raf = requestAnimationFrame(bucle);
  };

  function estado() {
    const sonando = !audio.paused && !audio.ended;
    for (const f of filas) {
      const esta = f === actual;
      if (esta) f.dataset.estado = sonando ? 'sonando' : 'pausa';
      else delete f.dataset.estado;
      $('[data-tocar]', f)!.setAttribute('aria-label', `${esta && sonando ? 'Pausar' : 'Reproducir'} ${f.dataset.titulo}`);
    }
    b.tocar.dataset.estado = sonando ? 'sonando' : 'pausa';
    b.tocar.setAttribute('aria-label', sonando ? 'Pausar' : 'Reproducir');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = actual ? (sonando ? 'playing' : 'paused') : 'none';
  }

  function cargar(f: HTMLLIElement) {
    actual?.classList.remove('beat--activa');
    actual = f;
    f.classList.add('beat--activa');
    audio.src = f.dataset.audio!;
    barra.hidden = false;
    document.body.classList.add('con-barra');
    b.titulo.textContent = f.dataset.titulo ?? '';
    b.autor.textContent = autor;
    b.portada.src = f.dataset.portada ?? '';
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: f.dataset.titulo,
        artist: autor,
        album: 'MusicMafia',
        artwork: [{ src: new URL(f.dataset.portada ?? '', location.href).href, sizes: '600x600' }],
      });
    }
    pintar();
    estado();
  }

  const reproducir = () => audio.play().catch(() => estado());

  function tocar(f: HTMLLIElement) {
    if (f !== actual) {
      cargar(f);
      reproducir();
    } else if (audio.paused) reproducir();
    else audio.pause();
  }

  function saltar(dir: 1 | -1) {
    const v = visibles();
    if (!v.length) return;
    if (dir === -1 && audio.currentTime > 3) return buscar(0);
    const i = actual ? v.indexOf(actual) : -1;
    const sig = i === -1 ? v[0] : v[(i + dir + v.length) % v.length];
    cargar(sig);
    reproducir();
  }

  function buscar(t: number) {
    if (!actual) return;
    const d = duracion();
    audio.currentTime = Math.max(0, Math.min(Math.max(0, d - 0.05), t));
    pintar();
  }

  // Onda de cada fila y barra inferior: se arrastran con el dedo o el ratón, o con las flechas del teclado.
  function deslizador(el: HTMLElement, activo: () => boolean) {
    const proporcion = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    };
    el.addEventListener('pointerdown', (e) => {
      if (!activo() || e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      buscar(proporcion(e) * duracion());
    });
    el.addEventListener('pointermove', (e) => {
      if (el.hasPointerCapture(e.pointerId)) buscar(proporcion(e) * duracion());
    });
    el.addEventListener('keydown', (e) => {
      if (!activo()) return;
      const pasos: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 10, PageDown: -10 };
      if (e.key in pasos) buscar(audio.currentTime + pasos[e.key]);
      else if (e.key === 'Home') buscar(0);
      else if (e.key === 'End') buscar(duracion());
      else return;
      e.preventDefault();
    });
  }

  for (const f of filas) {
    $('[data-tocar]', f)!.addEventListener('click', () => tocar(f));
    deslizador($('[data-onda]', f)!, () => f === actual);
  }
  deslizador(b.progreso, () => actual !== null);

  b.tocar.addEventListener('click', () => actual && tocar(actual));
  $('[data-b-atras]', barra)!.addEventListener('click', () => buscar(audio.currentTime - 10));
  $('[data-b-adelante]', barra)!.addEventListener('click', () => buscar(audio.currentTime + 10));
  $('[data-b-anterior]', barra)!.addEventListener('click', () => saltar(-1));
  $('[data-b-siguiente]', barra)!.addEventListener('click', () => saltar(1));

  audio.addEventListener('play', () => {
    estado();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(bucle);
  });
  audio.addEventListener('pause', () => {
    estado();
    pintar();
  });
  audio.addEventListener('loadedmetadata', pintar);
  audio.addEventListener('seeked', pintar);
  // Respaldo: con la pestaña en segundo plano no hay requestAnimationFrame, pero timeupdate sigue llegando.
  audio.addEventListener('timeupdate', pintar);
  audio.addEventListener('ended', () => {
    // Al terminar pasa al siguiente beat de la lista visible; al final de la lista, se detiene.
    const v = visibles();
    const i = actual ? v.indexOf(actual) : -1;
    if (i >= 0 && i < v.length - 1) {
      cargar(v[i + 1]);
      reproducir();
    } else {
      estado();
      pintar();
    }
  });

  if ('mediaSession' in navigator) {
    const acciones: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => reproducir()],
      ['pause', () => audio.pause()],
      ['previoustrack', () => saltar(-1)],
      ['nexttrack', () => saltar(1)],
      ['seekbackward', (d) => buscar(audio.currentTime - (d.seekOffset ?? 10))],
      ['seekforward', (d) => buscar(audio.currentTime + (d.seekOffset ?? 10))],
      ['seekto', (d) => buscar(d.seekTime ?? 0)],
    ];
    for (const [accion, fn] of acciones) {
      try {
        navigator.mediaSession.setActionHandler(accion, fn);
      } catch {
        /* acción no soportada por este navegador */
      }
    }
  }

  // Filtro por género (panel del centro). Queda en la URL: /nocturno?genero=trap
  const filtros = [...document.querySelectorAll<HTMLButtonElement>('[data-filtro]')];
  const cuenta = $('[data-cuenta]');
  const plural = (n: number) => `${n} ${n === 1 ? 'beat' : 'beats'}`;

  function filtrar(g: string) {
    for (const bt of filtros) bt.setAttribute('aria-pressed', String(bt.dataset.filtro === g));
    let n = 0;
    for (const f of filas) {
      const entra = !g || f.dataset.genero === g;
      f.hidden = !entra;
      if (entra) n++;
    }
    if (cuenta) cuenta.textContent = g ? `${n} de ${plural(filas.length)}` : plural(filas.length);
    const url = new URL(location.href);
    if (g) url.searchParams.set('genero', g);
    else url.searchParams.delete('genero');
    history.replaceState(history.state, '', url);
  }

  for (const bt of filtros) bt.addEventListener('click', () => filtrar(bt.dataset.filtro ?? ''));
  const inicial = new URLSearchParams(location.search).get('genero');
  if (inicial && filtros.some((bt) => bt.dataset.filtro === inicial)) filtrar(inicial);
}

function iniciarCopiar() {
  for (const bt of document.querySelectorAll<HTMLButtonElement>('[data-copiar]')) {
    const texto = $('[data-copiar-texto]', bt);
    const original = texto?.textContent ?? '';
    let espera = 0;
    bt.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bt.dataset.copiar ?? '');
        bt.dataset.copiado = '';
        if (texto) texto.textContent = 'Enlace copiado';
      } catch {
        if (texto) texto.textContent = 'Cópialo de la barra de direcciones';
      }
      clearTimeout(espera);
      espera = window.setTimeout(() => {
        delete bt.dataset.copiado;
        if (texto) texto.textContent = original;
      }, 2400);
    });
  }
}
