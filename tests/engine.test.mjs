// Kør: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/engine.js';
import { eksempelPolarvej2025 } from '../js/eksempel.js';
import { byggeRapport } from '../js/report.js';
import { kontroller } from '../js/controls.js';
import { parse, evaluate, toExcel, toText } from '../js/expr.js';
import { tomState, normaliser, nyId } from '../js/model.js';
import { parseTal, fmtKr } from '../js/format.js';

const naer = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg || ''} forventede ${b}, fik ${a}`);

test('formelsprog: evaluering, Excel og tekst', () => {
  const ctx = { get: (id) => ({ a: 10, 'b.c': 4 })[id], konto: (nr) => nr === 10 ? 100 : 0, likvidInd: () => 7, likvidUd: () => 2 };
  assert.equal(evaluate(parse('a + b.c * 2'), ctx), 18);
  assert.equal(evaluate(parse('-(a - b.c) / 2'), ctx), -3);
  assert.equal(evaluate(parse('SUM(a, b.c, KONTO(10))'), ctx), 114);
  assert.equal(evaluate(parse('ROUND(SAFEDIV(a, 3), 2)'), ctx), 3.33);
  assert.equal(evaluate(parse('SAFEDIV(a, 0)'), ctx), 0);
  assert.equal(evaluate(parse('LIKVIDIND("bank") - LIKVIDUD("bank")'), ctx), 5);
  const xctx = { ref: (id) => `Grunddata!C${id.length}`, konto: (nr) => `SUMIF(K,${nr},G)`, likvidInd: (i) => `LI(${i})`, likvidUd: (i) => `LU(${i})` };
  assert.equal(toExcel(parse('a - (b.c + 1) * 2'), xctx), 'Grunddata!C1-(Grunddata!C3+1)*2');
  assert.equal(toExcel(parse('KONTO(10) + SAFEDIV(a, b.c)'), xctx), '(SUMIF(K,10,G))+IF((Grunddata!C3)=0,0,(Grunddata!C1)/(Grunddata!C3))');
  assert.equal(toText(parse('a - b.c'), { label: (id) => id.toUpperCase() }), '[A] − [B.C]');
  assert.throws(() => parse('a +'));
});

test('dansk talparsing', () => {
  assert.equal(parseTal('1.234,56'), 1234.56);
  assert.equal(parseTal('1234.56'), 1234.56);
  assert.equal(parseTal('-12,5'), -12.5);
  assert.equal(parseTal('10.300'), 10300);
  assert.equal(parseTal('0,5'), 0.5);
  assert.equal(fmtKr(1234.5), '1.234,50');
  assert.equal(fmtKr(-0.004), '0,00'); // afrundes til nul, ikke "-0,00"
});

test('eksempel 2025: resultatopgørelsen svarer til årsrapporten', () => {
  const e = new Engine(eksempelPolarvej2025());
  naer(e.get('n1.total'), 192000, 'note 1');
  naer(e.get('n2.total'), 26777.08, 'note 2');
  naer(e.get('n3.total'), -98410.12, 'note 3');
  naer(e.get('n5.total'), -43956.70, 'note 5');
  naer(e.get('n6.total'), -9516, 'note 6');
  naer(e.get('n7.total'), -14641.58, 'note 7 (renter og bidrag iflg. DLR betalingsplan)');
  naer(e.get('res.indtaegter'), 218777.08);
  naer(e.get('res.omkostninger'), -151882.82);
  naer(e.get('res.resultat'), 52252.68);
  naer(e.get('disp.total'), e.get('res.resultat'), 'disponering');
});

test('eksempel 2025: kasserapport, lån og likvider', () => {
  const e = new Engine(eksempelPolarvej2025());
  naer(e.get('likvid.total.ind'), 218777.08);
  naer(e.get('likvid.total.ud'), 212442.50);
  naer(e.get('laan.dlr.ydelser'), 60559.68);
  naer(e.get('laan.dlr.afdrag'), 60559.68 - 14641.58);
  naer(e.get('laan.dlr.restgaeldUltimo'), 627230.91 - 45918.10);
  naer(e.get('likvid.bank.ultimo'), 208611.97 + 218777.08 - 212442.50);
  naer(e.get('cf.diff'), 0, 'pengestrøm');
  naer(e.get('ek.total.ultimo'), e.get('ek.total.primo') + e.get('res.resultat'), 'egenkapital');
});

test('eksempel 2025: andelsværdi og nøgletal', () => {
  const e = new Engine(eksempelPolarvej2025());
  naer(e.get('av.fordelingstal'), 686400);
  naer(e.get('av.prKrone'), Math.round(e.get('av.vaerdi') / 686400 * 100) / 100);
  assert.equal(e.get('nk.f2.m2'), 11586);
  assert.equal(e.get('nk.h1'), 216);
  assert.equal(e.get('nk.j.y0'), 59);
  assert.equal(e.get('nk.k3'), e.get('nk.k1') + e.get('nk.k2'));
});

test('balancen balancerer altid, når primobalancen balancerer', () => {
  const s = eksempelPolarvej2025();
  s.tilgodehavender.push({ id: 'tg1', tekst: 'Tilgodehavende', primo: 1000 });
  s.likvidkonti.forEach(k => { k.kontoudtog = ''; }); // ingen kontoudtog i denne test
  // ret primo så den balancerer: aktiver primo = passiver primo
  const e0 = new Engine(s);
  s.egenkapitalPrimo.overfoertResultat += e0.get('bal.diff.primo');
  // tilføj bevægelser af alle typer
  s.kontoplan.push({ nr: 400, navn: 'Udlån', linje: 'tg:tg1' }, { nr: 401, navn: 'Forbedring', linje: 'bal.ejendom' });
  s.posteringer.push(
    { id: nyId(), dato: '2025-05-05', bilag: '90.25', tekst: 'Udlån', konto: 400, likvid: 'bank', ind: 0, ud: 500 },
    { id: nyId(), dato: '2025-05-06', bilag: '91.25', tekst: 'Nyt tag', konto: 401, likvid: 'bank', ind: 0, ud: 12000 },
    { id: nyId(), dato: '2025-05-07', bilag: '92.25', tekst: 'Depositum', konto: 80, likvid: 'bank', ind: 5000, ud: 0 },
    { id: nyId(), dato: '2025-05-08', bilag: '93.25', tekst: 'Til deponering', konto: 300, likvid: 'bank', ind: 0, ud: 3000 },
    { id: nyId(), dato: '2025-05-08', bilag: '94.25', tekst: 'Fra bank', konto: 300, likvid: 'depo', ind: 3000, ud: 0 },
    { id: nyId(), dato: '2025-12-28', bilag: '95.25', tekst: 'Boligafgift januar forud', konto: 320, likvid: 'bank', ind: 16000, ud: 0 },
  );
  s.reguleringer.push({ id: 'r1', tekst: 'Skyldig revisor', beloeb: 5000, linje: 'n5.revisor', balancepost: 'ag:depositum' });
  s.disponering.tilVedligehold = 10000;
  s.ejendom.opskrivningAaret = 200000;
  const e = new Engine(s);
  naer(e.get('bal.diff.primo'), 0, 'primo');
  naer(e.get('bal.diff.ultimo'), 0, 'ultimo');
  naer(e.get('cf.diff'), 0, 'pengestrøm');
  naer(e.get('n5.revisor'), -5000, 'regulering på resultatlinje');
  naer(e.get('ag.depositum.ultimo'), 20000 + 5000 + 5000, 'anden gæld');
  naer(e.get('tg.tg1.ultimo'), 1500);
  naer(e.get('ejendom.kostpris.ultimo'), 3012000);
  naer(e.get('ek.vedligehold.ultimo'), 10000);
  naer(e.get('forud.ultimo'), 16000);
  const k = kontroller(e);
  assert.equal(k.antal.fejl, 0, JSON.stringify(k.kontroller.filter(c => c.status === 'fejl').map(c => c.titel)));
});

test('kontrolsiden finder uoverensstemmelserne i 2025-rapporten', () => {
  const e = new Engine(eksempelPolarvej2025());
  const k = kontroller(e);
  const by = Object.fromEntries(k.kontroller.map(c => [c.id, c]));
  assert.equal(by['bal.primo'].status, 'fejl');
  naer(by['bal.primo'].diff, -18496.57);
  assert.equal(by['bank.bank'].status, 'fejl');
  naer(by['bank.bank'].diff, 2100);
  assert.equal(by['post.kontering'].status, 'ok');
  assert.equal(by['cf'].status, 'ok');
});

test('kontrol: ukonteret postering og dato uden for året opdages', () => {
  const s = eksempelPolarvej2025();
  s.posteringer.push({ id: 'x', dato: '2024-04-30', bilag: '19.25', tekst: 'Test', konto: 999, likvid: 'bank', ind: 0, ud: 40 });
  const k = kontroller(new Engine(s));
  const by = Object.fromEntries(k.kontroller.map(c => [c.id, c]));
  assert.equal(by['post.kontering'].status, 'fejl');
  assert.ok(by['post.kontering'].detaljer[0].includes('999'));
  assert.equal(by['post.kvalitet'].status, 'advarsel');
  assert.ok(by['post.kvalitet'].detaljer.some(d => d.includes('uden for regnskabsåret')));
  assert.ok(by['post.kvalitet'].detaljer.some(d => d.includes('19.25')));
});

test('rapporten kan bygges for tom stat og for eksempel', () => {
  for (const s of [tomState(2025), eksempelPolarvej2025(), normaliser({ aar: 2026 })]) {
    const e = new Engine(s);
    const r = byggeRapport(e);
    assert.ok(r.pages.length >= 10);
    for (const p of r.pages) for (const b of p.blocks) if (b.type === 'table') for (const row of b.rows) for (const c of row.cells || []) if (c.node) assert.ok(Number.isFinite(e.get(c.node)), c.node);
  }
});

test('formeltekst og sporing', () => {
  const e = new Engine(eksempelPolarvej2025());
  assert.equal(e.formelTekst('res.resultat'), '[Resultat før finansielle poster] + [Finansielle poster]');
  assert.ok(e.formelTekst('n1.boligafgift').startsWith('Konto 10'));
  const t = e.trace('res.resultat', 2);
  assert.equal(t.deps.length, 2);
  assert.equal(t.deps[0].deps.length, 2);
});
