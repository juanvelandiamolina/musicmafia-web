// Arte de ejemplo en clave fanzine: rojo, negro y papel, con grano de fotocopia.
// Lo usa genera-demo.mjs. Las portadas y fotos reales las subirá cada productor.

export const ROJO = '#E52420';
const TINTA = '#0B0B0B';

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function semilla(n) { let s = (n >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const n1 = (x) => Math.round(x * 10) / 10;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Estrella de cinco puntas cortada a mano: puntas desiguales y giro libre. */
export function estrella(R, cx, cy, radio, { puntas = 5, interior = 0.42, desorden = 0.18, giro = R() * 360 } = {}) {
  const pts = [];
  for (let i = 0; i < puntas * 2; i++) {
    const ext = i % 2 === 0;
    const r = radio * (ext ? 1 - desorden / 2 + R() * desorden : interior * (0.85 + R() * 0.3));
    const a = ((giro + (i * 180) / puntas + (R() - 0.5) * 6) * Math.PI) / 180;
    pts.push(`${n1(cx + r * Math.sin(a))} ${n1(cy - r * Math.cos(a))}`);
  }
  return `M${pts.join('L')}Z`;
}

/** Destello de cuatro puntas curvas, como el de "visual noise". */
function destello(cx, cy, r, giro = 0) {
  const p = [];
  for (let i = 0; i < 4; i++) {
    const a = ((giro + i * 90) * Math.PI) / 180, b = ((giro + i * 90 + 45) * Math.PI) / 180;
    p.push([cx + r * Math.sin(a), cy - r * Math.cos(a)], [cx + r * 0.16 * Math.sin(b), cy - r * 0.16 * Math.cos(b)]);
  }
  return `M${p.map(([x, y]) => `${n1(x)} ${n1(y)}`).join('L')}Z`;
}

// Fotocopia: suma ruido a la imagen en grises y la corta a dos tintas (negro y papel).
function filtroFotocopia(id, seed, grano = 0.55) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${grano}" numOctaves="2" seed="${seed}" result="n"/>`
    + `<feColorMatrix in="n" type="matrix" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1" result="g"/>`
    + `<feComposite in="SourceGraphic" in2="g" operator="arithmetic" k2="1" k3=".75" k4="-.37" result="m"/>`
    + `<feComponentTransfer in="m"><feFuncR type="discrete" tableValues=".043 .925"/><feFuncG type="discrete" tableValues=".043 .914"/><feFuncB type="discrete" tableValues=".043 .89"/></feComponentTransfer>`
    + `</filter>`;
}
const DESENFOQUE = '<filter id="d" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28"/></filter>';
const POLVO = '<filter id="p"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .5 -.12"/></filter>';

// "Foto" en grises: degradado con manchas desenfocadas, para pasarla por la fotocopia.
let escenas = 0;
function escena(R, w, h, { horizonte = null, oscuro = 0.12, claro = 0.97 } = {}) {
  const g = (v) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };
  const ang = R() * 360; const id = `e${escenas++}`;
  let s = `<defs><linearGradient id="${id}" gradientTransform="rotate(${n1(ang)} .5 .5)"><stop offset="0" stop-color="${g(claro)}"/><stop offset="1" stop-color="${g(oscuro)}"/></linearGradient></defs>`
    + `<rect width="${w}" height="${h}" fill="url(#${id})"/>`;
  if (horizonte != null) s += `<rect y="${n1(h * horizonte)}" width="${w}" height="${n1(h * (1 - horizonte))}" fill="${g(oscuro + 0.08)}"/>`;
  s += `<g filter="url(#d)">${Array.from({ length: 4 }, () => `<circle cx="${n1(R() * w)}" cy="${n1(R() * h)}" r="${n1(w * (0.12 + R() * 0.25))}" fill="${g(R() < 0.5 ? oscuro : claro)}"/>`).join('')}</g>`;
  return s;
}

