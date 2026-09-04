import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseBankCsv, foreslaaKonto, forberedImport, byggeHistorik } from '../js/import.js';
import { STANDARD_IMPORTREGLER, tomState } from '../js/model.js';

const naer = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.011, `${msg}: forventede ${b}, fik ${a}`);

test('Middelfart Sparekasse-eksport læses: 124 linjer, korrekte summer', () => {
  const r = parseBankCsv(fs.readFileSync(new URL('../data/bank-eksport-2025.csv', import.meta.url), 'utf8'));
  assert.equal(r.fejl.length, 0);
  assert.equal(r.posteringer.length, 124);
  assert.equal(r.separator, ';');
  assert.equal(r.posteringer[0].dato, '2025-01-02');
  assert.equal(r.posteringer[1].modpart, 'Mette Agerskov, Bjerreager 95, 7120 Vejle Øst');
  const ind = r.posteringer.filter(p => p.beloeb > 0).reduce((a, p) => a + p.beloeb, 0);
  const ud = r.posteringer.filter(p => p.beloeb < 0).reduce((a, p) => a - p.beloeb, 0);
  naer(ind, 216777.08, 'ind'); naer(ud, 212542.50, 'ud');
  naer(208611.97 + ind - ud, 212846.55, 'bankens ultimosaldo');
});

test('andre formater: overskrift, komma-separator, engelske tal, ind/ud-kolonner, saldo ignoreres', () => {
  const r1 = parseBankCsv('Dato,Tekst,Beløb,Saldo\n2025-03-01,Husleje,"2,000.00","10,000.00"\n2025-03-02,Gebyr,-10.00,"9,990.00"');
  assert.equal(r1.posteringer.length, 2);
  naer(r1.posteringer[0].beloeb, 2000, 'engelsk tal'); naer(r1.posteringer[1].beloeb, -10, 'negativt');
  const r2 = parseBankCsv('Dato;Tekst;Indsat;Hævet\n01.03.2025;Husleje;2.000,00;\n02.03.2025;Gebyr;;10,00');
  naer(r2.posteringer[0].beloeb, 2000, 'ind-kolonne'); naer(r2.posteringer[1].beloeb, -10, 'ud-kolonne');
  assert.equal(parseBankCsv('ingen datoer her;1;2').fejl.length, 1);
});

test('konteringsregler: mønster, retning, beløb, historik', () => {
  const R = STANDARD_IMPORTREGLER;
  assert.equal(foreslaaKonto({ tekst: 'Betalingsservice DLR KREDIT A/S Aftalenr. 937826031', beloeb: -15178.54 }, R, {}).konto, 120);
  assert.equal(foreslaaKonto({ tekst: 'Advis 122504020141148', modpart: 'Mette Agerskov', beloeb: 2000 }, R, {}).konto, 10);
  assert.equal(foreslaaKonto({ tekst: 'Tina Qualmann', beloeb: 2000 }, R, {}).konto, 10);
  assert.equal(foreslaaKonto({ tekst: 'Tina Qualmann', beloeb: -1000 }, R, {}).konto, 140);
  assert.equal(foreslaaKonto({ tekst: 'Betaling', beloeb: -4683.84 }, R, {}).konto, '');
  assert.equal(foreslaaKonto({ tekst: 'Betalingsservice VEJLE KOMMUNE Aftalenr. 122473449', beloeb: -56850.62 }, R, {}).konto, 90);
  assert.equal(foreslaaKonto({ tekst: 'Købesum', beloeb: 950000 }, R, {}).konto, 85);
  assert.equal(foreslaaKonto({ tekst: 'Indlånssumrente', beloeb: -138.46 }, R, {}).konto, 46);
  assert.equal(foreslaaKonto({ tekst: 'Betalingsservice VEJLE KOMMUNE Aftalenr. 011630679', beloeb: -34034 }, R, {}).konto, 90);
  const hist = byggeHistorik([{ tekst: 'Betaling', konto: 50 }]);
  assert.equal(foreslaaKonto({ tekst: 'Betaling', beloeb: -4683.84 }, R, hist).konto, 50);
});

test('dubletter genkendes og markeres', () => {
  const st = tomState(2025);
  st.posteringer.push({ dato: '2025-02-28', bilag: '1', tekst: 'Gebyr', konto: 170, likvid: 'bank', ind: 0, ud: 10 });
  const r = parseBankCsv('28-02-2025;Gebyr;-10,00;DKK;\n28-03-2025;Gebyr;-500,00;DKK;\n05-01-2024;Gebyr;-5,00;DKK;');
  const rows = forberedImport(r, st, 'bank', STANDARD_IMPORTREGLER);
  assert.equal(rows[0].dublet, true); assert.equal(rows[0].medtag, false);
  assert.equal(rows[1].dublet, false); assert.equal(rows[1].medtag, true); assert.equal(rows[1].konto, 170);
  assert.equal(rows[2].udenforAar, true); assert.equal(rows[2].medtag, false);
});
