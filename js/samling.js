// samling.js – flere regnskabsår i samme program.
// En "samling" indeholder ét regnskab pr. år. Et regnskab kan være koblet til det foregående år
// (primoKilde = 'forrigeAar'): så hentes alle primotal, sidste års resultat og tidligere års nøgletal
// automatisk fra det foregående års beregnede ultimotal – og opdateres, når det foregående år rettes.
import { Engine } from './engine.js';
import { normaliser, ALLE_LINJER } from './model.js';

export function nySamling(state) {
  return { version: 2, aktivAar: state.aar, regnskaber: { [state.aar]: state } };
}

// Indlæst fil eller localStorage kan være v1 (ét regnskab) eller v2 (samling)
export function migrer(data) {
  if (!data) return null;
  if (data.regnskaber && typeof data.regnskaber === 'object') {
    const s = { version: 2, aktivAar: data.aktivAar, regnskaber: {} };
    for (const [aar, st] of Object.entries(data.regnskaber)) s.regnskaber[aar] = normaliser(st);
    if (!s.regnskaber[s.aktivAar]) s.aktivAar = Number(Object.keys(s.regnskaber)[0]);
    return s;
  }
  if (data.aar) return nySamling(normaliser(data));
  return null;
}

export const aarListe = (samling) => Object.keys(samling.regnskaber).map(Number).sort((a, b) => a - b);

export function erKoblet(samling, aar) {
  const st = samling.regnskaber[aar];
  return !!(st && st.primoKilde === 'forrigeAar' && samling.regnskaber[aar - 1]);
}

// Overfører primotal m.v. fra forrige års motor til regnskabet n (muterer n)
export function overfoerPrimo(n, e, forrige) {
  n.likvidkonti.forEach(k => { if (e.has(`likvid.${k.id}.ultimo`)) k.primo = e.get(`likvid.${k.id}.ultimo`); });
  n.ejendom.kostprisPrimo = e.get('ejendom.kostpris.ultimo');
  n.ejendom.opskrivningPrimo = e.get('ek.opskrivning.ultimo');
  n.egenkapitalPrimo = { ...(n.egenkapitalPrimo || {}), overfoertResultat: e.get('ek.overfoert.ultimo'), genopretning: e.get('ek.genopretning.ultimo'), vedligehold: e.get('ek.vedligehold.ultimo'), andreReserver: e.get('ek.andre.ultimo') };
  n.laan.forEach(l => { if (e.has(`laan.${l.id}.restgaeldUltimo`)) { l.restgaeldPrimo = e.get(`laan.${l.id}.restgaeldUltimo`); l.kortfristetPrimo = e.get(`laan.${l.id}.kortfristet`); } });
  n.andenGaeld.forEach(a => { if (e.has(`ag.${a.id}.ultimo`)) a.primo = e.get(`ag.${a.id}.ultimo`); });
  n.tilgodehavender.forEach(t => { if (e.has(`tg.${t.id}.ultimo`)) t.primo = e.get(`tg.${t.id}.ultimo`); });
  n.forudmodtaget.primo = e.get('forud.ultimo');
  n.sidsteAar.linjer = Object.fromEntries(ALLE_LINJER.map(l => [l.id, e.get(l.id)]));
  const nk = n.noegle, fk = forrige.noegle;
  nk.arealer.y2 = { ...fk.arealer.y1 };
  nk.arealer.y1 = { ...fk.arealer.y0 };
  nk.resultatPrM2 = { y2: e.get('nk.j.y1'), y1: e.get('nk.j.y0') };
  nk.vedligeholdLoebende = { y2: e.get('nk.m1.y1'), y1: e.get('nk.m1.y0') };
  nk.vedligeholdGenopretning = { y2: e.get('nk.m2.y1'), y1: e.get('nk.m2.y0') };
  nk.afdragPrM2 = { y2: e.get('nk.r.y1'), y1: e.get('nk.r.y0') };
  return n;
}

// Bygger motoren for et år; koblede år får først primotal fra forrige års motor (rekursivt)
export function engineFor(samling, aar, memo = {}) {
  if (memo[aar]) return memo[aar];
  const st = samling.regnskaber[aar];
  if (!st) throw new Error('Regnskabsåret ' + aar + ' findes ikke');
  if (erKoblet(samling, aar)) {
    const forrige = engineFor(samling, aar - 1, memo);
    overfoerPrimo(st, forrige, samling.regnskaber[aar - 1]);
  }
  memo[aar] = new Engine(st);
  return memo[aar];
}

// Opretter næste regnskabsår ud fra det aktive år (kopierer stamdata, kontoplan, konti, lån, tekster)
export function opretNytAar(samling, fraAar) {
  const S = samling.regnskaber[fraAar];
  const e = engineFor(samling, fraAar);
  const n = normaliser(JSON.parse(JSON.stringify(S)));
  n.aar = fraAar + 1;
  n.primoKilde = 'forrigeAar';
  n.posteringer = [];
  n.reguleringer = [];
  n.likvidkonti.forEach(k => { k.kontoudtog = ''; });
  n.ejendom.opskrivningAaret = 0;
  n.disponering = { tilVedligehold: 0, tilAndreReserver: 0, tilGenopretning: 0, anvendtVedligehold: 0, anvendtAndreReserver: 0, anvendtGenopretning: 0 };
  n.laan.forEach(l => { if (l.kilde !== 'plan') { l.renter = 0; l.kortfristet = 0; l.afdragIflg = ''; l.restgaeldUltimoIflg = ''; } l.kursvaerdi = 0; l.kursvaerdiTekst = ''; });
  n.andele.senestVedtagetPrKrone = e.get('av.prKrone');
  n.andele.senestVedtagetAar = String(fraAar + 1);
  n.sidsteAar = { vis: true, linjer: {} };
  n.budget = {};
  n.egenkapitalPrimo.overfoertIflgRapport = ''; n.egenkapitalPrimo.korrektionTekst = '';
  n.noegle.boligafgiftDecember = S.noegle.boligafgiftDecember;
  n.ledelse.datoPaategning = ''; n.ledelse.datoBilagskontrol = ''; n.ledelse.datoGeneralforsamling = '';
  overfoerPrimo(n, e, S);
  samling.regnskaber[n.aar] = n;
  samling.aktivAar = n.aar;
  return n;
}

// Stier til felter, der styres af koblingen (låses i brugerfladen)
export const PRIMO_STI = /^(likvidkonti\.\d+\.primo|ejendom\.(kostprisPrimo|opskrivningPrimo)|egenkapitalPrimo\.|laan\.\d+\.(restgaeldPrimo|kortfristetPrimo)|andenGaeld\.\d+\.primo|tilgodehavender\.\d+\.primo|forudmodtaget\.primo|sidsteAar\.linjer\.|noegle\.arealer\.y[12]\.|noegle\.(resultatPrM2|vedligeholdLoebende|vedligeholdGenopretning|afdragPrM2)\.)/;
