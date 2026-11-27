// Genera los medios de ejemplo del prototipo, sin descargar nada:
//   public/demo/audio/<genero>-<n>.wav   loops sintetizados (~20 s, mono, 22 kHz)
//   public/demo/portadas/<beat>.svg      portadas estilo fanzine (scripts/arte-demo.mjs)
//   public/demo/fotos/<productor>.svg    retratos de relleno en fotocopia (los reales los sube cada productor)
//   src/data/demo-medios.json            duración y forma de onda de cada audio
// Uso: npm run demo
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portada, foto } from './arte-demo.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'src/data/catalogo-demo.json'), 'utf8'));
const SR = 22050;
const BARRAS_ONDA = 160;

// ---------- utilidades ----------
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function semilla(n) { let s = (n >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
let R = semilla(1);
const ruido = () => R() * 2 - 1;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;
const lpCoef = (fc) => 1 - Math.exp(-TAU * fc / SR);
const hpCoef = (fc) => 1 / (1 + TAU * fc / SR);
const P = (s) => [...s.replace(/\s/g, '')].flatMap((c, i) => (c === '.' ? [] : [i]));
const escoge = (arr) => arr[Math.floor(R() * arr.length)];

function voz(buf, t, dur, fn) {
  const s = Math.round(t * SR); const n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) { const k = s + i; if (k >= buf.length) break; if (k >= 0) buf[k] += fn(i / SR, i); }
}
const suelta = (tt, dur, r) => (tt > dur - r ? Math.max(0, (dur - tt) / r) : 1);
const ataque = (tt, a) => (tt < a ? tt / a : 1);

// ---------- instrumentos ----------
function bombo(buf, t, { g = 1, f0 = 165, f1 = 46, d = 0.42, punch = 32 } = {}) {
  let ph = 0;
  voz(buf, t, d, (tt, i) => {
    ph += TAU * (f1 + (f0 - f1) * Math.exp(-tt * punch)) / SR;
    let v = Math.sin(ph) * Math.exp(-4 * tt / d);
    if (i < SR * 0.003) v += ruido() * 0.25 * (1 - i / (SR * 0.003));
    return v * g;
  });
}
function ocho(buf, t, midi, dur, { g = 0.75, desde = null, glide = 0.09, drive = 2.4, punch = true, cae = 0.8 } = {}) {
  let ph = 0; const f2 = mtof(midi); const f1 = desde == null ? f2 : mtof(desde); const nd = Math.tanh(drive);
  voz(buf, t, dur + 0.03, (tt) => {
    let f = f1 === f2 || tt >= glide ? f2 : f1 * (f2 / f1) ** (tt / glide);
    if (punch) f *= 1 + 0.5 * Math.exp(-tt * 40);
    ph += TAU * f / SR;
    const env = ataque(tt, 0.002) * Math.exp(-tt * cae) * suelta(tt, dur + 0.03, 0.03);
    return (Math.tanh(Math.sin(ph) * drive) / nd) * env * g;
  });
}
function redoble(buf, t, { g = 0.55, tono = 190, d = 0.17, hp = 1400 } = {}) {
  let x1 = 0, y1 = 0; const a = hpCoef(hp);
  voz(buf, t, d * 1.6, (tt) => {
    const x = ruido(); const y = a * (y1 + x - x1); x1 = x; y1 = y;
    const cuerpo = Math.sin(TAU * tono * tt) * Math.exp(-tt * 28) * 0.8 + Math.sin(TAU * tono * 1.7 * tt) * Math.exp(-tt * 40) * 0.3;
    return (y * Math.exp(-tt / d * 3) * 1.1 + cuerpo) * g;
  });
}
function palmas(buf, t, { g = 0.45, d = 0.13 } = {}) {
  let x1 = 0, y1 = 0, z = 0; const a = hpCoef(900), b = lpCoef(2600);
  voz(buf, t, d * 2, (tt) => {
    const x = ruido(); const y = a * (y1 + x - x1); x1 = x; y1 = y; z += b * (y - z);
    const r = tt < 0.026 ? (tt % 0.0105 < 0.006 ? Math.exp(-(tt % 0.0105) * 300) : 0) : Math.exp(-(tt - 0.026) / d * 3);
    return z * r * 2.2 * g;
  });
}
function charles(buf, t, { g = 0.14, d = 0.035 } = {}) {
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0; const a = hpCoef(6000);
  voz(buf, t, d * 3, (tt) => {
    const x = ruido(); const y = a * (y1 + x - x1); x1 = x; y1 = y; const w = a * (y2 + y - x2); x2 = y; y2 = w;
    return w * Math.exp(-tt / d) * g;
  });
}
function aro(buf, t, { g = 0.25 } = {}) {
  voz(buf, t, 0.06, (tt) => (Math.sin(TAU * 1750 * tt) * Math.exp(-tt * 95) * 0.6 + Math.sin(TAU * 820 * tt) * Math.exp(-tt * 70) + ruido() * Math.exp(-tt * 300) * 0.3) * g);
}
function maraca(buf, t, { g = 0.07 } = {}) {
  let x1 = 0, y1 = 0; const a = hpCoef(4500);
  voz(buf, t, 0.09, (tt) => { const x = ruido(); const y = a * (y1 + x - x1); x1 = x; y1 = y; return y * ataque(tt, 0.006) * Math.exp(-tt / 0.035) * g; });
}
function cencerro(buf, t, midi, { g = 0.16, d = 0.22 } = {}) {
  const f = mtof(midi); const f2 = f * 1.48; let z = 0; const b = lpCoef(3800);
  const cuad = (ph) => Math.sin(ph) + Math.sin(3 * ph) / 3 + Math.sin(5 * ph) / 5 + Math.sin(7 * ph) / 7;
  voz(buf, t, d * 1.5, (tt) => { const x = cuad(TAU * f * tt) + cuad(TAU * f2 * tt); z += b * (x - z); return z * (Math.exp(-tt * 30) * 0.6 + Math.exp(-tt / d) * 0.4) * g; });
}
function tronco(buf, t, midi, { g = 0.55, d = 0.3 } = {}) { // log drum
  let ph = 0; const f0 = mtof(midi);
  voz(buf, t, d * 2.2, (tt) => {
    ph += TAU * f0 * (1 + 0.7 * Math.exp(-tt * 26)) / SR;
    const v = Math.sin(ph) + 0.35 * Math.sin(2 * ph) * Math.exp(-tt * 9);
    return Math.tanh(v * 1.6) * ataque(tt, 0.002) * Math.exp(-tt / d) * g;
  });
}
function campana(buf, t, midi, { g = 0.16, d = 0.5, ratio = 3.5, indice = 2 } = {}) {
  const f = mtof(midi);
  voz(buf, t, d * 2.5, (tt) => Math.sin(TAU * f * tt + indice * Math.exp(-tt * 5) * Math.sin(TAU * f * ratio * tt)) * ataque(tt, 0.002) * Math.exp(-tt / d) * g);
}
function piano(buf, t, notas, dur, { g = 0.11, trem = 0.12, brillo = 1.2, d = 1.4 } = {}) { // piano eléctrico (FM)
  for (const m of notas) {
    const f = mtof(m);
    voz(buf, t, dur + 0.12, (tt) => Math.sin(TAU * f * tt + brillo * Math.exp(-tt * 6) * Math.sin(TAU * f * tt)) * (1 + trem * Math.sin(TAU * 4.6 * tt)) * ataque(tt, 0.004) * Math.exp(-tt / d) * suelta(tt, dur + 0.12, 0.12) * g);
  }
}
function colchon(buf, t, notas, dur, { g = 0.045, a = 0.35, armonicos = 6, desafina = 0.006 } = {}) { // pad
  for (const m of notas) {
    const f = mtof(m);
    voz(buf, t, dur + 0.4, (tt) => {
      let v = 0; for (let h = 1; h <= armonicos; h++) v += (Math.sin(TAU * f * h * tt) + Math.sin(TAU * f * (1 + desafina) * h * tt)) / h;
      return v * ataque(tt, a) * suelta(tt, dur + 0.4, 0.4) * g;
    });
  }
}
function cuerda(buf, t, midi, { g = 0.24, dur = 0.35, apaga = 0.993 } = {}) { // Karplus-Strong
  const N = Math.max(2, Math.round(SR / mtof(midi))); const linea = Float32Array.from({ length: N }, () => ruido()); let k = 0;
  voz(buf, t, dur, (tt) => { const v = linea[k]; linea[k] = apaga * 0.5 * (linea[k] + linea[(k + 1) % N]); k = (k + 1) % N; return v * suelta(tt, dur, 0.03) * g; });
}
function graves(buf, t, midi, dur, { g = 0.5 } = {}) { ocho(buf, t, midi, dur, { g, drive: 1.3, punch: false, cae: 0.4 }); }

// ---------- recetas por género ----------
// c = { buf, T(compas, paso), st, compases, v }
const PENTA = [0, 3, 5, 7, 10];
function motivo(largo, prob = 0.7, alto = 0.3) { return Array.from({ length: largo }, () => (R() < prob ? escoge(PENTA) + (R() < alto ? 12 : 0) : null)); }
function bajoEnGolpes(c, compas, pasos, nota, opts) {
  pasos.forEach((p, i) => { const sig = i + 1 < pasos.length ? pasos[i + 1] : 16; ocho(c.buf, c.T(compas, p), nota, (sig - p) * c.st, opts); });
}

const RECETAS = {
  trap: { bpm: [140, 146], compases: 12, arreglo(c) {
    const raiz = c.v ? 37 : 41; const prog = c.v ? [0, -4, -2, -5] : [0, -4, 3, -2]; const mot = motivo(16, 0.75);
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[Math.floor(b / 2) % 4];
      if (b % 2 === 0) colchon(c.buf, c.T(b, 0), [raiz + 24 + ch, raiz + 27 + ch, raiz + 31 + ch], 32 * c.st, { g: 0.03 });
      mot.forEach((n, i) => { if (n != null && (i >> 3) === b % 2) campana(c.buf, c.T(b, (i % 8) * 2), raiz + 36 + ch + n, { g: 0.13 }); });
      if (b < 2) continue;
      const golpes = b % 2 ? P('x......x..x...x.') : P('x.........x.....');
      golpes.forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.85 }));
      bajoEnGolpes(c, b, golpes, raiz + ch, { g: 0.62 });
      palmas(c.buf, c.T(b, 8)); redoble(c.buf, c.T(b, 8), { g: 0.25 });
      for (let p = 0; p < 16; p += 2) { if (b % 2 && p >= 12) break; charles(c.buf, c.T(b, p)); if (R() < 0.2) charles(c.buf, c.T(b, p + 1), { g: 0.08 }); }
      if (b % 2) for (let k = 0; k < 6; k++) charles(c.buf, c.T(b, 12) + k * (4 * c.st / 6), { g: 0.1 + k * 0.01 });
    }
  } },
  drill: { bpm: [142, 144], compases: 12, arreglo(c) {
    const raiz = c.v ? 40 : 38; const prog = [0, -4, 5, -5];
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[Math.floor(b / 2) % 4];
      if (b % 2 === 0) colchon(c.buf, c.T(b, 0), [raiz + 24 + ch, raiz + 27 + ch, raiz + 31 + ch, raiz + 36 + ch], 32 * c.st, { g: 0.035, a: 0.6, armonicos: 4 });
      [0, 6, 10].forEach((p, i) => { if (b % 2 === 0 || i) piano(c.buf, c.T(b, p), [raiz + 36 + ch + [0, 3, 7][i]], 3 * c.st, { g: 0.08, trem: 0, brillo: 0.6 }); });
      if (b < 2) continue;
      (b % 2 ? P('x.....x.........') : P('x.........x.....')).forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.8, d: 0.3 }));
      ocho(c.buf, c.T(b, 0), raiz + ch, 6 * c.st, { g: 0.6, desde: raiz + ch - 5, glide: 0.06 });
      ocho(c.buf, c.T(b, 6), raiz + ch + 3, 4 * c.st, { g: 0.6, desde: raiz + ch, glide: 0.08 });
      ocho(c.buf, c.T(b, 10), raiz + ch, 6 * c.st, { g: 0.6, desde: raiz + ch + 7, glide: 0.1 });
      redoble(c.buf, c.T(b, 8), { g: 0.5, tono: 210 }); if (b % 2) redoble(c.buf, c.T(b, 15), { g: 0.22, tono: 210 });
      (b % 2 ? P('x..x..x...x.x...') : P('x..x..x.x..x..x.')).forEach((p) => charles(c.buf, c.T(b, p), { g: 0.13 }));
    }
  } },
  rnb: { bpm: [74, 70], compases: 7, arreglo(c) {
    const raiz = c.v ? 62 : 60;
    const prog = c.v ? [[0, 3, 7, 10, 14], [-4, 0, 3, 7], [5, 8, 12, 15], [-5, -1, 2, 5]] : [[-4, 0, 3, 7, 10], [0, 3, 7, 10, 14], [5, 8, 12, 15], [-5, -1, 2, 5]];
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[b % 4];
      piano(c.buf, c.T(b, 0), ch.map((n) => raiz + n), 10 * c.st, { g: 0.07 });
      piano(c.buf, c.T(b, 10), ch.slice(1).map((n) => raiz + n), 6 * c.st, { g: 0.05 });
      if (b < 1) continue;
      graves(c.buf, c.T(b, 0), raiz - 24 + ch[0], 9 * c.st, { g: 0.5 }); graves(c.buf, c.T(b, 10), raiz - 24 + ch[0], 6 * c.st, { g: 0.42 });
      P('x.....x...x.....').forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.7, f0: 130, d: 0.32 }));
      [4, 12].forEach((p) => palmas(c.buf, c.T(b, p), { g: 0.32, d: 0.07 }));
      for (let p = 0; p < 16; p++) charles(c.buf, c.T(b, p), { g: p % 2 ? 0.04 : 0.08 });
      if (b % 2) charles(c.buf, c.T(b, 14), { g: 0.07, d: 0.18 });
      aro(c.buf, c.T(b, 7), { g: 0.12 });
    }
  } },
  reggaeton: { bpm: [94, 90], compases: 8, arreglo(c) {
    const raiz = c.v ? 45 : 43; const prog = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[b % 4];
      colchon(c.buf, c.T(b, 0), ch.map((n) => raiz + 24 + n), 16 * c.st, { g: 0.028, a: 0.2 });
      [0, 3, 6, 10, 12].forEach((p) => piano(c.buf, c.T(b, p), ch.map((n) => raiz + 36 + n), 1.2 * c.st, { g: 0.06, trem: 0, brillo: 1.8, d: 0.3 }));
      if (b < 1) continue;
      [0, 4, 8, 12].forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.85, d: 0.3 }));
      [3, 6, 11, 14].forEach((p) => redoble(c.buf, c.T(b, p), { g: 0.42, tono: 240, d: 0.1, hp: 2000 }));
      [[0, 6], [6, 2], [8, 6], [14, 2]].forEach(([p, l]) => ocho(c.buf, c.T(b, p), raiz - 12 + ch[0], l * c.st, { g: 0.5, drive: 1.6 }));
      for (let p = 2; p < 16; p += 4) charles(c.buf, c.T(b, p), { g: 0.1 });
    }
  } },
  dembow: { bpm: [122, 126], compases: 10, arreglo(c) {
    const raiz = c.v ? 46 : 44; const prog = [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]]; const mot = motivo(8, 0.8, 0.4);
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[b % 4];
      [0, 3, 6].forEach((p) => piano(c.buf, c.T(b, p), ch.map((n) => raiz + 24 + n), 1.5 * c.st, { g: 0.055, trem: 0, brillo: 2.2, d: 0.25 }));
      mot.forEach((n, i) => { if (n != null) campana(c.buf, c.T(b, 8 + i), raiz + 36 + ch[0] + n, { g: 0.09, d: 0.18 }); });
      if (b < 1) continue;
      [0, 4, 8, 12].forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.85, d: 0.26 }));
      [3, 6, 7, 11, 14, ...(b % 2 ? [15] : [])].forEach((p) => { redoble(c.buf, c.T(b, p), { g: 0.36, tono: 260, d: 0.09, hp: 2200 }); });
      [6, 14].forEach((p) => palmas(c.buf, c.T(b, p), { g: 0.25 }));
      [[0, 4], [6, 2], [8, 4], [14, 2]].forEach(([p, l]) => ocho(c.buf, c.T(b, p), raiz - 12 + ch[0], l * c.st, { g: 0.48, drive: 3 }));
      for (let p = 0; p < 16; p++) charles(c.buf, c.T(b, p), { g: p % 2 ? 0.05 : 0.09 });
    }
  } },
  afrobeat: { bpm: [104, 108], compases: 9, arreglo(c) {
    const raiz = c.v ? 57 : 53;
    const prog = c.v ? [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 3], [-2, 2, 5, 9]] : [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]];
    const arpe = P('x.xx.x.xx.x.x.x.');
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[b % 4];
      colchon(c.buf, c.T(b, 0), ch.map((n) => raiz + n), 16 * c.st, { g: 0.025, a: 0.3 });
      arpe.forEach((p, i) => cuerda(c.buf, c.T(b, p), raiz + 12 + ch[i % ch.length] + (i % 5 === 4 ? 12 : 0), { g: 0.2, dur: 0.22, apaga: 0.985 }));
      if (b < 1) continue;
      (c.v ? P('x..x......x.....') : P('x......x..x.....')).forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.8, d: 0.34 }));
      P('x..x..x...x.x...').forEach((p) => aro(c.buf, c.T(b, p), { g: 0.16 }));
      (c.v ? [4, 12] : [8]).forEach((p) => palmas(c.buf, c.T(b, p), { g: 0.34 }));
      for (let p = 0; p < 16; p++) maraca(c.buf, c.T(b, p), { g: p % 2 ? 0.08 : 0.04 });
      [[0, 3], [3, 3], [7, 3], [10, 2], [12, 4]].forEach(([p, l], i) => graves(c.buf, c.T(b, p), raiz - 24 + ch[[0, 0, 2, 0, 1][i] % ch.length], l * c.st, { g: 0.5 }));
    }
  } },
  amapiano: { bpm: [112, 114], compases: 10, arreglo(c) {
    const raiz = c.v ? 41 : 43;
    const prog = [[0, 3, 7, 10, 14], [-2, 2, 5, 9], [-4, 0, 3, 7, 10], [-5, -2, 2, 5]];
    const alturas = [0, 0, 12, 7, 0, 10];
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[Math.floor(b / 2) % 4];
      if (b % 2 === 0) colchon(c.buf, c.T(b, 0), ch.map((n) => raiz + 24 + n), 32 * c.st, { g: 0.022, a: 0.5 });
      [0, 7, 10].forEach((p) => piano(c.buf, c.T(b, p), ch.map((n) => raiz + 24 + n), 2 * c.st, { g: 0.045 }));
      if (b < 1) continue;
      [0, 4, 8, 12].forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.6, d: 0.28 }));
      P('x..x..x...x..x..').forEach((p, i) => tronco(c.buf, c.T(b, p), raiz + ch[0] + alturas[(i + b) % alturas.length], { g: 0.5 }));
      [4, 12].forEach((p) => palmas(c.buf, c.T(b, p), { g: 0.26 }));
      [2, 6, 10, 14].forEach((p) => aro(c.buf, c.T(b, p), { g: 0.1 }));
      for (let p = 0; p < 16; p++) maraca(c.buf, c.T(b, p), { g: p % 4 === 2 ? 0.09 : 0.045 });
    }
  } },
  'boom-bap': { bpm: [90, 88], compases: 8, swing: 0.16, lp: 5500, polvo: 1, arreglo(c) {
    const raiz = c.v ? 57 : 55;
    const prog = [[0, 3, 7, 10, 14], [-4, 0, 3, 7], [2, 5, 8, 12], [-5, -1, 2, 5]];
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[b % 4];
      [[0, 4], [6, 2], [10, 3]].forEach(([p, l]) => piano(c.buf, c.T(b, p), ch.map((n) => raiz + n), l * c.st, { g: 0.07, trem: 0, brillo: 2.4, d: 0.6 }));
      if (b < 1) continue;
      const golpes = b % 2 ? P('x.........xx....') : P('x......x..x.....');
      golpes.forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.9, f0: 140, d: 0.36 }));
      golpes.forEach((p) => graves(c.buf, c.T(b, p), raiz - 24 + ch[0], 3 * c.st, { g: 0.42 }));
      [4, 12].forEach((p) => redoble(c.buf, c.T(b, p), { g: 0.6, tono: 175, d: 0.2, hp: 1100 }));
      for (let p = 0; p < 16; p += 2) charles(c.buf, c.T(b, p), { g: p % 4 ? 0.07 : 0.11 });
      if (b % 2) charles(c.buf, c.T(b, 14), { g: 0.08, d: 0.2 });
    }
  } },
  lofi: { bpm: [80, 76], compases: 7, swing: 0.2, lp: 3200, polvo: 2, arreglo(c) {
    const raiz = c.v ? 62 : 60;
    const prog = [[2, 5, 9, 12], [-5, -1, 2, 5, 9], [0, 4, 7, 11, 14], [-3, 0, 4, 7]];
    const mot = motivo(8, 0.5, 0.2);
    for (let b = 0; b < c.compases; b++) {
      const ch = prog[b % 4];
      piano(c.buf, c.T(b, 0), ch.map((n) => raiz + n), 14 * c.st, { g: 0.065, trem: 0.18 });
      mot.forEach((n, i) => { if (n != null && b > 0) campana(c.buf, c.T(b, i * 2), raiz + 12 + ch[0] + n, { g: 0.05, d: 0.35, indice: 0.8, ratio: 2 }); });
      if (b < 1) continue;
      graves(c.buf, c.T(b, 0), raiz - 24 + ch[0], 7 * c.st, { g: 0.45 }); graves(c.buf, c.T(b, 9), raiz - 24 + ch[0], 6 * c.st, { g: 0.38 });
      P('x......x.x......').forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.75, f0: 120, d: 0.3 }));
      [4, 12].forEach((p) => { redoble(c.buf, c.T(b, p), { g: 0.3, tono: 200, d: 0.12, hp: 1800 }); aro(c.buf, c.T(b, p), { g: 0.1 }); });
      for (let p = 0; p < 16; p += 2) if (R() > 0.15) charles(c.buf, c.T(b, p), { g: 0.06 });
    }
  } },
  phonk: { bpm: [130, 136], compases: 12, arreglo(c) {
    const raiz = c.v ? 37 : 39; const mot = motivo(16, 0.85, 0.35); const ritmo = P('x.xx.x.x.xx.x.x.');
    for (let b = 0; b < c.compases; b++) {
      ritmo.forEach((p, i) => { const n = mot[(i + (b % 2) * 8) % 16]; if (n != null) cencerro(c.buf, c.T(b, p), raiz + 36 + n, { g: 0.13 }); });
      if (b < 2) continue;
      [0, 10].forEach((p) => bombo(c.buf, c.T(b, p), { g: 0.9, d: 0.3 }));
      ocho(c.buf, c.T(b, 0), raiz, 10 * c.st, { g: 0.6, drive: 5, cae: 0.3 });
      ocho(c.buf, c.T(b, 10), b % 2 ? raiz + 3 : raiz, 6 * c.st, { g: 0.6, drive: 5, desde: raiz + 7, glide: 0.07 });
      palmas(c.buf, c.T(b, 8), { g: 0.5 }); redoble(c.buf, c.T(b, 8), { g: 0.3, tono: 230 });
      P('x.x.xxx.x.x.xxx.').forEach((p) => charles(c.buf, c.T(b, p), { g: 0.11 }));
      charles(c.buf, c.T(b, 6), { g: 0.08, d: 0.16 });
    }
  } },
};

