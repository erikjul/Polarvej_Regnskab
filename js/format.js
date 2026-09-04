// format.js – dansk talformatering og parsing
export function fmtKr(n, decimals = 2) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  let v = Number(n);
  if (Math.abs(v) < Math.pow(10, -(decimals + 1)) / 2) v = 0; // undgå "-0,00"
  const s = Math.abs(v).toLocaleString('da-DK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (v < 0 ? '-' : '') + s;
}
export function fmtInt(n) { return fmtKr(n, 0); }
export function fmtPct(n, decimals = 1) { return fmtKr(n, decimals) + ' %'; }
export function fmtBy(n, fmt) {
  switch (fmt) {
    case 'int': return fmtInt(n);
    case 'dec2': return fmtKr(n, 2);
    case 'pct': return fmtPct(n, 1);
    case 'pct0': return fmtPct(n, 0);
    default: return fmtKr(n, 2);
  }
}
// Accepterer "1.234,56", "1234.56", "1 234,56", "-12,5"
export function parseTal(s) {
  if (typeof s === 'number') return s;
  if (s === null || s === undefined) return 0;
  let t = String(s).trim().replace(/\s/g, '').replace(/kr\.?/i, '');
  if (t === '' || t === '-') return 0;
  if (t.includes(',') && t.includes('.')) {
    // dansk: punktum tusind, komma decimal – medmindre punktum kommer sidst
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (t.includes(',')) {
    t = t.replace(',', '.');
  } else if ((t.match(/\./g) || []).length > 1) {
    t = t.replace(/\./g, '');
  } else if (/\.\d{3}$/.test(t)) {
    // "10.300" → sandsynligvis tusindtal; men "0.5" → decimal. Tre cifre efter punktum tolkes som tusind.
    t = t.replace('.', '');
  }
  const v = parseFloat(t);
  return Number.isNaN(v) ? 0 : v;
}
export function fmtDato(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
const MDR = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
export function fmtDatoLang(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || '';
  return `${parseInt(m[3], 10)}. ${MDR[parseInt(m[2], 10) - 1]} ${m[1]}`;
}
export const num = (x) => { const v = typeof x === 'string' ? parseTal(x) : Number(x); return Number.isFinite(v) ? v : 0; };
