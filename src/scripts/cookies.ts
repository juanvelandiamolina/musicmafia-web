// Aviso de cookies: guarda la elección del visitante y solo carga la medición de visitas si la permite.
// La elección vive en localStorage (clave mm-consentimiento) y caduca a los 12 meses.

interface Eleccion {
  version: number;
  medicion: boolean;
  fecha: string;
}

const panel = document.querySelector<HTMLElement>('[data-cookies]');
if (panel) iniciar(panel);

function iniciar(panel: HTMLElement) {
  const clave = panel.dataset.clave ?? 'mm-consentimiento';
  const version = Number(panel.dataset.version ?? 1);
  const dias = Number(panel.dataset.dias ?? 365);
  const token = panel.dataset.token ?? '';

  const leer = (): Eleccion | null => {
    try {
      const e = JSON.parse(localStorage.getItem(clave) ?? 'null') as Eleccion | null;
      if (!e || e.version !== version) return null;
      if (Date.now() - Date.parse(e.fecha) > dias * 86_400_000) return null;
      return e;
    } catch {
      return null;
    }
  };

  let eleccion = leer();
  pintarEstado(eleccion);
  if (eleccion?.medicion) cargarMedicion(token);
  if (!eleccion) panel.hidden = false;

  for (const boton of panel.querySelectorAll<HTMLButtonElement>('[data-eleccion]')) {
    boton.addEventListener('click', () => {
      const medicion = boton.dataset.eleccion === 'medicion';
      const yaMedia = eleccion?.medicion === true;
      eleccion = { version, medicion, fecha: new Date().toISOString() };
      try {
        localStorage.setItem(clave, JSON.stringify(eleccion));
      } catch {
        /* almacenamiento bloqueado: la elección vale solo para esta página */
      }
      panel.hidden = true;
      pintarEstado(eleccion);
      if (medicion) cargarMedicion(token);
      else if (yaMedia) location.reload(); // la medición ya cargada solo se detiene recargando
    });
  }

  // Cualquier botón con data-abrir-cookies (pie de página, política de cookies) vuelve a mostrar el aviso.
  document.addEventListener('click', (ev) => {
    if (!(ev.target instanceof Element) || !ev.target.closest('[data-abrir-cookies]')) return;
    panel.hidden = false;
    panel.querySelector<HTMLButtonElement>('[data-eleccion]')?.focus();
  });
}

function pintarEstado(e: Eleccion | null) {
  const texto = !e
    ? 'Todavía no has elegido. Mientras tanto, no se mide nada.'
    : e.medicion
      ? 'Permitiste la medición anónima de visitas.'
      : 'Elegiste solo lo esencial. No se mide nada.';
  for (const el of document.querySelectorAll('[data-estado-cookies]')) el.textContent = texto;
}

function cargarMedicion(token: string) {
  if (!token || document.querySelector('script[data-cf-beacon]')) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token });
  document.head.append(s);
}
