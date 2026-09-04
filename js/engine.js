// engine.js – regnskabsmotoren. Bygger et netværk af "noder" (celler) ud fra indtastningerne.
// Hver node har et id, en label, og enten en inputværdi eller en formel (se expr.js).
// Formlerne kan vises som tekst, spores (afhængigheder) og eksporteres som rigtige Excel-formler.
import { parse, evaluate, refs, toText } from './expr.js';
import { NOTER_RESULTAT, ALLE_LINJER, LINJE_BY_ID, VURDERINGSPRINCIPPER } from './model.js';
import { num } from './format.js';
import { planSum, planAkk } from './betalingsplan.js';

export class Engine {
  constructor(state) {
    this.state = state;
    this.nodes = new Map();
    this.order = [];
    this.cache = new Map();
    this.kontoNavne = {};
    (state.kontoplan || []).forEach(k => { this.kontoNavne[k.nr] = k.navn; });
    this.build();
  }

  // ---- definition ----
  input(id, label, value, opts = {}) {
    const n = { id, label, input: true, value: num(value), expr: null, ast: null, fmt: opts.fmt || 'kr', group: opts.group || 'Øvrige grunddata', help: opts.help || '' };
    this.nodes.set(id, n); this.order.push(id); return n;
  }
  def(id, label, expr, opts = {}) {
    const n = { id, label, input: false, expr: String(expr), ast: parse(expr), fmt: opts.fmt || 'kr', help: opts.help || '' };
    n.deps = [...refs(n.ast)];
    this.nodes.set(id, n); this.order.push(id); return n;
  }
  has(id) { return this.nodes.has(id); }
  node(id) { const n = this.nodes.get(id); if (!n) throw new Error('Ukendt node: ' + id); return n; }
  label(id) { const n = this.nodes.get(id); return n ? n.label : id; }

  // ---- evaluering ----
  get(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const n = this.node(id);
    if (n.input) { this.cache.set(id, n.value); return n.value; }
    if (this._stack && this._stack.has(id)) throw new Error('Cirkulær reference: ' + id);
    this._stack = this._stack || new Set();
    this._stack.add(id);
    const v = evaluate(n.ast, this);
    this._stack.delete(id);
    const r = Number.isFinite(v) ? v : 0;
    this.cache.set(id, r);
    return r;
  }
  konto(nr) {
    let s = 0;
    for (const p of this.state.posteringer || []) if (Number(p.konto) === Number(nr)) s += num(p.ind) - num(p.ud);
    return s;
  }
  likvidInd(id) { let s = 0; for (const p of this.state.posteringer || []) if (p.likvid === id) s += num(p.ind); return s; }
  likvidUd(id) { let s = 0; for (const p of this.state.posteringer || []) if (p.likvid === id) s += num(p.ud); return s; }
  planFor(id) { const l = (this.state.laan || []).find(x => x.id === id); return l ? (l.betalingsplan || []) : []; }
  plan(id, aar, felt) { return planSum(this.planFor(id), Number(aar), felt); }
  planAkk(id, aar) { return planAkk(this.planFor(id), Number(aar), 'afdrag'); }
  harPlan(l) { return l.kilde === 'plan' && (l.betalingsplan || []).length > 0; }

  // Læselig formel
  formelTekst(id) {
    const n = this.node(id);
    if (n.input) return 'Indtastet værdi';
    return toText(n.ast, {
      label: (i) => this.label(i),
      konto: (nr) => `Konto ${nr} ${this.kontoNavne[nr] || ''}`.trim(),
      likvidInd: (l) => `Indbetalinger på ${this.likvidNavn(l)}`,
      likvidUd: (l) => `Udbetalinger på ${this.likvidNavn(l)}`,
    });
  }
  likvidNavn(id) { const k = (this.state.likvidkonti || []).find(x => x.id === id); return k ? k.navn : id; }

  // Sporing: node med værdi, formel og afhængigheder (rekursivt op til dybde)
  trace(id, depth = 1) {
    const n = this.node(id);
    const out = { id, label: n.label, value: this.get(id), input: n.input, formel: this.formelTekst(id), fmt: n.fmt, deps: [] };
    if (!n.input && depth > 0) out.deps = n.deps.map(d => this.trace(d, depth - 1));
    return out;
  }

