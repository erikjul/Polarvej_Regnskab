// betalingsplan.js – kreditforeningens betalingsplan (terminer) for et lån.
// En termin: { dato: 'ÅÅÅÅ-MM-DD', rente: renter + bidrag, afdrag }.
import { parseTal } from './format.js';

export const aarAf = (dato) => parseInt(String(dato || '').slice(0, 4), 10);

export function planSum(plan, aar, felt) {
  return (plan || []).reduce((s, t) => (aarAf(t.dato) === aar ? s + (Number(t[felt]) || 0) : s), 0);
}
export function planAkk(plan, aar, felt = 'afdrag') {
  return (plan || []).reduce((s, t) => (aarAf(t.dato) <= aar ? s + (Number(t[felt]) || 0) : s), 0);
}
export function planAar(plan, aar) {
  return { rente: planSum(plan, aar, 'rente'), afdrag: planSum(plan, aar, 'afdrag'), ydelse: planSum(plan, aar, 'rente') + planSum(plan, aar, 'afdrag'), terminer: (plan || []).filter(t => aarAf(t.dato) === aar).length };
}
export function sidsteTermin(plan) {
  const d = (plan || []).map(t => t.dato).filter(Boolean).sort();
  return d.length ? d[d.length - 1] : '';
}
// Restløbetid i år fra 31/12 i regnskabsåret til sidste termin
export function restloebetid(plan, aar) {
  const s = sidsteTermin(plan);
  if (!s) return 0;
  const [y, m] = s.split('-').map(Number);
  return Math.max(0, Math.round(((y - aar - 1) + m / 12) * 100) / 100);
}
export function sorter(plan) { return (plan || []).slice().sort((a, b) => String(a.dato).localeCompare(String(b.dato))); }

// Læser en betalingsplan fra tekst kopieret fra kreditforeningens låneafregning/årsopgørelse.
// Forstår linjer/tokens som: "01.03.2025 3.763,39 11.415,15 15.178,54 615.815,76"
// (dato, rente og bidrag, afdrag, [ydelse], [restgæld]) – også når hvert tal står på sin egen linje.
export function parseBetalingsplan(tekst) {
  const toks = String(tekst || '').split(/\s+/).filter(Boolean);
  const dato = (t) => { const m = /^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/.exec(t); if (m) return `${m[3]}-${m[2]}-${m[1]}`; const i = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); return i ? t : null; };
  const tal = (t) => /^-?[\d.]+,\d{1,2}$|^-?\d+(\.\d{1,2})?$/.test(t) ? parseTal(t) : null;
  const ud = [];
  let i = 0;
  while (i < toks.length) {
    const d = dato(toks[i]);
    if (!d) { i++; continue; }
    const nums = [];
    let j = i + 1;
    while (j < toks.length && dato(toks[j]) === null && nums.length < 4) { const v = tal(toks[j]); if (v === null) break; nums.push(v); j++; }
    if (nums.length >= 2) {
      const t = { dato: d, rente: nums[0], afdrag: nums[1] };
      if (nums.length >= 3 && Math.abs(nums[0] + nums[1] - nums[2]) > 0.02) t.advarsel = 'ydelse ≠ rente + afdrag';
      ud.push(t);
    }
    i = j > i + 1 ? j : i + 1;
  }
  return sorter(ud);
}