function renderiza(genero, v) {
  const r = RECETAS[genero]; R = semilla(hash(`${genero}-${v}`));
  const bpm = r.bpm[v]; const st = 60 / bpm / 4; const swing = r.swing ?? 0;
  const largo = r.compases * 16 * st + 0.8;
  const buf = new Float32Array(Math.ceil(largo * SR));
  const T = (compas, paso) => (compas * 16 + paso) * st + (paso % 2 === 1 ? swing * st : 0);
  r.arreglo({ buf, T, st, compases: r.compases, v });
  if (r.polvo) { // crujido de vinilo y siseo
    let z = 0; const b = lpCoef(5000);
    for (let i = 0; i < buf.length; i++) { z += b * (ruido() - z); buf[i] += z * 0.006 * r.polvo; if (R() < 5 * r.polvo / SR) buf[i] += ruido() * 0.25; }
  }
  if (r.lp) { const b = lpCoef(r.lp); let z = 0; for (let i = 0; i < buf.length; i++) { z += b * (buf[i] - z); buf[i] = z; } }
  let pico = 0; for (let i = 0; i < buf.length; i++) { buf[i] = Math.tanh(buf[i] * 1.1); pico = Math.max(pico, Math.abs(buf[i])); }
  const fi = Math.round(0.01 * SR), fo = Math.round(1.2 * SR);
  for (let i = 0; i < buf.length; i++) {
    let g = 0.89 / pico; if (i < fi) g *= i / fi; if (i > buf.length - fo) g *= (buf.length - i) / fo; buf[i] *= g;
  }
  return buf;
}

