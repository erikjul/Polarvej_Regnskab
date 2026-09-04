import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vedtaegtstjek } from '../js/vedtaegter.js';
import { eksempelSamling } from '../js/eksempel.js';
import { engineFor } from '../js/samling.js';

const by = (v) => Object.fromEntries(v.punkter.map(p => [p.paragraf + ' ' + p.titel, p]));

test('vedtægtstjek 2025: opfyldt bortset fra forsikringsnote og 14-dages frist', () => {
  const sam = eksempelSamling();
  const e = engineFor(sam, 2025);
  const v = vedtaegtstjek(e, { restancer: 0 });
  const fejl = v.punkter.filter(p => p.status === 'fejl').map(p => p.paragraf);
  assert.deepEqual(fejl, ['§ 29, stk. 5']);
  const adv = v.punkter.filter(p => p.status === 'advarsel').map(p => p.paragraf);
  assert.ok(adv.includes('§ 22, stk. 1 og § 31, stk. 2'), '14 dages frist (påtegning 10/3, GF 17/3)');
  assert.ok(adv.includes('§ 30, stk. 3'), 'henlæggelse 0 med begrundelse');
  assert.ok(v.punkter.some(p => p.paragraf === '§ 11, stk. 2, litra h' && p.status === 'ok'));
  assert.ok(v.punkter.some(p => p.paragraf === '§ 4, stk. 1' && p.status === 'ok'));
});

test('vedtægtstjek opdager bilagskontrollør i bestyrelsen, for sen GF, manglende begrundelse og forsikring oplyst', () => {
  const sam = eksempelSamling();
  const st = sam.regnskaber[2025];
  st.ledelse.bilagskontrolloerer[0].navn = 'Heidi Jensen';
  st.ledelse.datoGeneralforsamling = '2026-05-15';
  st.ledelse.datoPaategning = '2026-04-20';
  st.tekster.vedligeholdBegrundelse = '';
  st.forsikring.bestyrelsesansvar = 2000000;
  const v = vedtaegtstjek(engineFor(sam, 2025, {}), { restancer: 4000 });
  const b = by(v);
  assert.equal(v.punkter.find(p => p.paragraf === '§ 31, stk. 1').status, 'fejl');
  assert.equal(v.punkter.find(p => p.paragraf === '§ 21, stk. 2').status, 'fejl');
  assert.equal(v.punkter.find(p => p.paragraf === '§ 30, stk. 3').status, 'fejl');
  assert.equal(v.punkter.find(p => p.paragraf === '§ 29, stk. 5').status, 'ok');
  assert.equal(v.punkter.find(p => p.paragraf === '§ 8, stk. 4').status, 'advarsel');
});
