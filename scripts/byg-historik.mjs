// Bygger js/data-historik.js ud fra bankens CSV-eksporter 2021–2025 (data/bank-eksport-ÅÅÅÅ.csv).
// Kørsel: node scripts/byg-historik.mjs
import fs from 'node:fs';
import { parseBankCsv, foreslaaKonto } from '../js/import.js';
import { STANDARD_IMPORTREGLER } from '../js/model.js';

const AAR = [2021, 2022, 2023, 2024, 2025, 2026]; // 2026: til og med 4. september 2026
const BANK_ULTIMO_2024 = 208611.97; // iflg. årsrapport 2024 og bankafstemning 2025

// Manuelle konteringer (anvendes før reglerne). match: { aar?, tekst (indeholder), beloeb? } → konto, evt. ny tekst/likvid
const OVERRIDES = [
  { aar: 2025, tekst: 'Aftalenr. 122473449', beloeb: -1545.12, konto: 95 },
  { aar: 2025, tekst: 'Betaling', beloeb: -4683.84, konto: 50, nyTekst: 'Betaling (byggesagkyndig.nu)' },
  { aar: 2021, tekst: 'Polarvej 23', beloeb: 20000, konto: 10, nyTekst: 'Boligafgift, efterbetaling februar–november 2021 (Polarvej 23, Jørgen Pedersen)' },
  { aar: 2022, tekst: 'Polarvej 23', beloeb: -10000, konto: 300, nyTekst: 'Overført fremlejedepositum til deponeringskonto' },
  { aar: 2022, tekst: 'Returnering af overførsel', beloeb: 10000, konto: 300, nyTekst: 'Returneret overførsel (deponeringskonto)' },
  { aar: 2022, tekst: 'Polarvej 43', beloeb: 1170000, konto: 85, nyTekst: 'Overdragelsessum Polarvej 43 (køber Jette Bruun)' },
  { aar: 2022, tekst: 'Polarvej 43', beloeb: -1148000, konto: 85, nyTekst: 'Provenu Polarvej 43 til sælger' },
  { aar: 2022, tekst: 'Polarvej 43', beloeb: -20000, konto: 85, nyTekst: 'Provenu Polarvej 43 til sælger, rest' },
  { aar: 2022, tekst: 'Konto 07583224528328', konto: 85, nyTekst: 'Provenu Polarvej 23 til sælger (Jørgen Pedersen)' },
  { aar: 2022, tekst: 'Overdragelsessum', konto: 85, nyTekst: 'Overdragelsessum Polarvej 23 (køber Jan Iversen)' },
  { aar: 2022, tekst: 'Forkert postering', konto: 50, nyTekst: 'Forkert postering (UAFKLARET – se kontrol)' },
  { aar: 2022, tekst: 'Kontingent 2022', konto: 110 },
  { aar: 2024, tekst: 'Købesum', konto: 85, nyTekst: 'Købesum Polarvej 31 (køber Mette Agerskov)' },
  { aar: 2024, tekst: 'For megen betalt husleje', konto: 10, nyTekst: 'For megen betalt boligafgift, tilbagebetalt (Polarvej 31, Jonna Frandsen)' },
  { aar: 2024, tekst: 'Provenu Jonna Frandsen', konto: 85 },
  { aar: 2024, tekst: 'Transporterklæring', konto: 85 },
];
// Ekstra posteringer på andre likvide konti
const EKSTRA = {
  2022: [{ dato: '2022-04-19', tekst: 'Modtaget fra forretningskonto (fremlejedepositum)', konto: 300, likvid: 'depo', ind: 20000, ud: 0 }],
};

const ud = { bankUltimo: {}, posteringer: {}, uafklaret: [] };
const netto = {};
for (const y of AAR) {
  const r = parseBankCsv(fs.readFileSync(`data/bank-eksport-${y}.csv`, 'utf8'));
  const rows = r.posteringer.filter(p => p.dato.startsWith(String(y)));
  netto[y] = rows.reduce((a, p) => a + p.beloeb, 0);
  const konteret = rows.map(p => {
    const o = OVERRIDES.find(o => (!o.aar || o.aar === y) && p.tekst.includes(o.tekst) && (o.beloeb === undefined || Math.abs(o.beloeb - p.beloeb) < 0.005));
    let konto, tekst = p.tekst;
    if (o) { konto = o.konto; if (o.nyTekst) tekst = o.nyTekst; }
    else { const f = foreslaaKonto(p, STANDARD_IMPORTREGLER, {}); konto = f.konto; }
    if (konto === '') { ud.uafklaret.push(`${y}: ${p.dato} ${p.tekst} ${p.beloeb}`); konto = 50; tekst += ' (UAFKLARET)'; }
    if (konto === 140 && !/honorar/i.test(tekst)) tekst = 'Bestyrelseshonorar ' + tekst;
    if (p.modpart && !o) tekst += ' (' + p.modpart + ')';
    return { dato: p.dato, tekst, konto, likvid: 'bank', ind: p.beloeb > 0 ? p.beloeb : 0, ud: p.beloeb < 0 ? -p.beloeb : 0, linje: p.linje };
  });
  (EKSTRA[y] || []).forEach(e => konteret.push({ ...e, linje: 9999 }));
  konteret.sort((a, b) => a.dato.localeCompare(b.dato) || a.linje - b.linje);
  ud.posteringer[y] = konteret.map((p, i) => ({ id: `p${y}_${i + 1}`, dato: p.dato, bilag: `${String(i + 1).padStart(3, '0')}.${String(y).slice(2)}`, tekst: p.tekst, konto: p.konto, likvid: p.likvid, ind: Math.round(p.ind * 100) / 100, ud: Math.round(p.ud * 100) / 100 }));
}
// Bankkæde baglæns fra ultimo 2024
ud.bankUltimo[2024] = BANK_ULTIMO_2024;
for (const y of [2023, 2022, 2021, 2020]) ud.bankUltimo[y] = Math.round((ud.bankUltimo[y + 1] - netto[y + 1]) * 100) / 100;
ud.bankUltimo[2025] = Math.round((BANK_ULTIMO_2024 + netto[2025]) * 100) / 100;
ud.bankUltimo[2026] = Math.round((ud.bankUltimo[2025] + netto[2026]) * 100) / 100; // saldo pr. 4. september 2026 (foreløbig)

let js = `// GENERERET af scripts/byg-historik.mjs – ret ikke i hånden.\n// Posteringer på forretningskontoen 2021–2025 fra Middelfart Sparekasses CSV-eksporter (data/bank-eksport-ÅÅÅÅ.csv), konteret efter konteringsreglerne.\n`;
js += `export const BANK_ULTIMO = ${JSON.stringify(ud.bankUltimo)};\n`;
js += `export const UAFKLARET = ${JSON.stringify(ud.uafklaret, null, 2)};\n`;
js += `export const POSTERINGER = {\n`;
for (const y of AAR) js += `  ${y}: [\n` + ud.posteringer[y].map(p => `    ${JSON.stringify(p)},`).join('\n') + `\n  ],\n`;
js += `};\n`;
fs.writeFileSync('js/data-historik.js', js);
console.log('bank ultimo', ud.bankUltimo);
console.log('uafklaret', ud.uafklaret);
for (const y of AAR) { const s = {}; ud.posteringer[y].forEach(p => { s[p.konto] = Math.round(((s[p.konto] || 0) + p.ind - p.ud) * 100) / 100; }); console.log(y, ud.posteringer[y].length, JSON.stringify(s)); }