const PAREJA = 'M1039.6 856L1162 855.5L1178 858.3L1197 867.5L1208 877.4L1220.4 895L1226 909.9L1227.9 923L1227.9 1100L1224.2 1111L1216 1118.3L1210 1120.5L1204 1120.8L1194 1118.6L1185.8 1112L1181.9 1104L1181.4 943L1180.3 941L1178 940.6L1171 940.6L1169.3 943L1169.3 1372L1165.1 1387L1156.2 1397L1143 1402.2L1134 1402.3L1126 1400.5L1119 1397L1113 1391.7L1105.6 1378L1104.6 1368L1104.6 1126L1102.1 1123L1097 1123.4L1095.7 1126L1095.7 1365L1094.6 1379L1089.4 1390L1082 1397.1L1070 1402L1062 1402.3L1052 1400.4L1043.1 1395L1036.8 1387L1033.3 1378L1032 941.1L1028 940.6L1026 942.1L963.1 1095L955.8 1104L947.4 1108L938 1108.1L932 1106L925 1100.8L921.6 1096L862.6 944L852 942.9L849.8 944L860.6 982L921 1189L919 1191.3L856 1191.2L854 1192.4L853.9 1378L851.6 1389L845 1397.2L839 1400.5L832 1402L820 1400.4L810 1393.1L805.7 1384L804.3 1192L792 1191.1L789.9 1193L789.6 1382L786.1 1391L780.5 1397L774 1400.6L765 1402.2L754 1400.2L746.1 1395L740.9 1387L739 1378.3L738.5 1192L676 1191.3L674.1 1190L743.6 945L742 942.7L734 943L731.5 945L692 1082.8L688.1 1091L683 1097.1L677 1100.8L668 1102L657.6 1099L652 1093.8L648.2 1087L647.3 1081L648.1 1071L696.2 912L705 896.8L715.9 885L728 876.2L745 869L760 867.2L836 867.2L849 869L859 872.6L878 885.1L894 904L901.2 919L942 1021.7L990.6 900L998 884.3L1005 874.1L1016 863.8L1026 858.8Z';
const NOTA = 'M1191.4 342L1194.8 343L1195.1 351L1195 751L1194 758L1188 769L1179.7 778L1169 786.5L1142.8 801L1116 810L1091 813.5L1064.7 812L1042 806.4L1026 797.3L1013.7 783L1008 766L1007 754L1008.2 740L1013.9 724L1027.1 706L1044 691.7L1059 683.1L1081 675.8L1104 675.9L1129 681.1L1130.8 680L1130 451L899 478.7L897.9 481L897.8 555L897.8 791L896 802L890.4 815L883.5 824L873.2 833L853 843.8L830 850.7L801 854.7L781 854.4L769 852.5L743 843.8L726.4 833L714 818L708.9 806L706.7 795L707 775.4L713.9 755L723.9 742L739 730.8L755 723.8L780 718.4L805 718.6L831 723.7L834 722.1L834.9 411Z';

const texto = (x, y, t, { tam = 64, color = TINTA, ancla = 'start', peso = 900 } = {}) =>
  `<text x="${x}" y="${y}" fill="${color}" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="${peso}" font-size="${tam}" letter-spacing="${n1(-tam * 0.045)}" text-anchor="${ancla}">${esc(t)}</text>`;

