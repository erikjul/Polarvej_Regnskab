import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vurdering } from '../js/vurdering.js';
import { eksempelSamling } from '../js/eksempel.js';
import { engineFor } from '../js/samling.js';
import { kontroller } from '../js/controls.js';
import { byggeRapport } from '../js/report.js';

test('vurdering 2025: robust med opmærksomhedspunkter, ingen advarsler', () => {
  const sam = eksempelSamling();
  const e = engineFor(sam, 2025);
  const v = vurdering(e, { kontrol: kontroller(e), samling: sam });
  assert.equal(v.antal.advarsel, 0);
  assert.equal(v.niveau, 'opmaerksomhed');
  const titler = v.punkter.map(p => p.titel);
  assert.ok(titler.includes('Regnskabet er afstemt'));
  assert.ok(titler.includes('Lav belåning og høj soliditet'));
  assert.ok(titler.includes('Lav vedligeholdelse og ingen henlæggelser'));
  assert.ok(titler.includes('Lille buffer i andelsværdien'));
  assert.ok(titler.includes('Ingen restancer på boligafgift'));
});

test('advarselstegn udløses: uafstemt regnskab, ulovlig andelsværdi, underskud', () => {
  const sam = eksempelSamling();
  const st = sam.regnskaber[2025];
  st.andele.senestVedtagetPrKrone = 16; // over maksimum
  st.posteringer = st.posteringer.filter(p => p.konto !== 10); // ingen boligafgift → underskud
  st.likvidkonti[0].kontoudtog = 1; // bankafstemning fejler
  const e = engineFor(sam, 2025, {});
  const v = vurdering(e, { kontrol: kontroller(e), samling: sam });
  assert.equal(v.niveau, 'advarsel');
  const t = v.punkter.filter(p => p.kategori === 'advarsel').map(p => p.titel);
  assert.ok(t.includes('Regnskabet indeholder uafstemte poster'));
  assert.ok(t.includes('Den vedtagne andelsværdi overstiger det lovlige maksimum'));
  assert.ok(t.includes('Underskud på driften'));
});

test('vurderingssiden er sidste side i rapporten', () => {
  const sam = eksempelSamling();
  const e = engineFor(sam, 2025);
  const r = byggeRapport(e, { kontrol: kontroller(e), samling: sam });
  const sidste = r.pages[r.pages.length - 1];
  assert.equal(sidste.id, 'vurdering');
  assert.ok(sidste.blocks.some(b => b.type === 'liste' && b.kategori === 'styrke' && b.punkter.length > 0));
});
