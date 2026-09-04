import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBetalingsplan, planAar, planAkk, restloebetid, sidsteTermin } from '../js/betalingsplan.js';
import { DLR_BETALINGSPLAN } from '../js/data-dlr-betalingsplan.js';
import { Engine } from '../js/engine.js';
import { eksempelPolarvej2025 } from '../js/eksempel.js';
import { kontroller } from '../js/controls.js';

const naer = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.011, `${msg}: forventede ${b}, fik ${a}`);

test('parser læser terminer på én linje og med ét tal pr. linje', () => {
  const t1 = parseBetalingsplan('01.03.2025  3.763,39  11.415,15  15.178,54  615.815,76\n01.06.2025 3.694,90 11.457,96 15.152,86 604.357,80');
  assert.equal(t1.length, 2);
  assert.deepEqual(t1[0], { dato: '2025-03-01', rente: 3763.39, afdrag: 11415.15 });
  const t2 = parseBetalingsplan('Termin\nRente og bidrag\n01.09.2025\n3.626,15\n11.500,93\n15.127,08\n592.856,87\n01.12.2025\n3.557,14\n11.544,06\n15.101,20\n581.312,81\nSide 4 af 5');
  assert.equal(t2.length, 2);
  assert.equal(t2[1].dato, '2025-12-01');
  naer(t2[1].afdrag, 11544.06, 'afdrag');
  // ydelse der ikke stemmer giver advarsel
  const t3 = parseBetalingsplan('01.03.2026 100,00 200,00 350,00');
  assert.equal(t3[0].advarsel, 'ydelse ≠ rente + afdrag');
  assert.equal(parseBetalingsplan('ingen tal her').length, 0);
});

test('DLR-planen: 81 terminer, afdrag summerer til hovedstolen, årstal stemmer med låneafregningen', () => {
  assert.equal(DLR_BETALINGSPLAN.length, 81);
  naer(planAkk(DLR_BETALINGSPLAN, 2037), 950000, 'sum afdrag');
  const p25 = planAar(DLR_BETALINGSPLAN, 2025);
  naer(p25.rente, 14641.58, 'renter 2025'); naer(p25.afdrag, 45918.10, 'afdrag 2025'); naer(p25.ydelse, 60559.68, 'ydelse 2025');
  naer(950000 - planAkk(DLR_BETALINGSPLAN, 2025), 581312.81, 'restgæld ultimo 2025');
  naer(planAar(DLR_BETALINGSPLAN, 2026).afdrag, 46610.76, 'afdrag 2026');
  assert.equal(sidsteTermin(DLR_BETALINGSPLAN), '2037-09-01');
  naer(restloebetid(DLR_BETALINGSPLAN, 2025), 11.75, 'restløbetid');
});

test('motoren bruger betalingsplanen: renter, afdrag, kortfristet del og restgæld', () => {
  const e = new Engine(eksempelPolarvej2025());
  naer(e.get('laan.dlr.restgaeldPrimo'), 627230.91, 'primo');
  naer(e.get('laan.dlr.renter'), 14641.58, 'renter');
  naer(e.get('laan.dlr.afdrag'), 45918.10, 'afdrag (ydelser − renter)');
  naer(e.get('laan.dlr.restgaeldUltimo'), 581312.81, 'ultimo');
  naer(e.get('laan.dlr.kortfristet'), 46610.76, 'kortfristet');
  naer(e.get('laan.dlr.langfristet'), 534702.05, 'langfristet');
  naer(e.get('res.resultat'), 50152.68, 'resultat med korrekte renter');
  const k = kontroller(e);
  const yd = k.kontroller.find(c => c.id === 'laan.dlr.ydelser');
  assert.equal(yd.status, 'ok');
  // manglende ydelse opdages
  const s = eksempelPolarvej2025();
  s.posteringer = s.posteringer.filter(p => !(p.dato === '2025-12-30' && /DLR/i.test(p.tekst)));
  const k2 = kontroller(new Engine(s));
  assert.equal(k2.kontroller.find(c => c.id === 'laan.dlr.ydelser').status, 'fejl');
  naer(k2.kontroller.find(c => c.id === 'laan.dlr.ydelser').diff, -15101.20, 'difference = manglende termin');
});

test('manuel kilde bruger de indtastede tal', () => {
  const s = eksempelPolarvej2025();
  s.laan[0].kilde = 'manuel';
  const e = new Engine(s);
  naer(e.get('laan.dlr.renter'), 14641.58, 'renter manuelt felt');
  assert.ok(e.node('laan.dlr.renter').input);
});