function wav(f32) {
  const n = f32.length; const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i])) * 32767), 44 + i * 2);
  return b;
}

// Forma de onda: pico por tramo con curva suave, 0-100. Lo mismo se calculará en el navegador al subir un beat real.
function picos(f32) {
  const tramo = Math.floor(f32.length / BARRAS_ONDA); const out = [];
  for (let k = 0; k < BARRAS_ONDA; k++) { let m = 0; for (let i = k * tramo; i < (k + 1) * tramo; i++) m = Math.max(m, Math.abs(f32[i])); out.push(m); }
  const max = Math.max(...out) || 1; return out.map((m) => Math.max(4, Math.round(Math.sqrt(m / max) * 100)));
}

// ---------- ejecución ----------
const dir = (p) => { mkdirSync(join(RAIZ, p), { recursive: true }); return join(RAIZ, p); };
const dAudio = dir('public/demo/audio'), dPort = dir('public/demo/portadas'), dFoto = dir('public/demo/fotos');

const usados = {}; const medios = { audio: {}, beats: {}, fotos: {} };
const nombreGenero = Object.fromEntries(catalogo.generos.map((g) => [g.slug, g.nombre]));
catalogo.productores.forEach((p) => {
  writeFileSync(join(dFoto, `${p.slug}.svg`), foto(p.slug));
  medios.fotos[p.slug] = `/demo/fotos/${p.slug}.svg`;
  for (const b of p.beats) {
    const id = `${p.slug}-${slug(b.titulo)}`;
    const v = (usados[b.genero] = (usados[b.genero] ?? -1) + 1) % 2;
    writeFileSync(join(dPort, `${id}.svg`), portada(id, b.titulo, nombreGenero[b.genero]));
    medios.beats[id] = { audio: `${b.genero}-${v + 1}`, portada: `/demo/portadas/${id}.svg` };
  }
});

let total = 0;
for (const genero of Object.keys(RECETAS)) {
  for (const v of [0, 1]) {
    const nombre = `${genero}-${v + 1}`; const buf = renderiza(genero, v); const archivo = wav(buf); total += archivo.length;
    writeFileSync(join(dAudio, `${nombre}.wav`), archivo);
    medios.audio[nombre] = { url: `/demo/audio/${nombre}.wav`, duracion: Math.round((buf.length / SR) * 10) / 10, picos: picos(buf) };
    console.log(`${nombre.padEnd(12)} ${(buf.length / SR).toFixed(1)} s  ${(archivo.length / 1048576).toFixed(2)} MB`);
  }
}
writeFileSync(join(RAIZ, 'src/data/demo-medios.json'), JSON.stringify(medios));
console.log(`Listo: ${Object.keys(medios.audio).length} audios (${(total / 1048576).toFixed(1)} MB), ${Object.keys(medios.beats).length} portadas, ${Object.keys(medios.fotos).length} fotos.`);
