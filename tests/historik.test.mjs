import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eksempelSamling } from '../js/eksempel.js';
import { engineFor } from '../js/samling.js';
import { kontroller } from '../js/controls.js';
import { BANK_ULTIMO, POSTERINGER } from '../js/data-historik.js';
import { planAar } from '../js/betalingsplan.js';
import { DLR_BETALINGSPLAN } from '../js/data-dlr-betalingsplan.js';

const naer = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.011, `${msg}: forventede ${b}, fik ${a}`);

test('bankkæden 2021–2025 hænger sammen med kendt ultimo 2024 og 2025', () => {
  naer(BANK_ULTIMO[2024], 208611.97, 'ultimo 2024 (årsrapport)');
  naer(BANK_ULTIMO[2025], 212846.55, 'ultimo 2025 (kontoudtog)');
  const sam = eksempelSamling();
  const memo = {};
  for (const y of [2021, 2022, 2023, 2024, 2025]) {
    const e = engineFor(sam, y, memo);
    naer(e.get('likvid.bank.primo'), BANK_ULTIMO[y - 1], `primo ${y}`);
    naer(e.get('likvid.bank.ultimo'), BANK_ULTIMO[y], `ultimo ${y}`);
    const k = kontroller(e);
    assert.equal(k.kontroller.find(c => c.id === 'bank.bank').status, 'ok', `bankafstemning ${y}`);
    assert.equal(k.kontroller.find(c => c.id === 'post.kontering').status, 'ok', `kontering ${y}`);
  }
});

test('DLR-ydelserne i banken svarer til betalingsplanen hvert år', () => {
  const sam = eksempelSamling();
  const memo = {};
  for (const y of [2021, 2022, 2023, 2024, 2025]) {
    const e = engineFor(sam, y, memo);
    naer(e.get('laan.dlr.ydelser'), planAar(DLR_BETALINGSPLAN, y).ydelse, `ydelser ${y}`);
    assert.equal(kontroller(e).kontroller.find(c => c.id === 'laan.dlr.ydelser').status, 'ok');
  }
  naer(engineFor(sam, 2024, memo).get('laan.dlr.restgaeldUltimo'), 627230.91, 'restgæld ultimo 2024');
});

test('andelsoverdragelser går gennem mellemregningskontoen og restbeløbet indtægtsføres', () => {
  const sam = eksempelSamling();
  const memo = {};
  const e22 = engineFor(sam, 2022, memo), e24 = engineFor(sam, 2024, memo);
  naer(e22.get('n2.andelshandel'), 24000, '2022: foreningens andel af overdragelsessummer');
  naer(e22.get('ag.handel.ultimo'), 0, '2022: mellemregning afregnet');
  naer(e24.get('n2.andelshandel'), 6400, '2024: foreningens andel');
  naer(e24.get('ag.handel.ultimo'), 0, '2024: mellemregning afregnet');
  assert.ok(Math.abs(e22.get('res.indtaegter')) < 300000, 'købesummer må ikke være indtægt');
});

test('kæden 2021–2026 balancerer, og egenkapitalen ultimo 2025 svarer til den aflagte årsrapport', () => {
  const sam = eksempelSamling();
  const memo = {};
  for (const y of [2021, 2022, 2023, 2024, 2025, 2026]) {
    const e = engineFor(sam, y, memo);
    naer(e.get('bal.diff.primo'), 0, `primobalance ${y}`);
    naer(e.get('bal.diff.ultimo'), 0, `balance ${y}`);
  }
  const e25 = engineFor(sam, 2025, memo);
  naer(e25.get('ek.overfoert.ultimo'), 1945307.74, 'overført resultat ultimo 2025 = årsrapport 2025');
  naer(e25.get('res.resultat'), 50152.68, 'resultat 2025');
  naer(engineFor(sam, 2023, memo).get('res.resultat'), 36488.92, 'resultat 2023 = årsrapport 2023');
  naer(engineFor(sam, 2024, memo).get('res.resultat'), 70188.21, 'resultat 2024 = årsrapport 2024');
  naer(engineFor(sam, 2023, memo).get('laan.dlr.restgaeldUltimo') - 653970.08, 18496.57, '2023-rapportens restgæld var 18.496,57 for lav');
  const e26 = engineFor(sam, 2026, memo);
  naer(e26.get('ek.overfoert.korrektion'), 0, 'ingen egenkapitalkorrektion i 2026');
  naer(e26.get('laan.dlr.restgaeldPrimo'), 581312.81, 'restgæld primo 2026');
});

test('boligafgift pr. år fra banken', () => {
  const sam = eksempelSamling();
  const memo = {};
  const forventet = { 2021: 192000, 2022: 190000, 2023: 192000, 2024: 196000, 2025: 190000 };
  for (const y of Object.keys(forventet)) naer(engineFor(sam, Number(y), memo).get('n1.total'), forventet[y], `boligafgift ${y}`);
  assert.equal(POSTERINGER[2022].length, 129); // 128 banklinjer + overførsel til deponeringskonto
});