/** Portada de 600x600 para un beat. La composición sale de su id, así es estable entre ejecuciones. */
export function portada(id, titulo, nombreGenero) {
  const R = semilla(hash(id)); const seed = Math.floor(R() * 999); const tipo = hash(id + 'tipo') % 5;
  const t = titulo.toLowerCase(); const gen = nombreGenero.toLowerCase();
  let defs = filtroFotocopia('x', seed, 0.7 + R() * 0.25) + DESENFOQUE + POLVO; let cuerpo = '';

  if (tipo === 0) { // estrella roja sobre fotocopia
    cuerpo = `<g filter="url(#x)">${escena(R, 600, 600)}</g>`
      + `<path d="${estrella(R, 330 + R() * 120, 250 + R() * 80, 250 + R() * 60)}" fill="${ROJO}"/>`
      + texto(28, 566, t, { tam: 46, color: TINTA });
  } else if (tipo === 1) { // mitad foto, mitad rojo con una estrella recortada
    const corte = 300 + R() * 60;
    defs += `<mask id="m"><rect width="600" height="600" fill="#fff"/><path d="${estrella(R, 300 + (R() - 0.5) * 200, corte + 150, 105)}" fill="#000"/></mask>`;
    cuerpo = `<g filter="url(#x)">${escena(R, 600, 600, { horizonte: 0.45 })}</g>`
      + `<rect y="${n1(corte)}" width="600" height="${n1(600 - corte)}" fill="${ROJO}" mask="url(#m)"/>`
      + texto(28, n1(corte + 58), t, { tam: 50 });
  } else if (tipo === 2) { // la pareja del logo en rojo, de pie en un campo
    const alto = 330 + R() * 120; const s = alto / 1064; const x = 80 + R() * 260;
    cuerpo = `<g filter="url(#x)">${escena(R, 600, 600, { horizonte: 0.55, claro: 0.95, oscuro: 0.45 })}</g>`
      + `<g transform="translate(${n1(x)} ${n1(590 - alto)}) scale(${s.toFixed(4)}) translate(-646 -340)"><path d="${PAREJA}" fill="${ROJO}"/>${R() < 0.5 ? `<path d="${NOTA}" fill="${ROJO}"/>` : ''}</g>`
      + texto(572, 60, t, { tam: 40, ancla: 'end' });
  } else if (tipo === 3) { // recortes en rejilla sobre rojo
    const n = R() < 0.5 ? 2 : 3; const lado = n === 2 ? 190 : 128; const hueco = n === 2 ? 40 : 30;
    const ini = (600 - (n * lado + (n - 1) * hueco)) / 2;
    let celdas = '';
    for (let i = 0; i < n * n; i++) {
      const cx = ini + (i % n) * (lado + hueco), cy = ini - 20 + Math.floor(i / n) * (lado + hueco);
      defs += `<clipPath id="c${i}"><rect x="${n1(cx)}" y="${n1(cy)}" width="${lado}" height="${lado}"/></clipPath>`;
      celdas += `<g transform="rotate(${n1((R() - 0.5) * 6)} ${n1(cx + lado / 2)} ${n1(cy + lado / 2)})"><g clip-path="url(#c${i})"><g filter="url(#x)" transform="translate(${n1(cx)} ${n1(cy)})">${escena(R, lado, lado, { claro: 0.9, oscuro: 0.2 })}</g></g></g>`;
    }
    cuerpo = `<rect width="600" height="600" fill="${ROJO}"/>${celdas}` + texto(300, 574, t, { tam: 38, ancla: 'middle' });
  } else { // la palabra del género, enorme, apoyada en el borde de abajo, con un destello
    const tam = Math.min(250, 560 / (gen.length * 0.62));
    cuerpo = `<rect width="600" height="600" fill="${ROJO}"/>`
      + `<g filter="url(#x)"><g transform="translate(0 70)">${escena(R, 600, 250)}</g></g>`
      + `<path d="${destello(440 + R() * 80, 190 + R() * 50, 160, R() * 30)}" fill="#ECE9E3"/>`
      + texto(24, 52, t, { tam: 40 })
      + texto(18, n1(588 - tam * 0.04), gen, { tam: n1(tam) });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs>${defs}</defs><rect width="600" height="600" fill="#ECE9E3"/>${cuerpo}<rect width="600" height="600" filter="url(#p)"/></svg>`;
}

/** Retrato de relleno de 800x800 en blanco y negro, con grano de fotocopia. */
export function foto(slugP) {
  const R = semilla(hash(slugP)); const seed = Math.floor(R() * 999);
  const dx = (R() - 0.5) * 160; const inc = (R() - 0.5) * 16; const luzX = R() < 0.5 ? 12 + R() * 20 : 68 + R() * 20;
  const escala = 0.82 + R() * 0.45; const dy = (escala - 1) * 260;
  const franjas = R() < 0.5
    ? Array.from({ length: 9 }, (_, i) => `<rect x="${i * 92 + (R() - 0.5) * 20}" width="${n1(18 + R() * 30)}" height="800" fill="#2a2a2a" opacity=".55"/>`).join('')
    : '';
  const defs = filtroFotocopia('x', seed, 0.6) + DESENFOQUE + POLVO
    + `<radialGradient id="f" cx="${n1(luzX)}%" cy="22%" r="90%"><stop offset="0" stop-color="#f2f2f2"/><stop offset=".6" stop-color="#8a8a8a"/><stop offset="1" stop-color="#3a3a3a"/></radialGradient>`
    + `<linearGradient id="q" x1="${luzX < 50 ? 0 : 1}" y1="0" x2="${luzX < 50 ? 1 : 0}" y2="1"><stop offset="0" stop-color="#9a9a9a"/><stop offset=".35" stop-color="#3c3c3c"/><stop offset="1" stop-color="#151515"/></linearGradient>`;
  // Sin estrellas: la web las pega encima con CSS, porque el filtro blanco y negro de las fotos apagaría su rojo.
  const estrellas = '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs>${defs}</defs>`
    + `<g filter="url(#x)"><rect width="800" height="800" fill="url(#f)"/>${franjas}`
    + `<g transform="translate(${n1(dx)} ${n1(dy)}) rotate(${n1(inc)} 400 520) translate(400 520) scale(${escala.toFixed(3)}) translate(-400 -520)" fill="url(#q)"><ellipse cx="400" cy="330" rx="122" ry="148"/><rect x="350" y="440" width="100" height="100" rx="30"/><path d="M100 820C115 640 245 540 400 540C555 540 685 640 700 820Z"/></g></g>`
    + estrellas + `<rect width="800" height="800" filter="url(#p)"/></svg>`;
}
