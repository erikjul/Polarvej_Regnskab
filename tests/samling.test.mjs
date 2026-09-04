import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eksempelPolarvej2025 } from '../js/eksempel.js';
import { nySamling, opretNytAar, engineFor, erKoblet, migrer, aarListe } from '../js/samling.js';

const naer = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: forventede ${b}, fik ${a}`);

test('nyt år får primotal fra forrige års ultimo', () => {
  const s = nySamling(eksempelPolarvej2025());
  opretNytAar(s, 2025);
  assert.deepEqual(aarListe(s), [2025, 2026]);
  assert.ok(erKoblet(s, 2026));
  const e25 = engineFor(s, 2025);
  const e26 = engineFor(s, 2026);
  naer(e26.get('likvid.bank.primo'), e25.get('likvid.bank.ultimo'), 'bank primo');
  naer(e26.get('ek.overfoert.primo'), e25.get('ek.overfoert.ultimo'), 'overført resultat primo');
  naer(e26.get('laan.dlr.restgaeldPrimo'), e25.get('laan.dlr.restgaeldUltimo'), 'restgæld primo');
  naer(e26.get('laan.dlr.kortfristetPrimo'), e25.get('laan.dlr.kortfristet'), 'kortfristet primo');
  naer(e26.get('bal.aktiver.primo'), e25.get('bal.aktiver.ultimo'), 'aktiver primo = aktiver ultimo');
  naer(e26.get('prev.res.resultat'), e25.get('res.resultat'), 'sidste års resultat');
  naer(e26.get('nk.j.y1'), e25.get('nk.j.y0'), 'nøgletal J forskudt');
  assert.equal(s.regnskaber[2026].posteringer.length, 0);
  assert.equal(s.regnskaber[2026].andele.senestVedtagetPrKrone, e25.get('av.prKrone'));
});

test('rettelse i forrige år slår igennem i næste års primotal', () => {
  const s = nySamling(eksempelPolarvej2025());
  opretNytAar(s, 2025);
  const foer = engineFor(s, 2026).get('likvid.bank.primo');
  s.regnskaber[2025].posteringer.push({ id: 'x', dato: '2025-12-31', bilag: '42.25', tekst: 'Ekstra', konto: 10, likvid: 'bank', ind: 1000, ud: 0 });
  const efter = engineFor(s, 2026).get('likvid.bank.primo');
  naer(efter - foer, 1000, 'primo følger med');
  // afbryd kobling: primo fryses
  s.regnskaber[2026].primoKilde = 'manuel';
  s.regnskaber[2025].posteringer.pop();
  naer(engineFor(s, 2026).get('likvid.bank.primo'), efter, 'manuel primo ændres ikke');
});

test('migrering af v1-fil og v2-samling', () => {
  const v1 = migrer(eksempelPolarvej2025());
  assert.equal(v1.version, 2); assert.equal(v1.aktivAar, 2025);
  const v2 = migrer(JSON.parse(JSON.stringify(v1)));
  assert.deepEqual(aarListe(v2), [2025]);
  assert.equal(migrer({ noget: 1 }), null);
});