  // ---- opbygning ----
  build() {
    const S = this.state;
    const y = S.aar;
    const K = (parts) => parts.length ? parts.join(' + ') : '0';

    // Kontoplan → hvilke kontonumre peger på hvilken linje/balancepost
    const map = {};
    (S.kontoplan || []).forEach(k => { if (k.linje) (map[k.linje] = map[k.linje] || []).push(Number(k.nr)); });
    const kontoSum = (linje) => (map[linje] || []).map(nr => `KONTO(${nr})`);

    // Reguleringer (periodiseringer): ikke-likvide posteringer med modpost i balancen
    (S.reguleringer || []).forEach(r => this.input(`reg.${r.id}`, `Regulering: ${r.tekst}`, r.beloeb, { group: 'Reguleringer (periodiseringer)' }));
    const regFor = (linje) => (S.reguleringer || []).filter(r => r.linje === linje).map(r => {
      const aktiv = String(r.balancepost || '').startsWith('tg:');
      return (aktiv ? '+ ' : '- ') + `reg.${r.id}`;
    });
    const regForBalance = (post) => (S.reguleringer || []).filter(r => r.balancepost === post).map(r => `reg.${r.id}`);

    // ---- Likvide beholdninger ----
    (S.likvidkonti || []).forEach(k => {
      this.input(`likvid.${k.id}.primo`, `${k.navn}, primo`, k.primo, { group: 'Likvide beholdninger primo' });
      this.def(`likvid.${k.id}.ind`, `${k.navn}, indbetalinger`, `LIKVIDIND("${k.id}")`);
      this.def(`likvid.${k.id}.ud`, `${k.navn}, udbetalinger`, `LIKVIDUD("${k.id}")`);
      this.def(`likvid.${k.id}.ultimo`, `${k.navn}`, `likvid.${k.id}.primo + likvid.${k.id}.ind - likvid.${k.id}.ud`);
      if (k.kontoudtog !== null && k.kontoudtog !== undefined && k.kontoudtog !== '')
        this.input(`likvid.${k.id}.kontoudtog`, `${k.navn}, saldo iflg. kontoudtog`, k.kontoudtog, { group: 'Likvide beholdninger – afstemning' });
    });
    const lk = (S.likvidkonti || []).map(k => k.id);
    this.def('likvid.total.primo', 'Likvide beholdninger primo', `SUM(${K(lk.map(i => `likvid.${i}.primo`))})`);
    this.def('likvid.total.ind', 'Indbetalinger i alt', `SUM(${K(lk.map(i => `likvid.${i}.ind`))})`);
    this.def('likvid.total.ud', 'Udbetalinger i alt', `SUM(${K(lk.map(i => `likvid.${i}.ud`))})`);
    this.def('likvid.total.ultimo', 'Likvide beholdninger i alt', `SUM(${K(lk.map(i => `likvid.${i}.ultimo`))})`);

    // ---- Lån ----
    (S.laan || []).forEach(l => {
      const p = `laan.${l.id}`;
      const g = 'Lån: ' + l.navn;
      const plan = this.harPlan(l);
      this.input(`${p}.hovedstol`, `${l.navn}, hovedstol`, l.hovedstol, { group: g });
      if (plan) {
        this.def(`${p}.restgaeldPrimo`, `${l.navn}, restgæld primo iflg. betalingsplan`, `${p}.hovedstol - PLANAFDRAGAKK("${l.id}", ${y - 1})`);
        this.def(`${p}.kortfristetPrimo`, `${l.navn}, kortfristet del primo (afdrag i ${y} iflg. betalingsplan)`, `PLANAFDRAG("${l.id}", ${y})`);
        this.def(`${p}.renter`, `${l.navn}, renter og bidrag iflg. betalingsplan`, `PLANRENTE("${l.id}", ${y})`);
        this.def(`${p}.kortfristet`, `${l.navn}, kortfristet del (afdrag i ${y + 1} iflg. betalingsplan)`, `PLANAFDRAG("${l.id}", ${y + 1})`);
        this.def(`${p}.afdragIflg`, `${l.navn}, afdrag iflg. betalingsplan`, `PLANAFDRAG("${l.id}", ${y})`);
        this.def(`${p}.restgaeldUltimoIflg`, `${l.navn}, restgæld ultimo iflg. betalingsplan`, `${p}.hovedstol - PLANAFDRAGAKK("${l.id}", ${y})`);
        this.def(`${p}.ydelserIflg`, `${l.navn}, ydelser iflg. betalingsplan`, `${p}.renter + ${p}.afdragIflg`);
      } else {
        this.input(`${p}.restgaeldPrimo`, `${l.navn}, restgæld primo`, l.restgaeldPrimo, { group: g });
        this.input(`${p}.kortfristetPrimo`, `${l.navn}, kortfristet del primo (afdrag i ${y})`, l.kortfristetPrimo, { group: g });
        this.input(`${p}.renter`, `${l.navn}, renter og bidrag iflg. årsopgørelse`, l.renter, { group: g });
        this.input(`${p}.kortfristet`, `${l.navn}, kortfristet del (afdrag i ${y + 1})`, l.kortfristet, { group: g });
        if (l.afdragIflg !== null && l.afdragIflg !== undefined && l.afdragIflg !== '')
          this.input(`${p}.afdragIflg`, `${l.navn}, afdrag iflg. årsopgørelse`, l.afdragIflg, { group: g });
        if (l.restgaeldUltimoIflg !== null && l.restgaeldUltimoIflg !== undefined && l.restgaeldUltimoIflg !== '')
          this.input(`${p}.restgaeldUltimoIflg`, `${l.navn}, restgæld ultimo iflg. årsopgørelse`, l.restgaeldUltimoIflg, { group: g });
      }
      this.def(`${p}.ydelser`, `${l.navn}, betalte ydelser`, `-(${K(kontoSum('laan:' + l.id))})`);
      this.def(`${p}.afdrag`, `${l.navn}, afdrag`, `${p}.ydelser - ${p}.renter`);
      this.def(`${p}.restgaeldUltimo`, `${l.navn}, restgæld ultimo`, `${p}.restgaeldPrimo - ${p}.afdrag`);
      this.def(`${p}.afdragAkk`, `${l.navn}, betalte afdrag i alt`, `${p}.hovedstol - ${p}.restgaeldUltimo`);
      this.def(`${p}.langfristet`, `${l.navn}, langfristet del`, `${p}.restgaeldUltimo - ${p}.kortfristet`);
      this.def(`${p}.langfristetPrimo`, `${l.navn}, langfristet del primo`, `${p}.restgaeldPrimo - ${p}.kortfristetPrimo`);
      if (l.kurs !== '' && l.kurs !== null && l.kurs !== undefined && Number(l.kurs) > 0) {
        this.input(`${p}.kurs`, `${l.navn}, kurs pr. balancedagen (%)`, l.kurs, { fmt: 'dec2', group: g });
        this.def(`${p}.kursvaerdi`, `${l.navn}, kursværdi (restgæld × kurs)`, `ROUND(${p}.restgaeldUltimo * ${p}.kurs / 100, 2)`);
      } else this.input(`${p}.kursvaerdi`, `${l.navn}, kursværdi`, l.kursvaerdi, { group: g });
    });
    const ll = (S.laan || []).map(l => l.id);
    const lsum = (f) => `SUM(${K(ll.map(i => `laan.${i}.${f}`))})`;
    this.def('laan.total.restgaeldPrimo', 'Prioritetsgæld, restgæld primo', lsum('restgaeldPrimo'));
    this.def('laan.total.ydelser', 'Betalte ydelser på prioritetsgæld', lsum('ydelser'));
    this.def('laan.total.renter', 'Prioritetsrenter og bidrag i alt', lsum('renter'));
    this.def('laan.total.afdrag', 'Betalte prioritetsafdrag', lsum('afdrag'));
    this.def('laan.total.restgaeldUltimo', 'Prioritetsgæld, regnskabsmæssig værdi (restgæld)', lsum('restgaeldUltimo'));
    this.def('laan.total.kortfristet', 'Kortfristet del af langfristet gæld', lsum('kortfristet'));
    this.def('laan.total.kortfristetPrimo', 'Kortfristet del af langfristet gæld, primo', lsum('kortfristetPrimo'));
    this.def('laan.total.langfristet', 'Gæld til realkreditinstitutter', lsum('langfristet'));
    this.def('laan.total.langfristetPrimo', 'Gæld til realkreditinstitutter, primo', lsum('langfristetPrimo'));
    this.def('laan.total.kursvaerdi', 'Prioritetsgæld, kursværdi', lsum('kursvaerdi'));

    // ---- Resultatlinjer ----
    ALLE_LINJER.forEach(l => {
      const parts = [...kontoSum(l.id)];
      let expr = parts.length ? parts.join(' + ') : '0';
      const regs = regFor(l.id);
      if (regs.length) expr += ' ' + regs.join(' ');
      if (l.laan && ll.length) expr += ' - laan.total.renter';
      this.def(l.id, l.label, expr);
      this.input(`bud.${l.id}`, `Budget ${y + 1}: ${l.label}`, (S.budget || {})[l.id] || 0, { group: 'Budget ' + (y + 1) });
      this.input(`prev.${l.id}`, `Regnskab ${y - 1}: ${l.label}`, ((S.sidsteAar || {}).linjer || {})[l.id] || 0, { group: 'Regnskab ' + (y - 1) });
    });
    NOTER_RESULTAT.forEach(n => {
      this.def(`${n.id}.total`, n.titel, `SUM(${n.linjer.map(l => l.id).join(', ')})`);
      this.def(`bud.${n.id}.total`, `Budget: ${n.titel}`, `SUM(${n.linjer.map(l => 'bud.' + l.id).join(', ')})`);
      this.def(`prev.${n.id}.total`, `Sidste år: ${n.titel}`, `SUM(${n.linjer.map(l => 'prev.' + l.id).join(', ')})`);
    });
    for (const pre of ['', 'bud.', 'prev.']) {
      const t = pre === '' ? '' : pre === 'bud.' ? 'Budget: ' : 'Sidste år: ';
      this.def(`${pre}res.indtaegter`, t + 'Indtægter i alt', `${pre}n1.total + ${pre}n2.total`);
      this.def(`${pre}res.omkostninger`, t + 'Omkostninger i alt', `${pre}n3.total + ${pre}n4.total + ${pre}n5.total + ${pre}n6.total`);
      this.def(`${pre}res.foerFin`, t + 'Resultat før finansielle poster', `${pre}res.indtaegter + ${pre}res.omkostninger`);
      this.def(`${pre}res.fin`, t + 'Finansielle poster', `${pre}n7.total`);
      this.def(`${pre}res.resultat`, t + 'Årets resultat', `${pre}res.foerFin + ${pre}res.fin`);
    }

    // ---- Resultatdisponering ----
    const D = S.disponering || {};
    this.input('disp.vedligehold', 'Overført til "Reserve til vedligeholdelse"', D.tilVedligehold, { group: 'Resultatdisponering' });
    this.input('disp.andre', 'Overført til "Andre reserver"', D.tilAndreReserver, { group: 'Resultatdisponering' });
    this.input('disp.genopretning', 'Overført til "Genopretningskonto"', D.tilGenopretning, { group: 'Resultatdisponering' });
    this.input('ek.vedligehold.anvendt', 'Anvendt af reserve til vedligeholdelse', D.anvendtVedligehold, { group: 'Resultatdisponering' });
    this.input('ek.andre.anvendt', 'Anvendt af andre reserver', D.anvendtAndreReserver, { group: 'Resultatdisponering' });
    this.input('ek.genopretning.anvendt', 'Anvendt af genopretningskonto', D.anvendtGenopretning, { group: 'Resultatdisponering' });
    this.def('disp.anvendt', 'Anvendt af reserver i året (overført til overført resultat)', '-(ek.vedligehold.anvendt + ek.andre.anvendt + ek.genopretning.anvendt)');
    this.def('disp.afdrag', 'Betalte prioritetsafdrag', 'laan.total.afdrag');
    this.def('disp.rest', 'Overført restandel af årets resultat', 'res.resultat - disp.vedligehold - disp.andre - disp.genopretning - disp.anvendt - disp.afdrag');
    this.def('disp.total', 'I alt', 'disp.vedligehold + disp.andre + disp.genopretning + disp.anvendt + disp.afdrag + disp.rest');
    // Budget-disponering: næste års afdrag = kortfristet del af gælden
    this.def('bud.disp.afdrag', 'Budget: prioritetsafdrag', 'laan.total.kortfristet');
    this.input('bud.disp.vedligehold', `Budget ${y + 1}: henlæggelse til vedligeholdelsesfond (vedtægternes § 30, stk. 3)`, S.budgetHenlaeggelse, { group: 'Budget ' + (y + 1) });
    this.def('bud.disp.rest', 'Budget: overført restandel', 'bud.res.resultat - bud.disp.afdrag - bud.disp.vedligehold');
    this.def('bud.disp.total', 'Budget: I alt', 'bud.disp.vedligehold + bud.disp.afdrag + bud.disp.rest');
    const F = S.forsikring || {};
    this.input('forsikring.bestyrelsesansvar', 'Bestyrelsesansvarsforsikring, forsikringssum', F.bestyrelsesansvar, { group: 'Forsikringer' });
    this.input('forsikring.besvigelse', 'Besvigelsesforsikring, forsikringssum', F.besvigelse, { group: 'Forsikringer' });
    this.input('forsikring.bygning', 'Bygningsforsikring, forsikringssum', F.bygning, { group: 'Forsikringer' });

    // ---- Ejendom ----
    const E = S.ejendom || {};
    this.input('ejendom.kostpris.primo', 'Ejendom, kostpris primo', E.kostprisPrimo, { group: 'Ejendom' });
    this.def('ejendom.tilgang', 'Tilgang i året (forbedringer)', `-(${K(kontoSum('bal.ejendom'))})`);
    this.def('ejendom.kostpris.ultimo', 'Ejendom, kostpris ultimo', 'ejendom.kostpris.primo + ejendom.tilgang');
    this.input('ek.opskrivning.primo', 'Opskrivninger primo', E.opskrivningPrimo, { group: 'Ejendom' });
    this.input('ek.opskrivning.aaret', 'Årets opskrivning (+) / tilbageførsel (−)', E.opskrivningAaret, { group: 'Ejendom' });
    this.def('ek.opskrivning.ultimo', 'Reserve for opskrivning af ejendom', 'ek.opskrivning.primo + ek.opskrivning.aaret');
    this.def('ejendom.bogfoert.primo', 'Ejendom, regnskabsmæssig værdi primo', 'ejendom.kostpris.primo + ek.opskrivning.primo');
    this.def('ejendom.bogfoert.ultimo', 'Ejendom, regnskabsmæssig værdi ultimo', 'ejendom.kostpris.ultimo + ek.opskrivning.ultimo');
    this.input('ejendom.vurdering', this.vurderingLabel(), E.vurdering, { group: 'Ejendom' });

    // ---- Egenkapital ----
    const A = S.andele || {};
    const P = S.egenkapitalPrimo || {};
    this.input('andele.antal', 'Antal andele', A.antal, { fmt: 'int', group: 'Andele' });
    this.input('andele.indskud', 'Indskud pr. andel', A.indskudPrAndel, { group: 'Andele' });
    this.def('ek.indskud.ultimo', 'Andelsindskud', 'andele.antal * andele.indskud');
    this.def('ek.indskud.bev', 'Indskud fra nye andele i året', `${K(kontoSum('bal.indskud'))}`);
    this.def('ek.indskud.primo', 'Andelsindskud primo', 'ek.indskud.ultimo - ek.indskud.bev');
    this.input('ek.overfoert.primo', 'Overført resultat primo (korrigeret)', P.overfoertResultat, { group: 'Egenkapital primo' });
    if (P.overfoertIflgRapport !== '' && P.overfoertIflgRapport !== null && P.overfoertIflgRapport !== undefined) {
      this.input('ek.overfoert.primoRapport', `Overført resultat primo iflg. årsrapport ${y - 1}`, P.overfoertIflgRapport, { group: 'Egenkapital primo' });
      this.def('ek.overfoert.korrektion', 'Korrektion vedrørende tidligere år', 'ek.overfoert.primo - ek.overfoert.primoRapport');
    }
    this.def('ek.overfoert.aaret', 'Årets overførte overskud eller underskud', 'disp.rest');
    this.def('ek.overfoert.afdrag', 'Afdrag på prioritetsgæld', 'disp.afdrag');
    this.def('ek.overfoert.anvendt', 'Overført fra reserver (anvendt i året)', '-disp.anvendt');
    this.def('ek.overfoert.ultimo', 'Overført resultat', 'ek.overfoert.primo + ek.overfoert.aaret + ek.overfoert.afdrag + ek.overfoert.anvendt');
    this.def('ek.foerReserver.primo', 'Egenkapital før generalforsamlingsbestemte reserver, primo', 'ek.indskud.primo + ek.opskrivning.primo + ek.overfoert.primo');
    this.def('ek.foerReserver.ultimo', 'Egenkapital før generalforsamlingsbestemte reserver', 'ek.indskud.ultimo + ek.opskrivning.ultimo + ek.overfoert.ultimo');
    this.input('ek.genopretning.primo', 'Genopretningskonto primo', P.genopretning, { group: 'Egenkapital primo' });
    this.def('ek.genopretning.henlagt', 'Henlagt ifølge resultatdisponering', 'disp.genopretning');
    this.def('ek.genopretning.ultimo', 'Genopretningskonto', 'ek.genopretning.primo + ek.genopretning.henlagt - ek.genopretning.anvendt');
    this.input('ek.vedligehold.primo', 'Reserve til vedligeholdelse primo', P.vedligehold, { group: 'Egenkapital primo' });
    this.def('ek.vedligehold.henlagt', 'Henlagt ifølge resultatdisponering', 'disp.vedligehold');
    this.def('ek.vedligehold.ultimo', 'Reserve til vedligeholdelse af ejendommen', 'ek.vedligehold.primo + ek.vedligehold.henlagt - ek.vedligehold.anvendt');
    this.input('ek.andre.primo', 'Andre reserver primo', P.andreReserver, { group: 'Egenkapital primo' });
    this.def('ek.andre.henlagt', 'Henlagt ifølge resultatdisponering', 'disp.andre');
    this.def('ek.andre.ultimo', 'Andre reserver', 'ek.andre.primo + ek.andre.henlagt - ek.andre.anvendt');
    this.def('ek.reserver.primo', 'Reserver i alt, primo', 'ek.genopretning.primo + ek.vedligehold.primo + ek.andre.primo');
    this.def('ek.reserver.ultimo', 'Generalforsamlingsbestemte reserver i alt', 'ek.genopretning.ultimo + ek.vedligehold.ultimo + ek.andre.ultimo');
    this.def('ek.total.primo', 'Egenkapital i alt, primo', 'ek.foerReserver.primo + ek.reserver.primo');
    this.def('ek.total.ultimo', 'Egenkapital i alt', 'ek.foerReserver.ultimo + ek.reserver.ultimo');

    // ---- Anden gæld, tilgodehavender, forudmodtaget ----
    (S.andenGaeld || []).forEach(a => {
      this.input(`ag.${a.id}.primo`, `${a.tekst}, primo`, a.primo, { group: 'Anden gæld primo' });
      const regs = regForBalance('ag:' + a.id);
      this.def(`ag.${a.id}.bev`, `${a.tekst}, bevægelse i året`, `${K(kontoSum('ag:' + a.id))}` + (regs.length ? ' + ' + regs.join(' + ') : ''));
      this.def(`ag.${a.id}.ultimo`, a.tekst, `ag.${a.id}.primo + ag.${a.id}.bev`);
    });
    const ag = (S.andenGaeld || []).map(a => a.id);
    this.def('ag.total.primo', 'Anden gæld, primo', `SUM(${K(ag.map(i => `ag.${i}.primo`))})`);
    this.def('ag.total.ultimo', 'Anden gæld', `SUM(${K(ag.map(i => `ag.${i}.ultimo`))})`);
    (S.tilgodehavender || []).forEach(t => {
      this.input(`tg.${t.id}.primo`, `${t.tekst}, primo`, t.primo, { group: 'Tilgodehavender primo' });
      const regs = regForBalance('tg:' + t.id);
      this.def(`tg.${t.id}.bev`, `${t.tekst}, bevægelse i året`, `-(${K(kontoSum('tg:' + t.id))})` + (regs.length ? ' + ' + regs.join(' + ') : ''));
      this.def(`tg.${t.id}.ultimo`, t.tekst, `tg.${t.id}.primo + tg.${t.id}.bev`);
    });
    const tg = (S.tilgodehavender || []).map(t => t.id);
    this.def('tg.total.primo', 'Tilgodehavender, primo', `SUM(${K(tg.map(i => `tg.${i}.primo`))})`);
    this.def('tg.total.ultimo', 'Tilgodehavender', `SUM(${K(tg.map(i => `tg.${i}.ultimo`))})`);
    this.input('forud.primo', 'Forudmodtaget boligafgift, primo', (S.forudmodtaget || {}).primo, { group: 'Anden gæld primo' });
    { const regs = regForBalance('forud');
      this.def('forud.bev', 'Forudmodtaget boligafgift, bevægelse', `${K(kontoSum('bal.forud'))}` + (regs.length ? ' + ' + regs.join(' + ') : '')); }
    this.def('forud.ultimo', 'Forudmodtaget boligafgift', 'forud.primo + forud.bev');
    this.def('bal.overfoersel', 'Overførsler mellem likvide konti (skal være 0)', `${K(kontoSum('bal.overfoersel'))}`);

    // ---- Balance ----
    this.def('bal.anlaeg.primo', 'Anlægsaktiver i alt, primo', 'ejendom.bogfoert.primo');
    this.def('bal.anlaeg.ultimo', 'Anlægsaktiver i alt', 'ejendom.bogfoert.ultimo');
    this.def('bal.omsaetning.primo', 'Omsætningsaktiver i alt, primo', 'tg.total.primo + likvid.total.primo');
    this.def('bal.omsaetning.ultimo', 'Omsætningsaktiver i alt', 'tg.total.ultimo + likvid.total.ultimo');
    this.def('bal.aktiver.primo', 'Aktiver i alt, primo', 'bal.anlaeg.primo + bal.omsaetning.primo');
    this.def('bal.aktiver.ultimo', 'Aktiver i alt', 'bal.anlaeg.ultimo + bal.omsaetning.ultimo');
    this.def('bal.langfristet.primo', 'Langfristede gældsforpligtelser i alt, primo', 'laan.total.langfristetPrimo');
    this.def('bal.langfristet.ultimo', 'Langfristede gældsforpligtelser i alt', 'laan.total.langfristet');
    this.def('bal.kortfristet.primo', 'Kortfristede gældsforpligtelser i alt, primo', 'laan.total.kortfristetPrimo + forud.primo + ag.total.primo');
    this.def('bal.kortfristet.ultimo', 'Kortfristede gældsforpligtelser i alt', 'laan.total.kortfristet + forud.ultimo + ag.total.ultimo');
    this.def('bal.gaeld.primo', 'Gældsforpligtelser i alt, primo', 'bal.langfristet.primo + bal.kortfristet.primo');
    this.def('bal.gaeld.ultimo', 'Gældsforpligtelser i alt', 'bal.langfristet.ultimo + bal.kortfristet.ultimo');
    this.def('bal.passiver.primo', 'Passiver i alt, primo', 'ek.total.primo + bal.gaeld.primo');
    this.def('bal.passiver.ultimo', 'Passiver i alt', 'ek.total.ultimo + bal.gaeld.ultimo');
    this.def('bal.diff.primo', 'Difference aktiver − passiver, primo', 'bal.aktiver.primo - bal.passiver.primo');
    this.def('bal.diff.ultimo', 'Difference aktiver − passiver', 'bal.aktiver.ultimo - bal.passiver.ultimo');
    // Kontrolnoder
    this.def('res.check', 'Kontrol: indtægter + omkostninger + finansielle poster', 'res.indtaegter + res.omkostninger + res.fin');
    this.def('ek.check', 'Kontrol: egenkapital primo + resultat + opskrivning + nye indskud', 'ek.total.primo + res.resultat + ek.opskrivning.aaret + ek.indskud.bev');

    // ---- Pengestrøm (kontrol) ----
    const regPl = (S.reguleringer || []).map(r => (String(r.balancepost || '').startsWith('tg:') ? '- ' : '+ ') + `reg.${r.id}`).join(' ');
    this.def('cf.drift', 'Årets resultat korrigeret for ikke-likvide reguleringer', 'res.resultat ' + regPl);
    const cfDele = ['-laan.total.afdrag', 'ek.indskud.bev', '-ejendom.tilgang', 'bal.overfoersel'];
    for (const linje of ['bal.forud', ...ag.map(i => 'ag:' + i), ...tg.map(i => 'tg:' + i)]) cfDele.push(...kontoSum(linje));
    this.def('cf.balance', 'Likvide bevægelser på balanceposter', cfDele.join(' + '));
    this.def('cf.beregnet', 'Beregnet ændring i likvide beholdninger', 'cf.drift + cf.balance');
    this.def('cf.faktisk', 'Faktisk ændring i likvide beholdninger', 'likvid.total.ultimo - likvid.total.primo');
    this.def('cf.diff', 'Difference (ikke-konterede posteringer)', 'cf.faktisk - cf.beregnet');

    // ---- Andelsværdi ----
    this.def('av.ek', 'Andelsboligforeningens egenkapital før generalforsamlingsbestemte reserver', 'ek.foerReserver.ultimo');
    this.def('av.vurdering', this.vurderingLabel(), 'ejendom.vurdering');
    this.def('av.bogfoert', 'Ejendommens regnskabsmæssige værdi', '-ejendom.bogfoert.ultimo');
    this.def('av.sub1', 'Egenkapital korrigeret for ejendommens værdi', 'av.ek + av.vurdering + av.bogfoert');
    this.def('av.gaeldRegnskab', 'Prioritetsgæld, regnskabsmæssig værdi', 'laan.total.restgaeldUltimo');
    this.def('av.gaeldKurs', 'Prioritetsgæld, kursværdi', '-laan.total.kursvaerdi');
    this.input('av.andre', 'Andre reguleringer jf. vedtægter/generalforsamling', A.andreReguleringer, { group: 'Andelsværdi' });
    this.def('av.vaerdi', 'Beregnet formue til fordeling (maksimal andelsværdi)', 'av.sub1 + av.gaeldRegnskab + av.gaeldKurs + av.andre');
    if ((A.fordelingstalType || 'indskud') === 'indskud') this.def('av.fordelingstal', 'Fordelingstal: indskudt andelskapital', 'ek.indskud.ultimo');
    else this.input('av.fordelingstal', 'Fordelingstal i alt', A.fordelingstalAndet, { group: 'Andelsværdi' });
    this.def('av.prKrone', 'Andelsværdi pr. andelskrone', 'ROUND(SAFEDIV(av.vaerdi, av.fordelingstal), 2)', { fmt: 'dec2' });
    this.def('av.prAndel', 'Andelsværdi pr. andel', 'ROUND(SAFEDIV(av.vaerdi, av.fordelingstal) * andele.indskud, 0)', { fmt: 'int' });
    this.input('av.senest', 'Senest vedtagne andelsværdi pr. andelskrone', A.senestVedtagetPrKrone, { fmt: 'dec2', group: 'Andelsværdi' });
    this.def('av.senestPrAndel', 'Senest vedtagne andelsværdi pr. andel', 'ROUND(av.senest * andele.indskud, 0)', { fmt: 'int' });
    this.def('av.aendringPct', 'Ændring i forhold til senest vedtagne', 'ROUND(SAFEDIV(av.prKrone - av.senest, av.senest) * 100, 1)', { fmt: 'pct' });
    this.def('av.prM2', 'Andelsværdi pr. m² boligareal (formue til fordeling / B1 + B2)', 'ROUND(SAFEDIV(av.vaerdi, nk.areal.y0.bolig), 0)', { fmt: 'int' });
    this.def('av.senestPrM2', 'Senest vedtagne andelsværdi pr. m²', 'ROUND(SAFEDIV(av.senest * av.fordelingstal, nk.areal.y0.bolig), 0)', { fmt: 'int' });
    (S.andelshavere || []).forEach(a => {
      if (a.areal !== '' && a.areal !== null && a.areal !== undefined && Number(a.areal) > 0) {
        this.input(`andel.${a.id}.areal`, `${a.adresse}, boligareal (BBR)`, a.areal, { fmt: 'int', group: 'Andele' });
        this.def(`andel.${a.id}.vaerdiM2`, `${a.adresse}, handelsværdi efter kvadratmeterpris`, `ROUND(andel.${a.id}.areal * av.prM2, 0)`, { fmt: 'int' });
        this.def(`andel.${a.id}.vaerdiSenestM2`, `${a.adresse}, senest vedtagne værdi efter kvadratmeterpris`, `ROUND(andel.${a.id}.areal * av.senestPrM2, 0)`, { fmt: 'int' });
      }
    });

    // ---- Nøgleoplysninger ----
    const N = S.noegle || {};
    const AR = N.arealer || {};
    const typer = [['b1', 'Andelsboliger'], ['b2', 'Erhvervsandele'], ['b3', 'Boliglejemål'], ['b4', 'Erhvervslejemål'], ['b5', 'Øvrige lejemål, kældre, garager m.m.']];
    for (const yy of ['y2', 'y1', 'y0']) {
      const yr = y - { y2: 2, y1: 1, y0: 0 }[yy];
      typer.forEach(([b, t]) => this.input(`nk.areal.${yy}.${b}`, `${t}, BBR-areal ${yr}`, (AR[yy] || {})[b], { fmt: 'int', group: 'Nøgleoplysninger: arealer' }));
      this.def(`nk.areal.${yy}.b6`, `Areal i alt ${yr}`, `SUM(${typer.map(([b]) => `nk.areal.${yy}.${b}`).join(', ')})`, { fmt: 'int' });
      this.def(`nk.areal.${yy}.bolig`, `Areal andelsboliger og erhvervsandele (B1 + B2) ${yr}`, `nk.areal.${yy}.b1 + nk.areal.${yy}.b2`, { fmt: 'int' });
    }
    typer.forEach(([b, t]) => this.input(`nk.antal.${b}`, `${t}, antal`, (N.antal || {})[b], { fmt: 'int', group: 'Nøgleoplysninger: arealer' }));
    this.def('nk.antal.b6', 'Antal i alt', `SUM(${typer.map(([b]) => `nk.antal.${b}`).join(', ')})`, { fmt: 'int' });
    this.def('nk.f2', 'F2 Ejendommens værdi ved det anvendte vurderingsprincip', 'av.vurdering');
    this.def('nk.f2.m2', 'F2 kr. pr. m²', 'ROUND(SAFEDIV(nk.f2, nk.areal.y0.b6), 0)', { fmt: 'int' });
    this.def('nk.f3', 'F3 Generalforsamlingsbestemte reserver', 'ek.reserver.ultimo');
    this.def('nk.f3.m2', 'F3 kr. pr. m²', 'ROUND(SAFEDIV(nk.f3, nk.areal.y0.b6), 0)', { fmt: 'int' });
    this.def('nk.f4', 'F4 Reserver i procent af ejendomsværdi', 'ROUND(SAFEDIV(nk.f3 * 100, nk.f2), 1)', { fmt: 'pct' });
    this.input('nk.h1.maaned', 'Boligafgift, december måned', N.boligafgiftDecember, { group: 'Nøgleoplysninger' });
    this.input('nk.h2.maaned', 'Erhvervslejeindtægter, december måned', N.erhvervslejeDecember, { group: 'Nøgleoplysninger' });
    this.input('nk.h3.maaned', 'Boliglejeindtægter, december måned', N.boliglejeDecember, { group: 'Nøgleoplysninger' });
    this.def('nk.h1', 'H1 Boligafgift pr. m²', 'ROUND(SAFEDIV(nk.h1.maaned * 12, nk.areal.y0.bolig), 0)', { fmt: 'int' });
    this.def('nk.h2', 'H2 Erhvervslejeindtægter pr. m²', 'ROUND(SAFEDIV(nk.h2.maaned * 12, nk.areal.y0.bolig), 0)', { fmt: 'int' });
    this.def('nk.h3', 'H3 Boliglejeindtægter pr. m²', 'ROUND(SAFEDIV(nk.h3.maaned * 12, nk.areal.y0.bolig), 0)', { fmt: 'int' });
    this.input('nk.j.y2', `J Årets resultat pr. m² ${y - 2}`, (N.resultatPrM2 || {}).y2, { fmt: 'int', group: 'Nøgleoplysninger: tidligere år' });
    this.input('nk.j.y1', `J Årets resultat pr. m² ${y - 1}`, (N.resultatPrM2 || {}).y1, { fmt: 'int', group: 'Nøgleoplysninger: tidligere år' });
    this.def('nk.j.y0', `J Årets resultat pr. m² ${y}`, 'ROUND(SAFEDIV(res.resultat, nk.areal.y0.bolig), 0)', { fmt: 'int' });
    this.def('nk.k1', 'K1 Andelsværdi pr. m²', 'ROUND(SAFEDIV(av.vaerdi, nk.areal.y0.bolig), 0)', { fmt: 'int' });
    this.def('nk.k2', 'K2 (Gældsforpligtelser − omsætningsaktiver) pr. m²', 'ROUND(SAFEDIV(bal.gaeld.ultimo - bal.omsaetning.ultimo, nk.areal.y0.bolig), 0)', { fmt: 'int' });
    this.def('nk.k3', 'K3 Teknisk andelsværdi pr. m²', 'nk.k1 + nk.k2', { fmt: 'int' });
    this.input('nk.m1.y2', `M1 Vedligeholdelse, løbende pr. m² ${y - 2}`, (N.vedligeholdLoebende || {}).y2, { fmt: 'int', group: 'Nøgleoplysninger: tidligere år' });
    this.input('nk.m1.y1', `M1 Vedligeholdelse, løbende pr. m² ${y - 1}`, (N.vedligeholdLoebende || {}).y1, { fmt: 'int', group: 'Nøgleoplysninger: tidligere år' });
    this.def('nk.m1.y0', `M1 Vedligeholdelse, løbende pr. m² ${y}`, 'ROUND(SAFEDIV(-n4.loebende, nk.areal.y0.b6), 0)', { fmt: 'int' });
    this.input('nk.m2.y2', `M2 Vedligeholdelse, genopretning og renovering pr. m² ${y - 2}`, (N.vedligeholdGenopretning || {}).y2, { fmt: 'int', group: 'Nøgleoplysninger: tidligere år' });
    this.input('nk.m2.y1', `M2 Vedligeholdelse, genopretning og renovering pr. m² ${y - 1}`, (N.vedligeholdGenopretning || {}).y1, { fmt: 'int', group: 'Nøgleoplysninger: tidligere år' });
    this.def('nk.m2.y0', `M2 Vedligeholdelse, genopretning og renovering pr. m² ${y}`, 'ROUND(SAFEDIV(-n4.genopretning, nk.areal.y0.b6), 0)', { fmt: 'int' });
    for (const yy of ['y2', 'y1', 'y0']) this.def(`nk.m3.${yy}`, `M3 Vedligeholdelse i alt pr. m² ${y - { y2: 2, y1: 1, y0: 0 }[yy]}`, `nk.m1.${yy} + nk.m2.${yy}`, { fmt: 'int' });
    this.def('nk.p', 'P Friværdi (ejendommens regnskabsmæssige værdi − gæld) i %', 'ROUND(SAFEDIV((ejendom.bogfoert.ultimo - bal.gaeld.ultimo) * 100, ejendom.bogfoert.ultimo), 0)', { fmt: 'pct0' });
    this.input('nk.r.y2', `R Årets afdrag pr. m² ${y - 2}`, (N.afdragPrM2 || {}).y2, { fmt: 'int', group: 'Nøgleoplysninger: tidligere år' });
    this.input('nk.r.y1', `R Årets afdrag pr. m² ${y - 1}`, (N.afdragPrM2 || {}).y1, { fmt: 'int', group: 'Nøgleoplysninger: tidligere år' });
    this.def('nk.r.y0', `R Årets afdrag pr. m² ${y}`, 'ROUND(SAFEDIV(laan.total.afdrag, nk.areal.y0.bolig), 0)', { fmt: 'int' });
  }

  vurderingLabel() {
    const p = VURDERINGSPRINCIPPER.find(v => v.id === (this.state.ejendom || {}).vurderingsprincip) || VURDERINGSPRINCIPPER[2];
    const t = (this.state.ejendom || {}).vurderingTekst;
    return { anskaffelse: 'Ejendommens anskaffelsespris', valuar: 'Ejendommens valuarvurdering', offentlig: 'Ejendommens offentlige ejendomsvurdering', indekseret: 'Nettoprisindekseret offentlig ejendomsvurdering' }[p.id] + (t ? ' ' + t : '');
  }

  // Alle noder med værdi – til test og fejlsøgning
  alle() {
    return this.order.map(id => ({ id, label: this.label(id), value: this.get(id), input: this.node(id).input, expr: this.node(id).expr }));
  }
}
