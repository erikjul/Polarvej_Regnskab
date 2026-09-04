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

test('andelsoverdragelser går gennem mellemregningskontoen', () => {
  const sam = eksempelSamling();
  const memo = {};
  naer(engineFor(sam, 2022, memo).get('ag.handel.bev'), 24000, '2022: købesummer − provenu (rest 24.000 uafklaret)');
  naer(engineFor(sam, 2024, memo).get('ag.handel.bev'), 6400, '2024: købesum − provenu − transporterklæring');
  // gennemløb påvirker ikke resultatet
  const e22 = engineFor(sam, 2022, memo);
  assert.ok(Math.abs(e22.get('res.indtaegter')) < 300000, 'købesummer må ikke være indtægt');
});

test('boligafgift pr. år fra banken', () => {
  const sam = eksempelSamling();
  const memo = {};
  const forventet = { 2021: 172000, 2022: 190000, 2023: 192000, 2024: 196000, 2025: 190000 };
  for (const y of Object.keys(forventet)) naer(engineFor(sam, Number(y), memo).get('n1.total'), forventet[y], `boligafgift ${y}`);
  assert.equal(POSTERINGER[2022].length, 129); // 128 banklinjer + overførsel til deponeringskonto
});
