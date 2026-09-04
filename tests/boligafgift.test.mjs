import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boligafgiftOversigt, matchAndel, STANDARD_ANDELSHAVERE } from '../js/boligafgift.js';
import { eksempelSamling } from '../js/eksempel.js';

test('alle boligafgiftsposteringer 2021–2026 genkendes på en andel', () => {
  const sam = eksempelSamling();
  const ov = boligafgiftOversigt(sam, STANDARD_ANDELSHAVERE);
  assert.deepEqual(ov.uafstemt.map(p => p.dato + ' ' + p.tekst), [], 'uafstemte posteringer');
  assert.equal(ov.andele.length, 8);
  assert.equal(ov.slut, '2026-09');
});

test('kronologisk fyldning: efterbetaling og forudbetaling', () => {
  const sam = { aktivAar: 2025, regnskaber: { 2025: { kontoplan: [{ nr: 10, linje: 'n1.boligafgift' }], posteringer: [
    { dato: '2025-01-05', konto: 10, tekst: 'Polarvej 1', ind: 2000, ud: 0 },
    { dato: '2025-03-05', konto: 10, tekst: 'Polarvej 1', ind: 4000, ud: 0 }, // dækker feb + mar
    { dato: '2025-04-28', konto: 10, tekst: 'Polarvej 1', ind: 2000, ud: 0 }, // april
    { dato: '2025-04-29', konto: 10, tekst: 'Polarvej 1', ind: 2000, ud: 0 }, // forud for maj
  ] } } };
  const a = [{ id: 'x', adresse: 'Polarvej 1', navn: 'Test', afgift: 2000, moenstre: 'Polarvej 1', fra: '2025-01', primoSaldo: 0 }];
  const ov = boligafgiftOversigt(sam, a, '2025-06');
  const m = ov.andele[0].maaneder.map(x => x.status);
  assert.deepEqual(m, ['ok', 'mangler', 'ok', 'ok', 'ok', 'mangler']);
  assert.equal(ov.andele[0].saldo, -2000);
  assert.equal(ov.andele[0].maaneder[1].saldo, -2000);
});

test('ingen restancer pr. september 2026; Polarvej 55 forudbetalte januar 2025 i december 2024', () => {
  const ov = boligafgiftOversigt(eksempelSamling(), STANDARD_ANDELSHAVERE);
  ov.andele.forEach(r => assert.equal(r.saldo, 0, r.andel.adresse));
  const h = ov.andele.find(r => r.andel.id === 'a55');
  assert.equal(h.maaneder.filter(m => m.aar === 2024).reduce((s, m) => s + m.betalt, 0), 26000);
  assert.equal(ov.andele.find(r => r.andel.id === 'a23').maaneder.filter(m => m.aar === 2021).reduce((s, m) => s + m.betalt, 0), 24000);
  const j = ov.andele.find(r => r.andel.id === 'a37');
  assert.equal(j.saldo, 0);
});

test('matchAndel bruger første mønster der passer', () => {
  assert.equal(matchAndel({ tekst: 'Fra Heidi nr 55 (HEIDI JENSEN, POLARVEJ 55)' }, STANDARD_ANDELSHAVERE).id, 'a55');
  assert.equal(matchAndel({ tekst: 'Advis 122512310151047 (Mette Agerskov, Bjerreager 95)' }, STANDARD_ANDELSHAVERE).id, 'a31');
  assert.equal(matchAndel({ tekst: 'Ukendt' }, STANDARD_ANDELSHAVERE), null);
});
