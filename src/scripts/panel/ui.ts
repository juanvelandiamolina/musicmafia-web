// Pequeñas ayudas compartidas por las páginas del panel.

export const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel)!;
export const $$ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => [...raiz.querySelectorAll<T>(sel)];

/** Muestra un aviso en un elemento [data-mensaje]. Sin texto, lo oculta. */
export function avisar(el: HTMLElement, texto = '', tipo: 'error' | 'ok' | 'info' = 'error') {
  el.textContent = texto;
  el.hidden = !texto;
  el.dataset.tipo = tipo;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

/** Ejecuta una acción con el botón ocupado; si falla, muestra el error donde se pida. */
export async function ocupado<T>(boton: HTMLButtonElement | null, accion: () => Promise<T>, mensaje?: HTMLElement): Promise<T | undefined> {
  const texto = boton?.textContent;
  if (boton) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
  }
  if (mensaje) avisar(mensaje);
  try {
    return await accion();
  } catch (e) {
    if (mensaje) avisar(mensaje, (e as Error).message);
    else alert((e as Error).message);
    return undefined;
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
      if (texto !== undefined && boton.textContent !== texto && boton.dataset.mantener === undefined) boton.textContent = texto;
    }
  }
}

/**
 * Botón de dos toques para acciones que no se deshacen: el primero pide confirmación ("¿seguro?"),
 * el segundo ejecuta. Si no se confirma en 4 segundos, vuelve a su estado.
 */
export function dosToques(boton: HTMLButtonElement, confirmar: string, accion: () => void) {
  const original = boton.textContent ?? '';
  let reloj = 0;
  boton.addEventListener('click', () => {
    if (boton.dataset.armado) {
      clearTimeout(reloj);
      delete boton.dataset.armado;
      boton.textContent = original;
      accion();
      return;
    }
    boton.dataset.armado = '1';
    boton.textContent = confirmar;
    reloj = window.setTimeout(() => {
      delete boton.dataset.armado;
      boton.textContent = original;
    }, 4000);
  });
}

export const fechaCorta = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso))
    : 'nunca';

export const minutos = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Contador de caracteres para un campo con maxlength: "23 / 140". */
export function contador(campo: HTMLInputElement | HTMLTextAreaElement, salida: HTMLElement) {
  const pintar = () => (salida.textContent = `${campo.value.length} / ${campo.maxLength}`);
  campo.addEventListener('input', pintar);
  pintar();
  return pintar;
}

/** Detiene el script sin ensuciar la consola (por ejemplo, mientras el navegador se va a otra página). */
export const detener = (): Promise<never> => new Promise(() => {});

/** Redirige si no hay sesión; devuelve la sesión si la hay. */
export async function exigirSesion<T>(sesion: () => Promise<T | null>): Promise<T> {
  const s = await sesion();
  if (!s) {
    location.replace(`/ingresar?volver=${encodeURIComponent(location.pathname)}`);
    return detener();
  }
  return s;
}
