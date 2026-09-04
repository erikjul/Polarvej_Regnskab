// Genererer docs/afvigelser-tabel.md: programmets tal (bank + betalingsplan) mod de aflagte årsrapporter.
import fs from 'node:fs';
import { eksempelSamling, RAPPORTERET } from '../js/eksempel.js';
import { engineFor } from '../js/samling.js';
import { fmtKr } from '../js/format.js';

const sam = eksempelSamling();
const memo = {};
const AAR = [2021, 2022, 2023, 2024, 2025];
const rk = [
  ['Boligafgift (note 1)', 'n1.total', 'boligafgift'],
  ['Renter og bidrag, DLR (note 7)', 'laan.dlr.renter', 'renter'],
  ['Betalte prioritetsafdrag (resultatdisponering)', 'laan.dlr.afdrag', 'afdragDisp'],
  ['Årets resultat', 'res.resultat', 'resultat'],
  ['Prioritetsgæld, restgæld ultimo', 'laan.dlr.restgaeldUltimo', 'restgaeld'],
  ['Kortfristet del (næste års afdrag)', 'laan.dlr.kortfristet', 'kortfristet'],
  ['Likvide beholdninger ultimo', 'likvid.total.ultimo', 'likvider'],
  ['Overført resultat ultimo (note 12)', 'ek.overfoert.ultimo', 'overfoert'],
  ['Kursværdi af prioritetsgæld (restgæld × 98,30)', 'laan.dlr.kursvaerdi', 'kursvaerdi'],
  ['Andelsværdi pr. andelskrone', 'av.prKrone', 'andelskrone'],
];
let md = '# Programmets tal mod de aflagte årsrapporter 2021–2025\n\nGenereret af `scripts/afvigelser.mjs`. "Program" er beregnet ud fra bankens kontoudtog og DLR Kredits betalingsplan; "Rapport" er tallet i den aflagte årsrapport (2021-tallene er sammenligningstal i 2022-rapporten; boligafgift og renter for 2021 er ikke oplyst). Kursværdien er restgæld × kurs 98,30 (kursen har været uændret siden udbetalingen); rapporterne bruger 846.786,53 kr., som er DLR-restgælden ultimo 2019.\n\n';
for (const y of AAR) {
  const e = engineFor(sam, y, memo);
  md += `## ${y}\n\n| Post | Program | Rapport | Difference |\n|---|---:|---:|---:|\n`;
  for (const [label, node, key] of rk) {
    const v = typeof node === 'function' ? node(e) : e.get(node);
    const r = (RAPPORTERET[key] || {})[y];
    const dec = key === 'andelskrone' ? 2 : 2;
    md += `| ${label} | ${fmtKr(v, dec)} | ${r === undefined || r === 0 ? '–' : fmtKr(r, dec)} | ${r === undefined || r === 0 ? '' : fmtKr(v - r, dec)} |\n`;
  }
  md += '\n';
}
fs.writeFileSync('docs/afvigelser-tabel.md', md);
console.log(md);
