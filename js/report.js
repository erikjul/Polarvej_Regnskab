// report.js – bygger årsrapportens sider som en datastruktur, der både kan vises som HTML og skrives til Excel.
// Celler kan være { node: 'id' } (beregnet/indtastet tal fra motoren), { text: '...' } eller { x: true } (kryds).
import { NOTER_RESULTAT, VURDERINGSPRINCIPPER, FORDELINGSTAL } from './model.js';
import { fmtKr, fmtInt, fmtDatoLang, fmtDato } from './format.js';
import { sidsteTermin, restloebetid } from './betalingsplan.js';
import { vurdering } from './vurdering.js';

const N = (id) => ({ node: id });
const T = (text) => ({ text });
const X = (on) => ({ text: on ? 'X' : '' });
const row = (kind, label, cells = [], note = '') => ({ kind, label, cells, note });

export function skabelon(tekst, ctx) {
  return String(tekst || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (m, key) => {
    const v = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), ctx);
    return v === undefined || v === null ? '' : String(v);
  });
}

export function byggeRapport(engine, opts = {}) {
  const S = engine.state;
  const y = S.aar;
  const F = S.forening || {};
  const L = S.ledelse || {};
  const header = F.kortnavn || F.navn || '';
  const princip = VURDERINGSPRINCIPPER.find(v => v.id === (S.ejendom || {}).vurderingsprincip) || VURDERINGSPRINCIPPER[2];
  const ctx = {
    aar: y, aarNaeste: y + 1, aarForrige: y - 1,
    forening: F,
    laan: { restgaeld: fmtKr(engine.get('laan.total.restgaeldUltimo')), kursvaerdi: fmtKr(engine.get('laan.total.kursvaerdi')) },
    likvid: { total: fmtKr(engine.get('likvid.total.ultimo'), 0), fri: fmtKr(engine.get('likvid.total.ultimo') - engine.get('ag.total.ultimo'), 0) },
    ejendom: { bogfoert: fmtKr(engine.get('ejendom.bogfoert.ultimo')), vurdering: fmtKr(engine.get('ejendom.vurdering')) },
    av: { litra: princip.litra, princip: princip.label.toLowerCase(), prKrone: fmtKr(engine.get('av.prKrone')), prAndel: fmtInt(engine.get('av.prAndel')) },
    dato: { paategning: fmtDatoLang(L.datoPaategning), bilagskontrol: fmtDatoLang(L.datoBilagskontrol), generalforsamling: fmtDatoLang(L.datoGeneralforsamling) },
  };
  const tx = (key) => skabelon((S.tekster || {})[key], ctx);
  const visPrev = !!(S.sidsteAar && S.sidsteAar.vis);

  const pages = [];

  // ---------- Forside ----------
  pages.push({ id: 'forside', titel: 'Forside', header: '', blocks: [
    { type: 'forside', lines: [F.navn, (F.adresse || '') + (F.postnrBy ? ', ' + F.postnrBy : ''), '', 'Årsrapport for', String(y), '', F.cvr ? 'CVR-nr. ' + F.cvr : ''] },
  ]});

  // ---------- Bestyrelsespåtegning ----------
  pages.push({ id: 'paategning', titel: 'Bestyrelsespåtegning', header, blocks: [
    { type: 'title', text: 'Bestyrelsespåtegning' },
    { type: 'para', text: tx('paategning') },
    { type: 'para', text: `${F.by || ''}, den ${ctx.dato.paategning || '__________'}` },
    { type: 'sign', titel: 'Bestyrelse', personer: (L.bestyrelse || []).filter(p => p.navn).map(p => ({ navn: p.navn, titel: p.titel })) },
    { type: 'para', text: `Årsrapporten er fremlagt og godkendt på andelsboligforeningens ordinære generalforsamling den ${ctx.dato.generalforsamling || '__________'}.` },
    { type: 'sign', titel: '', personer: [{ navn: L.dirigent || '', titel: 'Dirigent' }] },
  ]});

  // ---------- Bilagskontrol ----------
  pages.push({ id: 'bilagskontrol', titel: 'Bilagskontrollørernes erklæring', header, blocks: [
    { type: 'title', text: 'Bilagskontrollørernes erklæring' },
    { type: 'para', text: tx('bilagskontrol') },
    { type: 'para', text: `${F.by || ''}, den ${ctx.dato.bilagskontrol || '__________'}` },
    { type: 'sign', titel: '', personer: (L.bilagskontrolloerer || []).filter(p => p.navn).map(p => ({ navn: p.navn, titel: 'Bilagskontrollør' })) },
  ]});

  // ---------- Anvendt regnskabspraksis ----------
  pages.push({ id: 'praksis', titel: 'Anvendt regnskabspraksis', header, blocks: [
    { type: 'title', text: 'Anvendt regnskabspraksis' },
    { type: 'para', text: tx('praksis') },
  ]});

  // ---------- Resultatopgørelse ----------
  const resCols = [{ label: 'Note' }, { label: '' }, { label: String(y), num: true }, { label: 'Budget ' + (y + 1), num: true }];
  if (visPrev) resCols.push({ label: String(y - 1), num: true });
  const rc = (id) => { const c = [N(id), N('bud.' + id)]; if (visPrev) c.push(N('prev.' + id)); return c; };
  const resRows = [];
  const notesByArt = (art) => NOTER_RESULTAT.filter(n => n.art === art);
  notesByArt('indtaegt').forEach(n => resRows.push(row('line', n.titel, rc(n.id + '.total'), n.nr)));
  resRows.push(row('total', 'Indtægter i alt', rc('res.indtaegter')));
  resRows.push(row('blank'));
  notesByArt('omkostning').forEach(n => resRows.push(row('line', n.titel, rc(n.id + '.total'), n.nr)));
  resRows.push(row('total', 'Omkostninger i alt', rc('res.omkostninger')));
  resRows.push(row('blank'));
  resRows.push(row('total', 'Resultat før finansielle poster', rc('res.foerFin')));
  resRows.push(row('blank'));
  notesByArt('finans').forEach(n => resRows.push(row('line', n.titel, rc(n.id + '.total'), n.nr)));
  resRows.push(row('blank'));
  resRows.push(row('grand', 'Årets resultat', rc('res.resultat')));
  resRows.push(row('blank'));
  resRows.push(row('head', 'Årets resultat fordeles således:'));
  const dc = (id, budId) => { const c = [N(id), budId ? N(budId) : T('')]; if (visPrev) c.push(T('')); return c; };
  resRows.push(row('line', 'Overført til "Reserve til vedligeholdelse af ejendommen"', dc('disp.vedligehold', 'bud.disp.vedligehold')));
  resRows.push(row('line', 'Overført til "Andre reserver"', dc('disp.andre')));
  resRows.push(row('line', 'Overført til "Genopretningskonto"', dc('disp.genopretning')));
  if (engine.get('disp.anvendt') !== 0) resRows.push(row('line', 'Anvendt af reserver i året', dc('disp.anvendt')));
  resRows.push(row('head', 'Overført til "Overført resultat":'));
  resRows.push(row('line', '   Betalte prioritetsafdrag', dc('disp.afdrag', 'bud.disp.afdrag')));
  resRows.push(row('line', '   Overført restandel af årets resultat', dc('disp.rest', 'bud.disp.rest')));
  resRows.push(row('grand', 'I alt', dc('disp.total', 'bud.disp.total')));
  pages.push({ id: 'resultat', titel: 'Resultatopgørelse', header, blocks: [
    { type: 'title', text: 'Resultatopgørelse ' + y },
    { type: 'table', columns: resCols, rows: resRows },
  ]});

  // ---------- Noter (nummerering) ----------
  const harTg = (S.tilgodehavender || []).length > 0;
  const balNoter = [];
  let nr = NOTER_RESULTAT.length;
  const addNote = (id, titel) => { nr++; balNoter.push({ id, nr, titel }); return nr; };
  const NN = {};
  NN.ejendom = addNote('ejendom', 'Materielle anlægsaktiver');
  if (harTg) NN.tg = addNote('tg', 'Tilgodehavender');
  NN.likvid = addNote('likvid', 'Likvide beholdninger');
  NN.indskud = addNote('indskud', 'Andelsindskud');
  NN.opskrivning = addNote('opskrivning', 'Reserve for opskrivning af ejendommen');
  NN.overfoert = addNote('overfoert', 'Overført resultat');
  NN.genopretning = addNote('genopretning', 'Genopretningskonto');
  NN.vedligehold = addNote('vedligehold', 'Reserve til vedligeholdelse af ejendommen');
  NN.andre = addNote('andre', 'Andre reserver');
  NN.laan = addNote('laan', 'Gæld til realkreditinstitutter');
  NN.kortfristet = addNote('kortfristet', 'Kortfristet del af langfristet gæld');
  NN.forud = addNote('forud', 'Forudmodtaget boligafgift');
  NN.ag = addNote('ag', 'Anden gæld');
  NN.pant = addNote('pant', 'Pantsætninger og sikkerhedsstillelser');
  NN.eventual = addNote('eventual', 'Eventualforpligtelser');
  NN.forsikring = addNote('forsikring', 'Forsikringer');
  NN.av = addNote('av', 'Beregning af andelsværdi');
  NN.nk = addNote('nk', 'Nøgleoplysninger');

  // ---------- Balance ----------
  const balCols = [{ label: 'Note' }, { label: '' }, { label: '31/12 ' + y, num: true }, { label: '31/12 ' + (y - 1), num: true }];
  const bc = (base) => [N(base + '.ultimo'), N(base + '.primo')];
  const bal = [];
  bal.push(row('head', 'Aktiver'));
  bal.push(row('sub', 'Anlægsaktiver'));
  bal.push(row('line', 'Ejendom', bc('ejendom.bogfoert'), NN.ejendom));
  bal.push(row('total', 'Materielle anlægsaktiver i alt', bc('bal.anlaeg')));
  bal.push(row('total', 'Anlægsaktiver i alt', bc('bal.anlaeg')));
  bal.push(row('blank'));
  bal.push(row('sub', 'Omsætningsaktiver'));
  if (harTg) bal.push(row('line', 'Tilgodehavender', bc('tg.total'), NN.tg));
  bal.push(row('line', 'Likvide beholdninger', bc('likvid.total'), NN.likvid));
  bal.push(row('total', 'Omsætningsaktiver i alt', bc('bal.omsaetning')));
  bal.push(row('blank'));
  bal.push(row('grand', 'Aktiver i alt', bc('bal.aktiver')));
  bal.push(row('blank'));
  bal.push(row('blank'));
  bal.push(row('head', 'Passiver'));
  bal.push(row('sub', 'Egenkapital'));
  bal.push(row('line', 'Andelsindskud', bc('ek.indskud'), NN.indskud));
  bal.push(row('line', 'Reserve for opskrivning af ejendom', bc('ek.opskrivning'), NN.opskrivning));
  bal.push(row('line', 'Overført resultat', bc('ek.overfoert'), NN.overfoert));
  bal.push(row('total', 'Egenkapital før generalforsamlingsbestemte reserver', bc('ek.foerReserver')));
  bal.push(row('blank'));
  bal.push(row('line', 'Genopretningskonto', bc('ek.genopretning'), NN.genopretning));
  bal.push(row('line', 'Reserve til vedligeholdelse af ejendommen', bc('ek.vedligehold'), NN.vedligehold));
  bal.push(row('line', 'Andre reserver', bc('ek.andre'), NN.andre));
  bal.push(row('total', 'Generalforsamlingsbestemte reserver i alt', bc('ek.reserver')));
  bal.push(row('blank'));
  bal.push(row('grand', 'Egenkapital i alt', bc('ek.total')));
  bal.push(row('blank'));
  bal.push(row('sub', 'Gældsforpligtelser'));
  bal.push(row('line', 'Gæld til realkreditinstitutter', bc('laan.total.langfristet').map((c, i) => i === 0 ? N('laan.total.langfristet') : N('laan.total.langfristetPrimo')), NN.laan));
  bal.push(row('total', 'Langfristede gældsforpligtelser i alt', bc('bal.langfristet')));
  bal.push(row('blank'));
  bal.push(row('line', 'Kortfristet del af langfristet gæld', [N('laan.total.kortfristet'), N('laan.total.kortfristetPrimo')], NN.kortfristet));
  bal.push(row('line', 'Forudmodtaget boligafgift', bc('forud'), NN.forud));
  bal.push(row('line', 'Anden gæld', bc('ag.total'), NN.ag));
  bal.push(row('total', 'Kortfristede gældsforpligtelser i alt', bc('bal.kortfristet')));
  bal.push(row('blank'));
  bal.push(row('total', 'Gældsforpligtelser i alt', bc('bal.gaeld')));
  bal.push(row('blank'));
  bal.push(row('grand', 'Passiver i alt', bc('bal.passiver')));
  bal.push(row('blank'));
  bal.push(row('note', 'Pantsætninger og sikkerhedsstillelser', [], NN.pant));
  bal.push(row('note', 'Eventualforpligtelser', [], NN.eventual));
  bal.push(row('note', 'Forsikringer', [], NN.forsikring));
  bal.push(row('note', 'Beregning af andelsværdi', [], NN.av));
  bal.push(row('note', 'Nøgleoplysninger', [], NN.nk));
  pages.push({ id: 'balance', titel: 'Balance', header, blocks: [
    { type: 'title', text: 'Balance 31. december ' + y },
    { type: 'table', columns: balCols, rows: bal },
  ]});

  // ---------- Noter til resultatopgørelsen ----------
  const nrCols = [{ label: 'Note' }, { label: '' }, { label: String(y), num: true }, { label: 'Budget ' + (y + 1), num: true }];
  if (visPrev) nrCols.push({ label: String(y - 1), num: true });
  const nrRows = [];
  NOTER_RESULTAT.forEach(n => {
    nrRows.push(row('notehead', n.titel, [], n.nr));
    n.linjer.forEach(l => {
      // vis linjer der har en konto i kontoplanen, en regulering, eller en værdi i en af kolonnerne
      const v = engine.get(l.id), b = engine.get('bud.' + l.id), p = visPrev ? engine.get('prev.' + l.id) : 0;
      const brugt = (S.kontoplan || []).some(k => k.linje === l.id) || (S.reguleringer || []).some(r => r.linje === l.id) || (l.laan && (S.laan || []).length > 0);
      if (brugt || v !== 0 || b !== 0 || p !== 0 || n.linjer.length === 1) nrRows.push(row('line', l.label, rc(l.id)));
    });
    nrRows.push(row('total', n.titel + ' i alt', rc(n.id + '.total')));
    nrRows.push(row('blank'));
  });
  pages.push({ id: 'noter-resultat', titel: 'Noter til resultatopgørelsen', header, blocks: [
    { type: 'title', text: 'Noter til resultatopgørelsen' },
    { type: 'table', columns: nrCols, rows: nrRows },
  ]});

  // ---------- Noter til balancen ----------
  const nbCols = [{ label: 'Note' }, { label: '' }, { label: '31/12 ' + y, num: true }, { label: '31/12 ' + (y - 1), num: true }];
  const nb = [];
  nb.push(row('notehead', 'Materielle anlægsaktiver', [T('Ejendom'), T('Ejendom')], NN.ejendom));
  nb.push(row('line', 'Kostpris primo', [N('ejendom.kostpris.primo'), T('')]));
  nb.push(row('line', 'Tilgang i året', [N('ejendom.tilgang'), T('')]));
  nb.push(row('total', 'Kostpris ultimo', [N('ejendom.kostpris.ultimo'), N('ejendom.kostpris.primo')]));
  nb.push(row('line', 'Opskrivninger primo', [N('ek.opskrivning.primo'), T('')]));
  nb.push(row('line', 'Årets opskrivning', [N('ek.opskrivning.aaret'), T('')]));
  nb.push(row('total', 'Opskrivninger ultimo', [N('ek.opskrivning.ultimo'), N('ek.opskrivning.primo')]));
  nb.push(row('grand', 'Regnskabsmæssig værdi ultimo', [N('ejendom.bogfoert.ultimo'), N('ejendom.bogfoert.primo')]));
  nb.push(row('line', engine.vurderingLabel(), [N('ejendom.vurdering'), T('')]));
  nb.push(row('blank'));
  if (harTg) {
    nb.push(row('notehead', 'Tilgodehavender', [], NN.tg));
    (S.tilgodehavender || []).forEach(t => nb.push(row('line', t.tekst, [N(`tg.${t.id}.ultimo`), N(`tg.${t.id}.primo`)])));
    nb.push(row('total', 'Tilgodehavender i alt', bc('tg.total')));
    nb.push(row('blank'));
  }
  nb.push(row('notehead', 'Likvide beholdninger', [], NN.likvid));
  (S.likvidkonti || []).forEach(k => nb.push(row('line', k.navn, [N(`likvid.${k.id}.ultimo`), N(`likvid.${k.id}.primo`)])));
  nb.push(row('total', 'Likvide beholdninger i alt', bc('likvid.total')));
  nb.push(row('blank'));
  nb.push(row('notehead', 'Andelsindskud', [], NN.indskud));
  nb.push(row('line', `${fmtInt(engine.get('andele.antal'))} andelshavere à ${fmtKr(engine.get('andele.indskud'), 0)} kr. pr. andel`, [N('ek.indskud.ultimo'), N('ek.indskud.primo')]));
  if (engine.get('ek.indskud.bev') !== 0) nb.push(row('line', 'Heraf indskud fra nye andele i året', [N('ek.indskud.bev'), T('')]));
  nb.push(row('total', 'Andelsindskud i alt', bc('ek.indskud')));
  nb.push(row('blank'));
  nb.push(row('notehead', 'Reserve for opskrivning af ejendommen', [], NN.opskrivning));
  nb.push(row('line', 'Reserve primo', [N('ek.opskrivning.primo'), T('')]));
  nb.push(row('line', 'Årets opskrivning', [N('ek.opskrivning.aaret'), T('')]));
  nb.push(row('total', 'Reserve for opskrivning af ejendommen i alt', bc('ek.opskrivning')));
  nb.push(row('blank'));
  nb.push(row('notehead', 'Overført resultat', [], NN.overfoert));
  if (engine.has('ek.overfoert.korrektion')) {
    nb.push(row('line', `Overført resultat primo iflg. årsrapport ${y - 1}`, [N('ek.overfoert.primoRapport'), T('')]));
    nb.push(row('line', 'Korrektion vedrørende tidligere år' + ((S.egenkapitalPrimo || {}).korrektionTekst ? ' (se nedenfor)' : ''), [N('ek.overfoert.korrektion'), T('')]));
    nb.push(row('total', 'Overført resultat primo, korrigeret', [N('ek.overfoert.primo'), T('')]));
  } else nb.push(row('line', 'Overført resultat primo', [N('ek.overfoert.primo'), T('')]));
  nb.push(row('line', 'Årets overførte overskud eller underskud', [N('ek.overfoert.aaret'), T('')]));
  nb.push(row('line', 'Afdrag på prioritetsgæld', [N('ek.overfoert.afdrag'), T('')]));
  if (engine.get('ek.overfoert.anvendt') !== 0) nb.push(row('line', 'Overført fra reserver (anvendt i året)', [N('ek.overfoert.anvendt'), T('')]));
  nb.push(row('total', 'Overført resultat i alt', bc('ek.overfoert')));
  if (engine.has('ek.overfoert.korrektion') && (S.egenkapitalPrimo || {}).korrektionTekst) nb.push(row('text', S.egenkapitalPrimo.korrektionTekst));
  nb.push(row('blank'));
  for (const [key, titel] of [['genopretning', 'Genopretningskonto'], ['vedligehold', 'Reserve til vedligeholdelse af ejendommen'], ['andre', 'Andre reserver']]) {
    nb.push(row('notehead', titel, [], NN[key]));
    nb.push(row('line', 'Reserveret primo', [N(`ek.${key}.primo`), T('')]));
    nb.push(row('line', 'Henlagt ifølge resultatdisponering', [N(`ek.${key}.henlagt`), T('')]));
    nb.push(row('line', 'Anvendt i året', [{ node: `ek.${key}.anvendt`, neg: true }, T('')]));
    nb.push(row('total', titel + ' i alt', bc(`ek.${key}`)));
    if (key === 'vedligehold' && (S.tekster || {}).vedligeholdBegrundelse) nb.push(row('text', skabelon(S.tekster.vedligeholdBegrundelse, ctx)));
    nb.push(row('blank'));
  }
  nb.push(row('notehead', 'Gæld til realkreditinstitutter', [], NN.laan));
  (S.laan || []).forEach(l => {
    const p = `laan.${l.id}`;
    if ((S.laan || []).length > 1) nb.push(row('sub', l.navn));
    nb.push(row('line', `Hovedstol${l.optagetTekst ? ', ' + l.optagetTekst : ''}`, [N(`${p}.hovedstol`), N(`${p}.hovedstol`)]));
    nb.push(row('line', 'Restgæld primo', [N(`${p}.restgaeldPrimo`), T('')]));
    nb.push(row('line', 'Betalte ydelser i året', [N(`${p}.ydelser`), T('')]));
    nb.push(row('line', 'Heraf renter og bidrag', [{ node: `${p}.renter`, neg: true }, T('')]));
    nb.push(row('line', 'Afdrag i året', [{ node: `${p}.afdrag`, neg: true }, T('')]));
    nb.push(row('total', 'Restgæld ultimo (regnskabsmæssig værdi)', [N(`${p}.restgaeldUltimo`), N(`${p}.restgaeldPrimo`)]));
    nb.push(row('line', `Heraf kortfristet del (afdrag i ${y + 1})`, [{ node: `${p}.kortfristet`, neg: true }, { node: `${p}.kortfristetPrimo`, neg: true }]));
    nb.push(row('total', 'Langfristet del', [N(`${p}.langfristet`), N(`${p}.langfristetPrimo`)]));
    if (l.beskrivelse) nb.push(row('text', l.beskrivelse));
    if (engine.harPlan(l)) nb.push(row('text', `Restløbetid pr. 31. december ${y}: ${fmtKr(restloebetid(l.betalingsplan, y))} år (sidste termin ${fmtDato(sidsteTermin(l.betalingsplan))}). Renter, bidrag og afdrag er opgjort efter kreditforeningens betalingsplan.`));
    nb.push(row('text', `Kursværdien af restgælden udgør ${fmtKr(engine.get(`${p}.kursvaerdi`))} kr.${engine.has(`${p}.kurs`) ? ` (kurs ${fmtKr(engine.get(`${p}.kurs`))} pr. 31. december ${y})` : ''}${l.kursvaerdiTekst ? ' ' + l.kursvaerdiTekst : ''}`));
    nb.push(row('blank'));
  });
  if ((S.laan || []).length > 1) {
    nb.push(row('total', 'Gæld til realkreditinstitutter i alt (langfristet del)', [N('laan.total.langfristet'), N('laan.total.langfristetPrimo')]));
    nb.push(row('blank'));
  }
  nb.push(row('notehead', 'Kortfristet del af langfristet gæld', [], NN.kortfristet));
  nb.push(row('line', `Afdrag på prioritetsgæld i ${y + 1}`, [N('laan.total.kortfristet'), N('laan.total.kortfristetPrimo')]));
  nb.push(row('blank'));
  nb.push(row('notehead', 'Forudmodtaget boligafgift', [], NN.forud));
  nb.push(row('line', 'Forudmodtaget boligafgift', bc('forud')));
  nb.push(row('blank'));
  nb.push(row('notehead', 'Anden gæld', [], NN.ag));
  (S.andenGaeld || []).forEach(a => nb.push(row('line', a.tekst, [N(`ag.${a.id}.ultimo`), N(`ag.${a.id}.primo`)])));
  nb.push(row('total', 'Anden gæld i alt', bc('ag.total')));
  nb.push(row('blank'));
  nb.push(row('notehead', 'Pantsætninger og sikkerhedsstillelser', [], NN.pant));
  nb.push(row('text', tx('pantsaetning')));
  nb.push(row('blank'));
  nb.push(row('notehead', 'Eventualforpligtelser', [], NN.eventual));
  nb.push(row('text', tx('eventualforpligtelser')));
  nb.push(row('blank'));
  nb.push(row('notehead', 'Forsikringer', [], NN.forsikring));
  nb.push(row('text', tx('forsikringer')));
  const Fo = S.forsikring || {};
  if (engine.get('forsikring.bestyrelsesansvar') > 0 || engine.get('forsikring.besvigelse') > 0) {
    nb.push(row('line', `Bestyrelsesansvarsforsikring, forsikringssum${Fo.selskab ? ' (' + Fo.selskab + ')' : ''}`, [N('forsikring.bestyrelsesansvar'), T('')]));
    nb.push(row('line', 'Besvigelsesforsikring, forsikringssum', [N('forsikring.besvigelse'), T('')]));
  } else nb.push(row('text', 'Foreningen har ikke oplyst en forsikringssum for bestyrelsesansvars- og besvigelsesforsikring. Vedtægternes § 29, stk. 5, kræver, at forsikringen tegnes, og at summen oplyses.'));
  if (engine.get('forsikring.bygning') > 0) nb.push(row('line', 'Bygningsforsikring, forsikringssum', [N('forsikring.bygning'), T('')]));
  if (Fo.bemaerkning) nb.push(row('text', Fo.bemaerkning));
  pages.push({ id: 'noter-balance', titel: 'Noter til balancen', header, blocks: [
    { type: 'title', text: 'Noter til balancen' },
    { type: 'table', columns: nbCols, rows: nb },
  ]});

  // ---------- Beregning af andelsværdi ----------
  const A = S.andele || {};
  const av = [];
  av.push(row('line', 'Andelsboligforeningens egenkapital før generalforsamlingsbestemte reserver', [N('av.ek')]));
  av.push(row('line', engine.vurderingLabel(), [N('av.vurdering')]));
  av.push(row('line', 'Ejendommens regnskabsmæssige værdi', [N('av.bogfoert')]));
  av.push(row('total', '', [N('av.sub1')]));
  av.push(row('line', 'Prioritetsgæld, regnskabsmæssig værdi', [N('av.gaeldRegnskab')]));
  av.push(row('line', 'Prioritetsgæld, kursværdi', [N('av.gaeldKurs')]));
  if (engine.get('av.andre') !== 0) av.push(row('line', 'Andre reguleringer jf. vedtægter/generalforsamling', [N('av.andre')]));
  av.push(row('grand', 'Formue til fordeling (maksimal andelsværdi jf. andelsboliglovens § 5)', [N('av.vaerdi')]));
  av.push(row('blank'));
  av.push(row('line', (A.fordelingstalType || 'indskud') === 'indskud' ? 'Fordelingstal: indskudt andelskapital' : 'Fordelingstal i alt', [N('av.fordelingstal')]));
  const avCols2 = [{ label: '' }, { label: '' }, { label: 'Andelsværdi pr. andelskrone', num: true }, { label: `Andelsværdi pr. andel (andel = ${fmtKr(engine.get('andele.indskud'), 0)} kr.)`, num: true }];
  const av2 = [];
  av2.push(row('grand', `Beregnet andelsværdi pr. 31. december ${y} (bestyrelsens forslag)`, [N('av.prKrone'), N('av.prAndel')]));
  av2.push(row('line', `Senest vedtagne andelsværdi til sammenligning${A.senestVedtagetAar ? ' (vedtaget på generalforsamlingen i ' + A.senestVedtagetAar + ')' : ''}`, [N('av.senest'), N('av.senestPrAndel')]));
  av2.push(row('line', 'Ændring i forhold til senest vedtagne værdi', [N('av.aendringPct'), T('')]));
  const avBlocks = [
    { type: 'title', text: 'Beregning af andelsværdi', note: NN.av },
    { type: 'para', text: tx('andelsvaerdiIntro') },
    { type: 'table', columns: [{ label: '' }, { label: '' }, { label: 'kr.', num: true }], rows: av },
    { type: 'table', columns: avCols2, rows: av2 },
  ];
  if ((S.ejendom || {}).fastholdt) avBlocks.push({ type: 'para', text: 'Ejendommens værdi er fastholdt i henhold til andelsboligforeningslovens § 5, stk. 3 (fastholdt vurdering foretaget før 1. juli 2020).' });
  avBlocks.push({ type: 'para', text: 'Vedtægterne bestemmer (§ 14, stk. 1, litra a), at selvom der lovligt kan vedtages en højere andelsværdi, er det den på generalforsamlingen vedtagne andelsværdi, der er gældende. Andelsværdien må ikke overstige den ovenfor beregnede maksimale værdi.' });
  // Kvadratmeterpris og værdi pr. bolig
  const andele = (S.andelshavere || []);
  const medAreal = andele.filter(a => Number(a.areal) > 0);
  avBlocks.push({ type: 'table', columns: [{ label: '' }, { label: '' }, { label: 'Beregnet maksimum', num: true }, { label: 'Senest vedtaget', num: true }], rows: [
    row('line', `Andelsværdi pr. m² boligareal (formue til fordeling / ${fmtInt(engine.get('nk.areal.y0.bolig'))} m², nøgletal K1)`, [N('av.prM2'), N('av.senestPrM2')]),
  ]});
  if (medAreal.length) {
    const rows = medAreal.map(a => row('line', `${a.adresse} (${fmtInt(a.areal)} m²)`, [N(`andel.${a.id}.vaerdiM2`), N(`andel.${a.id}.vaerdiSenestM2`), N('av.prAndel'), N('av.senestPrAndel')]));
    avBlocks.push({ type: 'table', columns: [{ label: '' }, { label: 'Bolig' }, { label: 'Handelsværdi, kr./m² × areal (maks.)', num: true }, { label: 'Kr./m² × areal (vedtaget)', num: true }, { label: 'Værdi pr. andel efter indskud (maks.)', num: true }, { label: 'Efter indskud (vedtaget)', num: true }], rows });
  }
  avBlocks.push({ type: 'para', text: `Foreningen formidler andelsværdien som en kvadratmeterpris: formuen til fordeling divideret med andelsboligernes samlede BBR-areal på ${fmtInt(engine.get('nk.areal.y0.bolig'))} m² (nøgletal K1). Handelsværdien af den enkelte andelsbolig opgøres som boligens boligareal (${medAreal.length ? fmtInt(medAreal[0].areal) + ' m²' : 'BBR'}) gange kvadratmeterprisen. Efter vedtægternes § 6, stk. 1, og § 14 er den maksimalt lovlige pris for en andel dog værdien pr. andel opgjort efter indskud; de to opgørelser giver samme resultat, når andelene har lige store indskud og arealer. Ejendommens værdi er den offentlige ejendomsvurdering uden nettoprisindeksering (andelsboligforeningslovens § 5, stk. 2, litra d, anvendes ikke).` });
  if ((S.tekster || {}).forbedringer) avBlocks.push({ type: 'para', text: tx('forbedringer') });
  pages.push({ id: 'andelsvaerdi', titel: 'Beregning af andelsværdi', header, blocks: avBlocks });

  // ---------- Nøgleoplysninger ----------
  const K = S.noegle || {};
  const typer = [['b1', 'Andelsboliger'], ['b2', 'Erhvervsandele'], ['b3', 'Boliglejemål'], ['b4', 'Erhvervslejemål'], ['b5', 'Øvrige lejemål, kældre, garager m.m.']];
  const nkB = typer.map(([b, t], i) => row('line', t, [N(`nk.areal.y2.${b}`), N(`nk.areal.y1.${b}`), N(`nk.antal.${b}`), N(`nk.areal.y0.${b}`)], 'B' + (i + 1)));
  nkB.push(row('total', 'I alt', [N('nk.areal.y2.b6'), N('nk.areal.y1.b6'), N('nk.antal.b6'), N('nk.areal.y0.b6')], 'B6'));
  const ft = (val) => FORDELINGSTAL.map(f => X(f.id === val));
  const nkC = [
    row('line', 'Hvilket fordelingstal benyttes ved opgørelse af andelsværdien?', ft(K.fordelingstalAndelsvaerdi), 'C1'),
    row('line', 'Hvilket fordelingstal benyttes ved opgørelse af boligafgiften?', ft(K.fordelingstalBoligafgift), 'C2'),
  ];
  nkC.push(row('line', K.c3Tekst || 'Hvis andet eller flere fordelingsnøgler/fordelingsprincipper, beskrives det her:', [T(K.c3Svar || '–'), T(''), T(''), T('')], 'C3'));
  const nkD = [
    row('line', 'Foreningens stiftelsesår', [T(String(F.stiftelsesaar || ''))], 'D1'),
    row('line', 'Ejendommens opførelsesår', [T(String(F.opfoerelsesaar || ''))], 'D2'),
  ];
  const nkE = [row('line', 'Hæfter andelshaverne for mere end deres indskud?' + (K.haefter && K.haefterTekst ? ' ' + K.haefterTekst : ''), [X(K.haefter), X(!K.haefter)], 'E1')];
  nkE.push(row('line', K.e2Tekst || 'Hvis ja, beskrives hæftelsen her:', [T(K.e2Svar || (K.haefter ? '' : '–')), T('')], 'E2'));
  const nkF1 = [row('line', 'Anvendt vurderingsprincip til beregning af andelsværdien', VURDERINGSPRINCIPPER.map(v => X(v.id === princip.id)), 'F1')];
  const nkF2 = [
    row('line', 'Ejendommens værdi ved det anvendte vurderingsprincip', [N('nk.f2'), T('Ejendomsværdi (F2) / m² ultimo året i alt (B6)'), N('nk.f2.m2')], 'F2'),
    row('line', 'Generalforsamlingsbestemte reserver', [N('nk.f3'), T('Andre reserver (F3) / m² ultimo året i alt (B6)'), N('nk.f3.m2')], 'F3'),
    row('line', 'Reserver i procent af ejendomsværdi', [T(''), T('(F3 × 100) / F2'), N('nk.f4')], 'F4'),
  ];
  const nkG = [
    row('line', 'Har foreningen modtaget offentligt tilskud, som skal tilbagebetales ved foreningens opløsning?', [X(K.g1), X(!K.g1)], 'G1'),
    row('line', 'Er foreningens ejendom pålagt tilskudsbestemmelser, jf. lov om frigørelse for visse tilskudsbestemmelser m.v. (lovbekendtgørelse nr. 978 af 19. oktober 2009)?', [X(K.g2), X(!K.g2)], 'G2'),
    row('line', 'Er der tinglyst tilbagekøbsklausul (hjemfaldspligt) på foreningens ejendom?', [X(K.g3), X(!K.g3)], 'G3'),
  ];
  const bolig = engine.get('nk.areal.y0.bolig');
  const hRow = (id, label, m) => row('line', label, [T(`${fmtKr(engine.get(m), 0)} × 12 / ${fmtInt(bolig)} =`), N(id)], id.replace('nk.', '').toUpperCase());
  const nkH = [hRow('nk.h1', 'Boligafgift', 'nk.h1.maaned'), hRow('nk.h2', 'Erhvervslejeindtægter', 'nk.h2.maaned'), hRow('nk.h3', 'Boliglejeindtægter', 'nk.h3.maaned')];
  const yrCols = [{ label: 'Feltnr.' }, { label: '' }, { label: 'År ' + (y - 2) + ' kr. pr. m²', num: true }, { label: 'År ' + (y - 1) + ' kr. pr. m²', num: true }, { label: 'År ' + y + ' kr. pr. m²', num: true }];
  const nkJ = [row('line', 'Årets resultat pr. andels-m² de sidste 3 år', [N('nk.j.y2'), N('nk.j.y1'), N('nk.j.y0')], 'J')];
  const nkK = [
    row('line', 'Andelsværdi pr. m²', [N('nk.k1')], 'K1'),
    row('line', '+ (gældsforpligtelser − omsætningsaktiver) pr. m²', [N('nk.k2')], 'K2'),
    row('total', 'Teknisk andelsværdi pr. m²', [N('nk.k3')], 'K3'),
  ];
  const nkM = [
    row('line', 'Vedligeholdelse, løbende', [N('nk.m1.y2'), N('nk.m1.y1'), N('nk.m1.y0')], 'M1'),
    row('line', 'Vedligeholdelse, genopretning og renovering', [N('nk.m2.y2'), N('nk.m2.y1'), N('nk.m2.y0')], 'M2'),
    row('total', 'Vedligeholdelse i alt', [N('nk.m3.y2'), N('nk.m3.y1'), N('nk.m3.y0')], 'M3'),
  ];
  const nkR = [row('line', 'Årets afdrag pr. andels-m² de sidste 3 år', [N('nk.r.y2'), N('nk.r.y1'), N('nk.r.y0')], 'R')];
  const nkBlocks = [
    { type: 'title', text: 'Nøgleoplysninger', note: NN.nk },
    { type: 'para', text: tx('noegleIntro') },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: 'Boligtype' }, { label: 'BBR-areal m² 31/12 ' + (y - 2), num: true }, { label: 'BBR-areal m² 31/12 ' + (y - 1), num: true }, { label: 'Antal 31/12 ' + y, num: true }, { label: 'BBR-areal m² 31/12 ' + y, num: true }], rows: nkB },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: 'Sæt kryds' }, ...FORDELINGSTAL.map(f => ({ label: f.label, center: true }))], rows: nkC },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: '' }, { label: 'År', num: true }], rows: nkD },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: 'Sæt kryds' }, { label: 'Ja', center: true }, { label: 'Nej', center: true }], rows: nkE },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: 'Sæt kryds' }, ...VURDERINGSPRINCIPPER.map(v => ({ label: v.label, center: true }))], rows: nkF1, note: princip.id === 'offentlig' ? 'Den offentlige ejendomsvurdering anvendes uden nettoprisindeksering; felterne om indekseret vurdering (F1b, F2b, F2c) er derfor ikke relevante.' : undefined },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: '' }, { label: 'Anvendt værdi 31/12 ' + y + ' kr.', num: true }, { label: 'Forklaring på udregning' }, { label: '= kr. pr. m²', num: true }], rows: nkF2 },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: 'Sæt kryds' }, { label: 'Ja', center: true }, { label: 'Nej', center: true }], rows: nkG },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: 'Ultimo måneds indtægt (uden fradrag for tomgang, tab m.v.) × 12 / m² på balancedagen for andelsboliger (B1 + B2)' }, { label: 'Udregning' }, { label: 'kr. pr. m²', num: true }], rows: nkH },
    { type: 'table', columns: yrCols, rows: nkJ, note: 'Forklaring på udregning: Årets resultat / m² på balancedagen for andelsboliger (B1 + B2)' },
    { type: 'table', columns: [{ label: 'Feltnr.' }, { label: '' }, { label: 'kr. pr. m²', num: true }], rows: nkK, note: 'K1: Andelsværdi pr. balancedagen / m² for andelsboliger (B1 + B2). K2: (gældsforpligtelser − omsætningsaktiver) pr. balancedagen / m² for andelsboliger (B1 + B2).' },
    { type: 'table', columns: yrCols, rows: nkM, note: 'Forklaring på udregning: Vedligeholdelse pr. år / m² ultimo året i alt (B6)' },
  ];
  if (K.visP) nkBlocks.push({ type: 'table', columns: [{ label: 'Feltnr.' }, { label: '' }, { label: '%', num: true }], rows: [row('line', 'Friværdi (gældsforpligtelser sammenholdt med ejendommens regnskabsmæssige værdi)', [N('nk.p')], 'P')], note: 'Frivilligt nøgletal (udgået af bekendtgørelsen pr. 1. juli 2025): (regnskabsmæssig værdi af ejendom − gældsforpligtelser i alt) × 100 / regnskabsmæssig værdi.' });
  nkBlocks.push({ type: 'table', columns: yrCols, rows: nkR, note: 'Forklaring på udregning: Årets afdrag / m² på balancedagen for andelsboliger (B1 + B2)' });
  if ((K.ekstra || []).filter(x => x.felt || x.tekst).length) nkBlocks.push({ type: 'table', columns: [{ label: 'Feltnr.' }, { label: 'Øvrige felter i bilag 1' }, { label: 'Oplysning' }], rows: K.ekstra.filter(x => x.felt || x.tekst).map(x => row('line', x.tekst || '', [T(x.svar || '')], x.felt || '')) });
  pages.push({ id: 'noegle', titel: 'Nøgleoplysninger', header, blocks: nkBlocks });

  // ---------- Vurdering af regnskabets robusthed ----------
  if (opts.vurdering !== false) {
    const v = vurdering(engine, opts);
    const kat = (k) => v.punkter.filter(x => x.kategori === k);
    pages.push({ id: 'vurdering', titel: 'Vurdering af regnskabets robusthed', header, blocks: [
      { type: 'title', text: 'Supplerende beretning: Vurdering af regnskabets robusthed' },
      { type: 'para', text: `Denne side er en supplerende beretning, jf. årsregnskabslovens § 14. Den er ikke en del af årsregnskabet (resultatopgørelse, balance og noter) og er ikke omfattet af bilagskontrollørernes erklæring. Siden er en automatisk sammenfatning af regnskabets nøgletal til brug for andelshaverne, bygger på tallene i årsrapporten og de grænseværdier, der er beskrevet i programmets dokumentation, og erstatter ikke bestyrelsens eller en revisors vurdering.` },
      { type: 'vurdering', niveau: v.niveau, tekst: v.tekst, antal: v.antal },
      { type: 'liste', kategori: 'styrke', titel: 'Styrker', punkter: kat('styrke') },
      { type: 'liste', kategori: 'opmaerksomhed', titel: 'Punkter andelshaverne bør være opmærksomme på', punkter: kat('opmaerksomhed') },
      { type: 'liste', kategori: 'advarsel', titel: 'Advarselstegn om regnskabets robusthed', punkter: kat('advarsel') },
    ]});
  }
  return { pages, noter: balNoter, NN };
}
