// import.js – import af posteringer fra bankens CSV-eksport med automatisk kontering.
// Understøtter Middelfart Sparekasse-formatet (dd-mm-åååå;tekst;beløb;valuta;modpart) og de fleste
// andre eksportformater: semikolon/komma/tab, med eller uden overskrift, dansk eller engelsk talformat,
// ét beløbsfelt eller separate ind-/udkolonner.
import { parseTal } from './format.js';

const DATO = [
  [/^(\d{2})[-./](\d{2})[-./](\d{4})$/, (m) => `${m[3]}-${m[2]}-${m[1]}`],
  [/^(\d{4})-(\d{2})-(\d{2})$/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
];
export function somDato(s) {
  const t = String(s || '').trim();
  for (const [re, f] of DATO) { const m = re.exec(t); if (m) return f(m); }
  return null;
}
const erTal = (s) => { const t = String(s).trim(); return /^-?\s?[\d.\s]*\d(,\d{1,2})?$/.test(t) || /^-?[\d,\s]*\d(\.\d{1,2})?$/.test(t); };

function splitLinje(linje, sep) {
  // simpel CSV-splitter med understøttelse af citationstegn
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < linje.length; i++) {
    const c = linje[i];
    if (c === '"') { if (q && linje[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === sep && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(x => x.trim());
}

export function parseBankCsv(tekst) {
  const linjer = String(tekst || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!linjer.length) return { posteringer: [], fejl: ['Filen er tom'] };
  const sep = [';', '\t', ','].map(s => [s, (linjer[0].match(new RegExp(s === '\t' ? '\t' : '\\' + s, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  const raekker = linjer.map(l => splitLinje(l, sep));
  const fejl = [];
  // find datokolonne
  const antalKol = Math.max(...raekker.map(r => r.length));
  const datoKol = [...Array(antalKol).keys()].map(c => [c, raekker.filter(r => somDato(r[c])).length]).sort((a, b) => b[1] - a[1])[0];
  if (!datoKol || datoKol[1] === 0) return { posteringer: [], fejl: ['Kunne ikke finde en datokolonne (dd-mm-åååå eller åååå-mm-dd)'] };
  const dc = datoKol[0];
  const data = raekker.filter(r => somDato(r[dc]));
  const overskrift = raekker.find(r => !somDato(r[dc]) && r.length >= 3);
  // talkolonner (ekskl. dato): vælg den/de kolonner med flest tal
  const talKol = [...Array(antalKol).keys()].filter(c => c !== dc).map(c => [c, data.filter(r => r[c] !== undefined && r[c] !== '' && erTal(r[c])).length]).filter(x => x[1] >= Math.max(1, data.length * 0.3)).sort((a, b) => b[1] - a[1]);
  const harIndUd = overskrift && overskrift.some(h => /^(ind|indsat|indbetalt|credit|kredit)/i.test(h)) && overskrift.some(h => /^(ud|hævet|udbetalt|debet|debit)/i.test(h));
  if (!talKol.length && !harIndUd) return { posteringer: [], fejl: ['Kunne ikke finde en beløbskolonne'] };
  // Hvis overskrift nævner saldo, undgå den kolonne
  const saldoKol = overskrift ? overskrift.findIndex(h => /saldo|balance/i.test(h)) : -1;
  const kandidater = talKol.map(x => x[0]).filter(c => c !== saldoKol);
  let beloebKol = kandidater.length ? kandidater[0] : -1, indKol = -1, udKol = -1;
  if (overskrift) {
    const hi = overskrift.findIndex(h => /^(ind|indsat|indbetalt|credit|kredit)/i.test(h));
    const hu = overskrift.findIndex(h => /^(ud|hævet|udbetalt|debet|debit)/i.test(h));
    if (hi >= 0 && hu >= 0) { indKol = hi; udKol = hu; }
    const hb = overskrift.findIndex(h => /^(beløb|belob|amount)/i.test(h));
    if (hb >= 0) beloebKol = hb;
  } else if (kandidater.length >= 2 && saldoKol < 0) {
    // uden overskrift: hvis to talkolonner og den sidste ligner en løbende saldo (store tal, samme fortegn), brug den første
    beloebKol = kandidater.sort((a, b) => a - b)[0];
  }
  // tekstkolonner: alle ikke-dato, ikke-tal, ikke-valuta kolonner, sammensat
  const tekstKol = [...Array(antalKol).keys()].filter(c => c !== dc && c !== beloebKol && c !== indKol && c !== udKol && c !== saldoKol && !data.every(r => /^[A-Z]{3}$/.test(r[c] || '') || !(r[c] || '').trim()));
  const posteringer = data.map((r, i) => {
    let beloeb;
    if (indKol >= 0 && udKol >= 0) beloeb = parseTal(r[indKol] || 0) - Math.abs(parseTal(r[udKol] || 0));
    else beloeb = parseTal(r[beloebKol] || 0);
    const tekster = tekstKol.map(c => (r[c] || '').trim()).filter(Boolean);
    const tekst = tekster[0] || '';
    const modpart = tekster.slice(1).join(' · ');
    return { linje: i + 1, dato: somDato(r[dc]), tekst, modpart, beloeb: Math.round(beloeb * 100) / 100 };
  });
  return { posteringer, fejl, separator: sep, harOverskrift: !!overskrift };
}

// Konteringsregler: { moenster: tekst der skal indgå (ikke versalfølsom), retning: ''|'ind'|'ud', beloeb: valgfrit præcist beløb, konto }
export function foreslaaKonto(post, regler, historik) {
  const t = (post.tekst + ' ' + (post.modpart || '')).toLowerCase();
  for (const r of regler || []) {
    if (!r.konto && r.konto !== 0) continue;
    if (r.moenster && !t.includes(String(r.moenster).toLowerCase())) continue;
    if (r.retning === 'ind' && post.beloeb < 0) continue;
    if (r.retning === 'ud' && post.beloeb > 0) continue;
    if (r.beloeb !== undefined && r.beloeb !== null && r.beloeb !== '' && Math.abs(Math.abs(Number(r.beloeb)) - Math.abs(post.beloeb)) > 0.005) continue;
    return { konto: Number(r.konto), kilde: 'regel: ' + (r.moenster || (r.beloeb ? 'beløb ' + r.beloeb : 'alle')) };
  }
  const h = historik && historik[normaliser(post.tekst)];
  if (h !== undefined) return { konto: h, kilde: 'tidligere postering' };
  return { konto: '', kilde: '' };
}
export const normaliser = (s) => String(s || '').toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').replace(/\d{6,}/g, '#').replace(/\s+/g, ' ').trim();

// Historik: tekst → konto fra eksisterende posteringer (seneste vinder)
export function byggeHistorik(posteringer) {
  const h = {};
  (posteringer || []).forEach(p => { if (p.konto !== '' && p.konto !== null && p.konto !== undefined) h[normaliser(p.tekst)] = Number(p.konto); });
  return h;
}

export const noegle = (p) => `${p.dato}|${Math.round((Number(p.ind) || Number(p.beloeb > 0 ? p.beloeb : 0) || 0) * 100)}|${Math.round((Number(p.ud) || Number(p.beloeb < 0 ? -p.beloeb : 0) || 0) * 100)}|${normaliser(p.tekst)}`;

// Markerer dubletter mod eksisterende posteringer og forbereder rækker til import
export function forberedImport(parsed, state, likvid, regler) {
  const hist = byggeHistorik(state.posteringer);
  const eksisterende = new Set((state.posteringer || []).map(p => noegle(p)));
  return parsed.posteringer.map(p => {
    const f = foreslaaKonto(p, regler, hist);
    const k = `${p.dato}|${Math.round((p.beloeb > 0 ? p.beloeb : 0) * 100)}|${Math.round((p.beloeb < 0 ? -p.beloeb : 0) * 100)}|${normaliser(p.tekst)}`;
    return { ...p, konto: f.konto, kilde: f.kilde, likvid, dublet: eksisterende.has(k), medtag: !eksisterende.has(k) && String(p.dato).startsWith(String(state.aar)) , udenforAar: !String(p.dato).startsWith(String(state.aar)) };
  });
}
