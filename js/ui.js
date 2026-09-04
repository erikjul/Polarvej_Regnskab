// ui.js – brugerflade: indtastningsfaner, rapportvisning med formelsporing og kontrolside.
import { Engine } from './engine.js';
import { byggeRapport } from './report.js';
import { kontroller } from './controls.js';
import { NOTER_RESULTAT, ALLE_LINJER, alleMappings, STANDARD_KONTOPLAN, STANDARD_TEKSTER, VURDERINGSPRINCIPPER, FORDELINGSTAL, tomState, normaliser, nyId } from './model.js';
import { eksempelPolarvej2025, eksempelSamling } from './eksempel.js';
import { fmtKr, fmtInt, fmtBy, parseTal, num } from './format.js';
import { gemLokalt, hentLokalt, gemSomFil, laesFil } from './storage.js';
import { nySamling, migrer, aarListe, erKoblet, engineFor, opretNytAar, PRIMO_STI } from './samling.js';
import { parseBetalingsplan, planAar, aarAf, sorter, sidsteTermin, restloebetid } from './betalingsplan.js';
import { parseBankCsv, forberedImport } from './import.js';
import { boligafgiftOversigt, MAANEDER, STANDARD_ANDELSHAVERE } from './boligafgift.js';
import { vedtaegtstjek } from './vedtaegter.js';
import { STANDARD_IMPORTREGLER } from './model.js';
import { eksporterExcel } from './excel.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };

export class App {
  constructor() {
    this.tab = 'stamdata';
    this.visFormler = false;
    this.state = null;
  }

  init() {
    const gemt = migrer(hentLokalt());
    this.setSamling(gemt || eksempelSamling(), !gemt);
    document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => this.visTab(b.dataset.tab)));
    document.getElementById('aar-valg').addEventListener('change', (e) => this.skiftAar(Number(e.target.value)));
    document.getElementById('btn-nyt-aar').addEventListener('click', () => this.nytAar());
    document.getElementById('btn-ny').addEventListener('click', () => {
      if (confirm('Start helt forfra med et nyt, tomt regnskab? Alle regnskabsår i programmet erstattes. Husk at gemme som fil først.')) {
        const aar = parseInt(prompt('Regnskabsår:', String(new Date().getFullYear() - 1)) || '', 10);
        this.setSamling(nySamling(tomState(Number.isFinite(aar) ? aar : new Date().getFullYear() - 1))); this.visTab('stamdata');
      }
    });
    document.getElementById('btn-eksempel').addEventListener('click', () => {
      if (confirm('Erstat alle regnskabsår i programmet med eksempeldata (Polarvej I, 2021–2025 fra bankens eksporter)?')) { this.setSamling(eksempelSamling()); this.visTab('stamdata'); }
    });
    document.getElementById('btn-gem').addEventListener('click', () => gemSomFil(this.samling));
    document.getElementById('btn-aabn').addEventListener('click', () => document.getElementById('fil-input').click());
    document.getElementById('fil-input').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const s = migrer(await laesFil(f)); if (!s) throw new Error('Filen indeholder ikke et regnskab'); this.setSamling(s); this.toast('Regnskabet er indlæst'); this.visTab('stamdata'); }
      catch (err) { alert('Kunne ikke læse filen: ' + err.message); }
      e.target.value = '';
    });
    document.getElementById('btn-excel').addEventListener('click', async () => {
      try { await eksporterExcel(this.engine, this.rapport, this.kontrol); this.toast('Excel-fil genereret'); }
      catch (err) { console.error(err); alert('Excel-eksport fejlede: ' + err.message); }
    });
    document.getElementById('btn-pdf').addEventListener('click', () => { this.visTab('rapport'); setTimeout(() => window.print(), 150); });
    document.getElementById('chk-formler').addEventListener('change', (e) => { this.visFormler = e.target.checked; document.getElementById('rapport').classList.toggle('vis-formler', this.visFormler); });
    document.getElementById('spor-luk').addEventListener('click', () => document.getElementById('spor').classList.remove('open'));
    document.getElementById('rapport').addEventListener('click', (e) => { const v = e.target.closest('.val'); if (v) this.visSpor(v.dataset.node); });
    document.getElementById('tab-kontrol').addEventListener('click', (e) => { const v = e.target.closest('.val'); if (v) this.visSpor(v.dataset.node); });
    this.visTab(this.tab);
  }

  setSamling(samling, stille) {
    this.samling = samling;
    this.state = samling.regnskaber[samling.aktivAar];
    this.recompute();
    if (!stille) this.toast('Data indlæst');
  }

  skiftAar(aar) {
    if (!this.samling.regnskaber[aar]) return;
    this.samling.aktivAar = aar;
    this.state = this.samling.regnskaber[aar];
    this.recompute();
    this.renderTab(this.tab);
    this.toast('Viser regnskabsåret ' + aar);
  }

  nytAar() {
    const fra = this.state.aar;
    if (this.samling.regnskaber[fra + 1]) { this.skiftAar(fra + 1); return; }
    if (!confirm(`Opret regnskabsåret ${fra + 1}? Primotal, sidste års resultat og nøgletal hentes automatisk fra ${fra} og følger med, hvis ${fra} rettes senere.`)) return;
    opretNytAar(this.samling, fra);
    this.state = this.samling.regnskaber[fra + 1];
    this.recompute();
    this.visTab('kasserapport');
    this.toast(`Regnskabsåret ${fra + 1} er oprettet`);
  }

  sletAar() {
    const aar = this.state.aar;
    const liste = aarListe(this.samling);
    if (liste.length === 1) { alert('Det eneste regnskabsår kan ikke slettes. Brug "Nyt" for at starte forfra.'); return; }
    if (this.samling.regnskaber[aar + 1]) { alert(`Slet først ${aar + 1}, som bygger på ${aar}.`); return; }
    if (!confirm(`Slet regnskabsåret ${aar} permanent? (Gem evt. som fil først.)`)) return;
    delete this.samling.regnskaber[aar];
    this.skiftAar(aarListe(this.samling).pop());
  }

  erKoblet() { return erKoblet(this.samling, this.state.aar); }

  recompute() {
    try {
      this.engine = engineFor(this.samling, this.state.aar);
      this.kontrol = kontroller(this.engine);
      let restancer;
      if ((this.state.andelshavere || []).length) { const ov = boligafgiftOversigt(this.samling, this.state.andelshavere, `${this.state.aar}-12`); restancer = ov.andele.reduce((s, r) => s + (r.saldo < 0 ? -r.saldo : 0), 0); }
      this.vedtaegter = vedtaegtstjek(this.engine, { restancer });
      this.rapport = byggeRapport(this.engine, { kontrol: this.kontrol, samling: this.samling, vedtaegter: this.vedtaegter });
      this.fejl = null;
    } catch (e) {
      console.error(e);
      this.fejl = e.message;
    }
    gemLokalt(this.samling);
    const sel = document.getElementById('aar-valg');
    sel.innerHTML = aarListe(this.samling).map(a => `<option value="${a}" ${a === this.state.aar ? 'selected' : ''}>${a}${erKoblet(this.samling, a) ? ' ⇐' : ''}</option>`).join('');
    document.getElementById('btn-nyt-aar').textContent = this.samling.regnskaber[this.state.aar + 1] ? `Gå til ${this.state.aar + 1} →` : `+ Nyt år (${this.state.aar + 1})`;
    const b = document.getElementById('status-badge');
    if (this.fejl) { b.textContent = 'Fejl: ' + this.fejl; b.className = 'status-badge fejl'; return; }
    const k = this.kontrol.antal;
    b.className = 'status-badge ' + (k.fejl ? 'fejl' : k.advarsel ? 'advarsel' : 'ok');
    b.textContent = k.fejl ? `${k.fejl} fejl` : k.advarsel ? `Balancerer · ${k.advarsel} advarsler` : 'Balancerer ✓';
    b.title = 'Se kontrolsiden';
    b.onclick = () => this.visTab('kontrol');
    if (this.tab === 'rapport') this.renderRapport();
    if (this.tab === 'kontrol') this.renderKontrol();
  }

  visTab(id) {
    this.tab = id;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    document.querySelectorAll('main > .tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + id));
    this.renderTab(id);
    window.scrollTo(0, 0);
  }

  renderTab(id) {
    const el = document.getElementById('tab-' + id);
    switch (id) {
      case 'stamdata': el.innerHTML = this.htmlStamdata(); break;
      case 'kasserapport': el.innerHTML = this.htmlKasserapport(); this.bindImport(el); break;
      case 'boligafgift': el.innerHTML = this.htmlBoligafgift(); break;
      case 'kontoplan': el.innerHTML = this.htmlKontoplan(); break;
      case 'balance': el.innerHTML = this.htmlBalance(); break;
      case 'budget': el.innerHTML = this.htmlBudget(); break;
      case 'noegle': el.innerHTML = this.htmlNoegle(); break;
      case 'tekster': el.innerHTML = this.htmlTekster(); break;
      case 'rapport': this.renderRapport(); return;
      case 'kontrol': this.renderKontrol(); return;
      case 'vedtaegter': this.renderVedtaegter(el); return;
      case 'arkiv': this.renderArkiv(el); return;
      case 'hjaelp': el.innerHTML = this.htmlHjaelp(); return;
    }
    this.bind(el);
  }

  toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this._toast); this._toast = setTimeout(() => t.classList.remove('show'), 1800); }

  // ---------- generiske felter ----------
  felt(label, path, type = 'text', opts = {}) {
    const v = getPath(this.state, path);
    const id = 'f_' + path.replace(/[^a-zA-Z0-9]/g, '_');
    let input;
    if (type === 'num' || type === 'int') input = `<input type="text" inputmode="decimal" class="num" id="${id}" data-path="${path}" data-type="${type}" ${/IflgRapport|kontoudtog|Iflg$|\.kurs$/.test(path) ? 'data-allow-empty="1"' : ''} ${opts.rerender ? 'data-rerender="1"' : ''} value="${v === null || v === undefined || v === '' ? '' : (type === 'int' ? fmtInt(v) : fmtKr(v))}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''}>`;
    else if (type === 'bool') input = `<label class="check"><input type="checkbox" id="${id}" data-path="${path}" data-type="bool" ${v ? 'checked' : ''}> ${esc(opts.checkLabel || '')}</label>`;
    else if (type === 'date') input = `<input type="date" id="${id}" data-path="${path}" data-type="text" value="${esc(v || '')}">`;
    else if (type === 'select') input = `<select id="${id}" data-path="${path}" data-type="${opts.numeric ? 'numsel' : 'text'}" ${opts.rerender ? 'data-rerender="1"' : ''}>${opts.options.map(o => `<option value="${esc(o.id)}" ${String(o.id) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    else if (type === 'textarea') input = `<textarea id="${id}" data-path="${path}" data-type="text" rows="${opts.rows || 6}">${esc(v || '')}</textarea>`;
    else input = `<input type="text" id="${id}" data-path="${path}" data-type="text" value="${esc(v ?? '')}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''}>`;
    return `<div class="felt ${opts.wide ? 'wide' : ''}"><label for="${id}">${esc(label)}</label>${input}${opts.hint ? `<span class="hint">${esc(opts.hint)}</span>` : ''}</div>`;
  }

  // Redigerbar tabel for lister i state
  tabel(basePath, cols, opts = {}) {
    const items = getPath(this.state, basePath) || [];
    const th = cols.map(c => `<th class="${c.width || ''}">${esc(c.label)}</th>`).join('') + (opts.beregnet ? opts.beregnet.map(b => `<th class="num">${esc(b.label)}</th>`).join('') : '') + '<th class="w-slet"></th>';
    const rows = items.map((it, i) => {
      const tds = cols.map(c => {
        const p = `${basePath}.${i}.${c.key}`;
        const v = it[c.key];
        let inp;
        if (c.type === 'num' || c.type === 'int') inp = `<input type="text" inputmode="decimal" class="num" data-path="${p}" data-type="${c.type}" ${basePath === 'importRegler' || c.key === 'kontoudtog' || c.key === 'afdragIflg' || c.key === 'restgaeldUltimoIflg' ? 'data-allow-empty="1"' : ''} value="${v === null || v === undefined || v === '' ? '' : (c.type === 'int' ? fmtInt(v) : fmtKr(v))}">`;
        else if (c.type === 'date') inp = `<input type="date" data-path="${p}" data-type="text" value="${esc(v || '')}">`;
        else if (c.type === 'select') { const o = typeof c.options === 'function' ? c.options(it) : c.options; inp = `<select data-path="${p}" data-type="${c.numeric ? 'numsel' : 'text'}"><option value="">–</option>${o.map(x => `<option value="${esc(x.id)}" ${String(x.id) === String(v ?? '') ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`; }
        else if (c.type === 'bool') inp = `<input type="checkbox" data-path="${p}" data-type="bool" ${v ? 'checked' : ''}>`;
        else if (c.type === 'ro') inp = `<span>${esc(v ?? '')}</span>`;
        else inp = `<input type="text" data-path="${p}" data-type="text" value="${esc(v ?? '')}">`;
        return `<td class="${c.type === 'num' || c.type === 'int' ? 'num' : ''}">${inp}</td>`;
      }).join('');
      const calc = opts.beregnet ? opts.beregnet.map(b => `<td class="num" style="text-align:right">${esc(b.value(it, i))}</td>`).join('') : '';
      return `<tr>${tds}${calc}<td><button class="knap lille slet" data-slet="${basePath}" data-index="${i}" title="Slet række">✕</button></td></tr>`;
    }).join('');
    const sum = opts.sum ? `<tr class="sum">${opts.sum()}</tr>` : '';
    return `<table class="edit"><thead><tr>${th}</tr></thead><tbody>${rows}${sum}</tbody></table>
      <div class="knapper"><button class="knap" data-tilfoej="${basePath}">+ ${esc(opts.tilfoejLabel || 'Tilføj række')}</button>${opts.ekstraKnapper || ''}</div>`;
  }

  bind(el) {
    if (this.erKoblet()) el.querySelectorAll('[data-path]').forEach(inp => { if (PRIMO_STI.test(inp.dataset.path)) { inp.disabled = true; inp.title = `Hentes automatisk fra ${this.state.aar - 1}`; } });
    el.querySelectorAll('[data-path^="laan."]').forEach(inp => {
      const m = /^laan\.(\d+)\.(restgaeldPrimo|kortfristetPrimo|renter|kortfristet|afdragIflg|restgaeldUltimoIflg)$/.exec(inp.dataset.path);
      if (m && this.engine && this.engine.harPlan(this.state.laan[Number(m[1])] || {})) { inp.disabled = true; inp.title = 'Hentes fra betalingsplanen'; }
      const mk = /^laan\.(\d+)\.kursvaerdi$/.exec(inp.dataset.path);
      if (mk && this.engine) { const l = this.state.laan[Number(mk[1])]; if (l && !this.engine.node(`laan.${l.id}.kursvaerdi`).input) { inp.disabled = true; inp.value = fmtKr(this.engine.get(`laan.${l.id}.kursvaerdi`)); inp.title = 'Beregnet som restgæld × kurs'; } }
    });
    el.querySelectorAll('[data-path]').forEach(inp => {
      const type = inp.dataset.type;
      const handler = () => {
        let v;
        if (type === 'num' || type === 'int') { v = inp.value.trim() === '' ? (inp.dataset.allowEmpty ? '' : 0) : parseTal(inp.value); inp.value = inp.value.trim() === '' && inp.dataset.allowEmpty ? '' : (type === 'int' ? fmtInt(v) : fmtKr(v)); }
        else if (type === 'bool') v = inp.checked;
        else if (type === 'numsel') v = inp.value === '' ? '' : Number(inp.value);
        else v = inp.value;
        setPath(this.state, inp.dataset.path, v);
        this.recompute();
        if (inp.dataset.rerender) this.renderTab(this.tab);
        else this.opdaterBeregnede(el);
      };
      inp.addEventListener('change', handler);
    });
    el.querySelectorAll('[data-slet]').forEach(b => b.addEventListener('click', () => {
      const arr = getPath(this.state, b.dataset.slet); arr.splice(Number(b.dataset.index), 1); this.recompute(); this.renderTab(this.tab);
    }));
    el.querySelectorAll('[data-tilfoej]').forEach(b => b.addEventListener('click', () => { this.tilfoej(b.dataset.tilfoej); this.recompute(); this.renderTab(this.tab); }));
    el.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => this.action(b.dataset.action, b)));
  }

  // Opdaterer "beregnede" celler (data-calc="nodeId") uden at gen-rendere formularen
  opdaterBeregnede(el) {
    if (!this.engine) return;
    el.querySelectorAll('[data-calc]').forEach(c => { try { c.textContent = fmtBy(this.engine.get(c.dataset.calc), c.dataset.fmt || 'kr'); } catch (e) { c.textContent = '?'; } });
    el.querySelectorAll('[data-calc-fn]').forEach(c => { c.textContent = this.calcFn(c.dataset.calcFn); });
  }
  calcFn(name) {
    const S = this.state;
    if (name.startsWith('konto:')) { return fmtKr(this.engine.konto(Number(name.slice(6)))); }
    if (name === 'kasse.ind') return fmtKr(S.posteringer.reduce((s, p) => s + num(p.ind), 0));
    if (name === 'kasse.ud') return fmtKr(S.posteringer.reduce((s, p) => s + num(p.ud), 0));
    if (name === 'kasse.netto') return fmtKr(S.posteringer.reduce((s, p) => s + num(p.ind) - num(p.ud), 0));
    return '';
  }

  tilfoej(basePath) {
    const arr = getPath(this.state, basePath) || [];
    if (!getPath(this.state, basePath)) setPath(this.state, basePath, arr);
    const S = this.state;
    switch (basePath) {
      case 'posteringer': {
        const sidste = arr[arr.length - 1];
        const n = arr.length + 1;
        const bilag = `${String(n).padStart(2, '0')}.${String(S.aar).slice(2)}`;
        arr.push({ id: nyId('p'), dato: sidste ? sidste.dato : `${S.aar}-01-01`, bilag, tekst: '', konto: '', likvid: sidste ? sidste.likvid : (S.likvidkonti[0] || {}).id, ind: 0, ud: 0 });
        break;
      }
      case 'kontoplan': { const max = arr.reduce((m, k) => Math.max(m, Number(k.nr) || 0), 0); arr.push({ nr: max + 10, navn: '', linje: '' }); break; }
      case 'likvidkonti': arr.push({ id: nyId('lk'), navn: '', primo: 0, kontoudtog: '' }); break;
      case 'laan': {
        const id = nyId('l');
        arr.push({ id, navn: 'Nyt lån', kreditor: '', hovedstol: 0, optagetTekst: '', kilde: 'manuel', betalingsplan: [], kurs: '', restgaeldPrimo: 0, kortfristetPrimo: 0, renter: 0, afdragIflg: '', restgaeldUltimoIflg: '', kortfristet: 0, kursvaerdi: 0, kursvaerdiTekst: '', beskrivelse: '' });
        const brugt = new Set(S.kontoplan.map(k => Number(k.nr)));
        let nr = 120; while (brugt.has(nr)) nr++;
        S.kontoplan.push({ nr, navn: 'Låneydelse, nyt lån', linje: 'laan:' + id });
        S.kontoplan.sort((a, b) => a.nr - b.nr);
        break;
      }
      case 'andenGaeld': { const id = nyId('ag'); arr.push({ id, tekst: 'Anden gæld', primo: 0 }); break; }
      case 'tilgodehavender': { const id = nyId('tg'); arr.push({ id, tekst: 'Tilgodehavende', primo: 0 }); break; }
      case 'reguleringer': arr.push({ id: nyId('r'), tekst: '', beloeb: 0, linje: '', balancepost: '' }); break;
      case 'ledelse.bestyrelse': arr.push({ navn: '', titel: 'Bestyrelsesmedlem' }); break;
      case 'ledelse.bilagskontrolloerer': arr.push({ navn: '' }); break;
      case 'importRegler': arr.push({ moenster: '', retning: '', beloeb: '', konto: '' }); break;
      case 'andelshavere': arr.push({ id: nyId('a'), adresse: '', navn: '', afgift: 2000, moenstre: '', fra: `${S.aar}-01`, primoSaldo: 0 }); break;
      default:
        if (/^laan\.\d+\.betalingsplan$/.test(basePath)) { const sidste = arr[arr.length - 1]; arr.push({ dato: sidste ? sidste.dato : '', rente: 0, afdrag: 0 }); }
        else arr.push({});
    }
  }

  action(name, btn) {
    const S = this.state;
    if (name === 'sorter-posteringer') { S.posteringer.sort((a, b) => (a.dato || '').localeCompare(b.dato || '') || String(a.bilag).localeCompare(String(b.bilag), 'da', { numeric: true })); this.recompute(); this.renderTab(this.tab); }
    if (name === 'nummerer-bilag') { S.posteringer.forEach((p, i) => { p.bilag = `${String(i + 1).padStart(2, '0')}.${String(S.aar).slice(2)}`; }); this.recompute(); this.renderTab(this.tab); }
    if (name === 'standard-kontoplan') { if (confirm('Tilføj manglende standardkonti til kontoplanen?')) { const has = new Set(S.kontoplan.map(k => Number(k.nr))); STANDARD_KONTOPLAN.forEach(k => { if (!has.has(k.nr)) S.kontoplan.push({ ...k }); }); S.kontoplan.sort((a, b) => a.nr - b.nr); this.recompute(); this.renderTab(this.tab); } }
    if (name.startsWith('standardtekst:')) { const k = name.slice(14); if (confirm('Gendan standardteksten?')) { S.tekster[k] = STANDARD_TEKSTER[k]; this.recompute(); this.renderTab(this.tab); } }
    if (name === 'kopier-budget') { ALLE_LINJER.forEach(l => { S.budget[l.id] = Math.round(this.engine.get(l.id)); }); this.recompute(); this.renderTab(this.tab); }
    if (name.startsWith('plan-parse:')) {
      const i = Number(name.slice(11)); const l = S.laan[i];
      const ta = document.getElementById('plan-tekst-' + i);
      const terminer = parseBetalingsplan(ta ? ta.value : '');
      if (!terminer.length) { alert('Kunne ikke finde terminer i teksten. Hver termin skal bestå af en dato (dd.mm.åååå) efterfulgt af mindst to tal: rente og bidrag, afdrag.'); return; }
      const eksisterende = l.betalingsplan || [];
      let ny;
      if (eksisterende.length) {
        const foerste = terminer[0].dato;
        const valg = confirm(`Der findes allerede ${eksisterende.length} terminer. OK = erstat terminer fra ${foerste} og frem med de ${terminer.length} nye (tidligere terminer beholdes). Annuller = erstat hele planen.`);
        ny = valg ? [...eksisterende.filter(t => t.dato < foerste), ...terminer] : terminer;
      } else ny = terminer;
      l.betalingsplan = sorter(ny);
      l.kilde = 'plan';
      const adv = terminer.filter(t => t.advarsel).length;
      this.recompute(); this.renderTab(this.tab);
      this.toast(`${terminer.length} terminer indlæst${adv ? ` (${adv} med ydelse ≠ rente + afdrag)` : ''}`);
    }
    if (name.startsWith('plan-slet:')) { const i = Number(name.slice(10)); if (confirm('Slet betalingsplanen for lånet?')) { S.laan[i].betalingsplan = []; S.laan[i].kilde = 'manuel'; this.recompute(); this.renderTab(this.tab); } }
    if (name === 'import-udfoer' && this.import) {
      const valgte = this.import.rows.filter(r => r.medtag && r.konto !== '');
      let n = S.posteringer.length;
      valgte.forEach(r => { n++; S.posteringer.push({ id: nyId('p'), dato: r.dato, bilag: `${String(n).padStart(2, '0')}.${String(S.aar).slice(2)}`, tekst: r.tekst + (r.modpart ? ' (' + r.modpart + ')' : ''), konto: r.konto, likvid: r.likvid, ind: r.beloeb > 0 ? r.beloeb : 0, ud: r.beloeb < 0 ? -r.beloeb : 0 }); });
      S.posteringer.sort((a, b) => (a.dato || '').localeCompare(b.dato || '') || String(a.bilag).localeCompare(String(b.bilag), 'da', { numeric: true }));
      S.posteringer.forEach((p, i) => { p.bilag = `${String(i + 1).padStart(2, '0')}.${String(S.aar).slice(2)}`; });
      this.import = null;
      this.recompute(); this.renderTab(this.tab);
      this.toast(`${valgte.length} posteringer importeret`);
    }
    if (name === 'import-annuller') { this.import = null; this.renderTab(this.tab); }
    if (name === 'standard-importregler') { if (confirm('Erstat konteringsreglerne med standardreglerne?')) { S.importRegler = STANDARD_IMPORTREGLER.map(r => ({ ...r })); this.recompute(); this.renderTab(this.tab); } }
    if (name === 'standard-andelshavere') { if (confirm('Erstat andelslisten med standardlisten for Polarvej I?')) { S.andelshavere = STANDARD_ANDELSHAVERE.map(a => ({ ...a })); this.recompute(); this.renderTab(this.tab); } }
    if (name === 'slet-aar') this.sletAar();
    if (name === 'nyt-aar') this.nytAar();
    if (name === 'kobling-fra') { if (confirm(`Afbryd koblingen til ${S.aar - 1}? Primotallene beholdes som de er nu, men følger ikke længere med, hvis ${S.aar - 1} rettes.`)) { S.primoKilde = 'manuel'; this.recompute(); this.renderTab(this.tab); } }
    if (name === 'kobling-til') { S.primoKilde = 'forrigeAar'; this.recompute(); this.renderTab(this.tab); this.toast(`Primotal hentes nu fra ${S.aar - 1}`); }
  }

  // ---------- Faner ----------
  htmlStamdata() {
    const S = this.state;
    return `<h2>Stamdata</h2>
    <div class="panel"><h3>Forening</h3><div class="grid">
      <div class="felt"><label>Regnskabsår</label><input type="text" value="${S.aar}" disabled></div>
      ${this.felt('Foreningens navn (forside og påtegning)', 'forening.navn', 'text', { placeholder: 'Andelsboligforeningen …' })}
      ${this.felt('Kort navn (sidehoved)', 'forening.kortnavn', 'text')}
      ${this.felt('Adresse', 'forening.adresse')}
      ${this.felt('Postnr. og by', 'forening.postnrBy')}
      ${this.felt('By (til underskrifter)', 'forening.by')}
      ${this.felt('CVR-nr.', 'forening.cvr')}
      ${this.felt('Foreningens stiftelsesår (nøgleoplysning D1)', 'forening.stiftelsesaar')}
      ${this.felt('Ejendommens opførelsesår (nøgleoplysning D2)', 'forening.opfoerelsesaar')}
    </div></div>
    <div class="panel"><h3>Bestyrelse</h3>
      ${this.tabel('ledelse.bestyrelse', [{ key: 'navn', label: 'Navn' }, { key: 'titel', label: 'Titel' }], { tilfoejLabel: 'Tilføj bestyrelsesmedlem' })}
      <div class="grid">${this.felt('Dirigent på generalforsamlingen', 'ledelse.dirigent')}</div>
    </div>
    <div class="panel"><h3>Bilagskontrollører / revision</h3>
      ${this.tabel('ledelse.bilagskontrolloerer', [{ key: 'navn', label: 'Navn' }], { tilfoejLabel: 'Tilføj bilagskontrollør' })}
    </div>
    <div class="panel"><h3>Datoer</h3><div class="grid">
      ${this.felt('Bestyrelsens påtegning', 'ledelse.datoPaategning', 'date')}
      ${this.felt('Bilagskontrol', 'ledelse.datoBilagskontrol', 'date')}
      ${this.felt('Ordinær generalforsamling', 'ledelse.datoGeneralforsamling', 'date')}
    </div></div>
    <div class="panel"><h3>Forsikringer (vedtægternes § 29, stk. 5)</h3>
      <p class="hjaelp">Vedtægterne kræver, at foreningen tegner bestyrelsesansvars- og besvigelsesforsikring, og at forsikringssummen oplyses i en note til årsrapporten.</p>
      <div class="grid">
      ${this.felt('Forsikringsselskab', 'forsikring.selskab')}
      ${this.felt('Bestyrelsesansvarsforsikring, forsikringssum (kr.)', 'forsikring.bestyrelsesansvar', 'num')}
      ${this.felt('Besvigelsesforsikring, forsikringssum (kr.)', 'forsikring.besvigelse', 'num')}
      ${this.felt('Bygningsforsikring, forsikringssum (kr., valgfrit)', 'forsikring.bygning', 'num')}
      ${this.felt('Bemærkning til noten', 'forsikring.bemaerkning', 'textarea', { wide: true, rows: 2 })}
      </div></div>
    <div class="panel"><h3>Fremleje (vedtægternes § 11)</h3><div class="grid">
      ${this.felt('Antal fremlejede boliger pr. 31/12', 'fremleje.antal', 'int', { hint: 'Hver kræver 20.000 kr. depositum på lukket konto' })}
      ${this.felt('Hvilke boliger', 'fremleje.boliger')}
    </div></div>
    <div class="panel"><h3>Regnskabsår i programmet</h3>
      <p class="hjaelp">Programmet indeholder følgende regnskabsår: <b>${aarListe(this.samling).join(', ')}</b>. Skift år i topbjælken. "⇐" betyder, at årets primotal hentes automatisk fra det foregående år.</p>
      ${this.koblingHtml()}
      <div class="knapper"><button class="knap" data-action="nyt-aar">${this.samling.regnskaber[S.aar + 1] ? 'Gå til ' + (S.aar + 1) : '+ Opret regnskabsåret ' + (S.aar + 1) + ' med primotal fra ' + S.aar}</button><button class="knap slet" data-action="slet-aar">Slet regnskabsåret ${S.aar}</button></div>
    </div>`;
  }

  koblingHtml() {
    const S = this.state;
    if (this.erKoblet()) return `<div class="koblet-info">Primotal, sidste års resultat og tidligere års nøgletal for ${S.aar} hentes automatisk fra regnskabet for ${S.aar - 1} og kan ikke redigeres her. Ret i stedet tallene i ${S.aar - 1}. <button class="knap lille" data-action="kobling-fra">Afbryd kobling (indtast primotal manuelt)</button></div>`;
    if (this.samling.regnskaber[S.aar - 1]) return `<div class="koblet-info">Primotallene for ${S.aar} indtastes manuelt. <button class="knap lille" data-action="kobling-til">Hent primotal automatisk fra ${S.aar - 1}</button></div>`;
    return '';
  }

  kontoOptions() { return this.state.kontoplan.slice().sort((a, b) => a.nr - b.nr).map(k => ({ id: k.nr, label: `${k.nr} ${k.navn}` })); }
  likvidOptions() { return this.state.likvidkonti.map(k => ({ id: k.id, label: k.navn })); }

  htmlKasserapport() {
    const S = this.state;
    const cols = [
      { key: 'dato', label: 'Dato', type: 'date', width: 'w-dato' },
      { key: 'bilag', label: 'Bilag', width: 'w-bilag' },
      { key: 'tekst', label: 'Tekst' },
      { key: 'konto', label: 'Konto', type: 'select', numeric: true, options: this.kontoOptions(), width: 'w-konto' },
      { key: 'likvid', label: 'Likvid konto', type: 'select', options: this.likvidOptions(), width: 'w-likvid' },
      { key: 'ind', label: 'Indsat', type: 'num', width: 'w-beloeb' },
      { key: 'ud', label: 'Hævet', type: 'num', width: 'w-beloeb' },
    ];
    const sum = () => `<td colspan="5">I alt</td><td data-calc-fn="kasse.ind">${this.calcFn('kasse.ind')}</td><td data-calc-fn="kasse.ud">${this.calcFn('kasse.ud')}</td><td></td>`;
    const ekstra = `<button class="knap" data-action="sorter-posteringer">Sortér efter dato</button><button class="knap" data-action="nummerer-bilag">Nummerér bilag fortløbende</button>`;
    // Kontokort
    const grupper = {};
    S.posteringer.forEach(p => { (grupper[p.konto] = grupper[p.konto] || []).push(p); });
    const kontokort = S.kontoplan.slice().sort((a, b) => a.nr - b.nr).filter(k => grupper[k.nr]).map(k => {
      const ps = grupper[k.nr];
      const rows = ps.map(p => `<tr><td>${esc(p.dato)}</td><td>${esc(p.bilag)}</td><td>${esc(p.tekst)}</td><td class="num" style="text-align:right">${fmtKr(p.ind)}</td><td class="num" style="text-align:right">${fmtKr(p.ud)}</td></tr>`).join('');
      const m = alleMappings(S).find(x => x.id === k.linje);
      return `<h3>${k.nr} ${esc(k.navn)} <span class="kontoplan-hint">→ ${esc(m ? m.label : 'IKKE KNYTTET TIL REGNSKABSLINJE')}</span></h3>
        <table class="edit"><thead><tr><th>Dato</th><th>Bilag</th><th>Tekst</th><th class="num">Indsat</th><th class="num">Hævet</th></tr></thead><tbody>${rows}
        <tr class="sum"><td colspan="3">I alt (netto)</td><td colspan="2">${fmtKr(this.engine.konto(k.nr))}</td></tr></tbody></table>`;
    }).join('');
    const ukendte = Object.keys(grupper).filter(nr => !S.kontoplan.some(k => String(k.nr) === String(nr)));
    return `<h2>Kasserapport ${S.aar}</h2>
    ${this.htmlImport()}
    <p class="hjaelp">Indtast alle ind- og udbetalinger i regnskabsåret. Vælg for hver postering en konto fra kontoplanen (bestemmer hvor beløbet lander i regnskabet) og hvilken likvid konto pengene gik ind på/ud fra. Låneydelser bogføres med det fulde beløb på lånekontoen – motoren deler i renter og afdrag ud fra kreditforeningens årsopgørelse (fanen Primo &amp; lån).</p>
    <div class="panel">${this.tabel('posteringer', cols, { sum, tilfoejLabel: 'Tilføj postering', ekstraKnapper: ekstra })}</div>
    <div class="panel"><h3>Likvide konti – bevægelser</h3>
      <table class="edit"><thead><tr><th>Konto</th><th class="num">Primo</th><th class="num">Indsat</th><th class="num">Hævet</th><th class="num">Beregnet ultimo</th><th class="num">Iflg. kontoudtog</th></tr></thead><tbody>
      ${S.likvidkonti.map(k => `<tr><td>${esc(k.navn)}</td><td style="text-align:right">${fmtKr(k.primo)}</td><td style="text-align:right" data-calc="likvid.${k.id}.ind">${fmtKr(this.engine.get(`likvid.${k.id}.ind`))}</td><td style="text-align:right" data-calc="likvid.${k.id}.ud">${fmtKr(this.engine.get(`likvid.${k.id}.ud`))}</td><td style="text-align:right;font-weight:600" data-calc="likvid.${k.id}.ultimo">${fmtKr(this.engine.get(`likvid.${k.id}.ultimo`))}</td><td style="text-align:right">${k.kontoudtog === '' || k.kontoudtog === null || k.kontoudtog === undefined ? '–' : fmtKr(k.kontoudtog)}</td></tr>`).join('')}
      </tbody></table></div>
    <div class="panel"><h3>Kontokort – posteringer pr. konto</h3>
      ${ukendte.length ? `<p class="hjaelp" style="color:var(--fejl)">Posteringer på konti der ikke findes i kontoplanen: ${ukendte.join(', ')}</p>` : ''}
      ${kontokort || '<p class="hjaelp">Ingen posteringer endnu.</p>'}
    </div>`;
  }

  htmlImport() {
    const S = this.state;
    const imp = this.import;
    const head = `<div class="panel"><h3>Importér posteringer fra bankens CSV-eksport</h3>
      <p class="hjaelp">Eksportér kontoens posteringer fra netbanken som CSV og vælg filen her. Programmet foreslår konto ud fra konteringsreglerne (fanen Kontoplan) og tidligere posteringer, og springer posteringer over, der allerede findes (samme dato, beløb og tekst).</p>
      <div class="knapper"><label class="knap">Vælg CSV-fil <input type="file" id="import-fil" accept=".csv,.txt,text/csv" class="hidden"></label>
      <label>Likvid konto: <select id="import-likvid">${S.likvidkonti.map(k => `<option value="${esc(k.id)}" ${imp && imp.likvid === k.id ? 'selected' : ''}>${esc(k.navn)}</option>`).join('')}</select></label></div>`;
    if (!imp) return head + '</div>';
    const kontoOpts = this.kontoOptions();
    const rows = imp.rows.map((r, i) => `<tr class="${r.dublet ? 'dublet' : ''}" style="${r.dublet || r.udenforAar ? 'color:var(--muted)' : ''}">
      <td><input type="checkbox" data-imp="medtag" data-i="${i}" ${r.medtag ? 'checked' : ''}></td>
      <td>${esc(r.dato)}</td><td>${esc(r.tekst)}${r.modpart ? `<div class="kontoplan-hint">${esc(r.modpart)}</div>` : ''}</td>
      <td style="text-align:right">${r.beloeb > 0 ? fmtKr(r.beloeb) : ''}</td><td style="text-align:right">${r.beloeb < 0 ? fmtKr(-r.beloeb) : ''}</td>
      <td><select data-imp="konto" data-i="${i}" style="${r.konto === '' ? 'border-color:var(--fejl)' : ''}"><option value="">– vælg konto –</option>${kontoOpts.map(o => `<option value="${o.id}" ${String(o.id) === String(r.konto) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select><div class="kontoplan-hint">${esc(r.kilde)}</div></td>
      <td class="kontoplan-hint">${r.dublet ? 'findes allerede' : r.udenforAar ? 'uden for ' + S.aar : ''}</td></tr>`).join('');
    const valgte = imp.rows.filter(r => r.medtag);
    const mangler = valgte.filter(r => r.konto === '').length;
    return head + `<p class="hjaelp"><b>${imp.rows.length} linjer</b> læst fra ${esc(imp.filnavn)} (${imp.rows.filter(r => r.dublet).length} dubletter, ${imp.rows.filter(r => r.udenforAar).length} uden for regnskabsåret). Indbetalinger ${fmtKr(valgte.reduce((a, r) => a + (r.beloeb > 0 ? r.beloeb : 0), 0))}, udbetalinger ${fmtKr(valgte.reduce((a, r) => a + (r.beloeb < 0 ? -r.beloeb : 0), 0))} for de valgte.</p>
      <div style="max-height:420px;overflow:auto"><table class="edit"><thead><tr><th></th><th>Dato</th><th>Tekst</th><th class="num">Indsat</th><th class="num">Hævet</th><th>Konto</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="knapper"><button class="knap primary" data-action="import-udfoer" ${mangler ? 'disabled title="Vælg konto på alle valgte linjer"' : ''}>Importér ${valgte.length} posteringer${mangler ? ` (${mangler} mangler konto)` : ''}</button><button class="knap" data-action="import-annuller">Annuller</button></div>
      ${imp.fejl.length ? `<p class="hjaelp" style="color:var(--fejl)">${imp.fejl.map(esc).join('<br>')}</p>` : ''}
    </div>`;
  }

  bindImport(el) {
    const fil = el.querySelector('#import-fil');
    if (fil) fil.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const tekst = await f.text();
      const parsed = parseBankCsv(tekst);
      const likvid = el.querySelector('#import-likvid').value;
      this.import = { filnavn: f.name, likvid, fejl: parsed.fejl || [], rows: forberedImport(parsed, this.state, likvid, this.state.importRegler || STANDARD_IMPORTREGLER) };
      this.renderTab('kasserapport');
      e.target.value = '';
    });
    const lk = el.querySelector('#import-likvid');
    if (lk) lk.addEventListener('change', () => { if (this.import) { this.import.likvid = lk.value; this.import.rows.forEach(r => { r.likvid = lk.value; }); } });
    el.querySelectorAll('[data-imp]').forEach(inp => inp.addEventListener('change', () => {
      const r = this.import.rows[Number(inp.dataset.i)];
      if (inp.dataset.imp === 'medtag') r.medtag = inp.checked;
      else { r.konto = inp.value === '' ? '' : Number(inp.value); r.kilde = 'valgt manuelt'; }
      const btn = el.querySelector('[data-action="import-udfoer"]');
      const valgte = this.import.rows.filter(x => x.medtag); const mangler = valgte.filter(x => x.konto === '').length;
      if (btn) { btn.disabled = mangler > 0; btn.textContent = `Importér ${valgte.length} posteringer${mangler ? ` (${mangler} mangler konto)` : ''}`; }
      if (inp.dataset.imp === 'konto') inp.style.borderColor = inp.value === '' ? 'var(--fejl)' : '';
    }));
  }

  htmlBoligafgift() {
    const S = this.state;
    const andele = S.andelshavere || [];
    const ov = andele.length ? boligafgiftOversigt(this.samling, andele) : null;
    const aar = aarListe(this.samling);
    let matrix = '';
    if (ov) {
      matrix = aar.map(y => {
        const rows = ov.andele.map(r => {
          const cells = MAANEDER.map((_, mi) => {
            const m = r.maaneder.find(x => x.aar === y && x.md === mi);
            if (!m) return '<td class="udenfor">·</td>';
            const tip = `${m.ym}: forfald ${fmtKr(m.forfald, 0)}, betalt ${fmtKr(m.betalt, 0)}, saldo ${fmtKr(m.saldo, 0)}${m.betalinger.length ? ' – ' + m.betalinger.map(b => b.dato + ' ' + fmtKr(b.beloeb, 0)).join(', ') : ''}`;
            return `<td class="${m.status}" title="${esc(tip)}">${m.status === 'ok' ? '✓' : m.status === 'delvis' ? '½' : '✕'}${m.betalt && Math.abs(m.betalt - m.forfald) > 0.5 ? `<div class="kontoplan-hint">${fmtKr(m.betalt, 0)}</div>` : ''}</td>`;
          }).join('');
          const sidste = r.maaneder.filter(x => x.aar === y).pop();
          const betaltAar = r.maaneder.filter(x => x.aar === y).reduce((s, x) => s + x.betalt, 0);
          return `<tr><td><b>${esc(r.andel.adresse)}</b><div class="kontoplan-hint">${esc(r.andel.navn)}</div></td>${cells}<td class="saldo">${fmtKr(betaltAar, 0)}</td><td class="saldo" style="color:${sidste && sidste.saldo < -0.5 ? 'var(--fejl)' : 'var(--ok)'}">${sidste ? fmtKr(sidste.saldo, 0) : ''}</td></tr>`;
        }).join('');
        const sum = ov.andele.reduce((s, r) => s + r.maaneder.filter(x => x.aar === y).reduce((t, x) => t + x.betalt, 0), 0);
        return `<h3>${y}</h3><div style="overflow-x:auto"><table class="matrix"><thead><tr><th>Andel</th>${MAANEDER.map(m => `<th>${m}</th>`).join('')}<th>Betalt ${y}</th><th>Saldo ultimo</th></tr></thead><tbody>${rows}<tr><td><b>I alt</b></td><td colspan="12"></td><td class="saldo">${fmtKr(sum, 0)}</td><td></td></tr></tbody></table></div>`;
      }).join('');
    }
    const status = ov ? `<table class="edit" style="max-width:760px"><thead><tr><th>Andel</th><th>Andelshaver</th><th class="num">Forfaldent ${ov.start}–${ov.slut}</th><th class="num">Betalt</th><th class="num">Saldo (− = restance)</th></tr></thead><tbody>${ov.andele.map(r => `<tr><td>${esc(r.andel.adresse)}</td><td>${esc(r.andel.navn)}</td><td style="text-align:right">${fmtKr(r.forfaldIalt, 0)}</td><td style="text-align:right">${fmtKr(r.betaltIalt, 0)}</td><td style="text-align:right;font-weight:600;color:${r.saldo < -0.5 ? 'var(--fejl)' : r.saldo > 0.5 ? 'var(--accent)' : 'var(--ok)'}">${fmtKr(r.saldo, 0)}</td></tr>`).join('')}<tr class="sum"><td colspan="2" style="text-align:left">I alt</td><td>${fmtKr(ov.andele.reduce((s, r) => s + r.forfaldIalt, 0), 0)}</td><td>${fmtKr(ov.andele.reduce((s, r) => s + r.betaltIalt, 0), 0)}</td><td>${fmtKr(ov.andele.reduce((s, r) => s + r.saldo, 0), 0)}</td></tr></tbody></table>` : '';
    const uafstemt = ov && ov.uafstemt.length ? `<div class="panel"><h3>Boligafgiftsposteringer uden andel (${ov.uafstemt.length})</h3><p class="hjaelp">Tilføj et mønster på den rette andel, så posteringen tælles med.</p><table class="edit"><tbody>${ov.uafstemt.map(p => `<tr><td>${esc(p.dato)}</td><td>${esc(p.tekst)}</td><td style="text-align:right">${fmtKr(p.beloeb)}</td></tr>`).join('')}</tbody></table></div>` : '';
    return `<h2>Boligafgift pr. andel</h2>
    <p class="hjaelp">Oversigten bygger på alle boligafgiftsposteringer (konti knyttet til note 1, boligafgift) i alle regnskabsår. Hver måned forfalder afgiften, og indbetalingerne fyldes kronologisk på de ældste forfaldne måneder. ✓ = dækket, ✕ = mangler, ½ = delvist dækket. Saldo er forudbetalt (+) eller restance (−). Hold musen over en celle for detaljer.</p>
    ${ov ? `<div class="panel"><h3>Status pr. ${ov.slut}</h3>${status}</div>` : ''}
    ${uafstemt}
    <div class="panel"><h3>Måned for måned</h3>${matrix || '<p class="hjaelp">Opret andelene nedenfor.</p>'}</div>
    <div class="panel"><h3>Andele og genkendelse af indbetalinger</h3>
      <p class="hjaelp">Mønstre adskilles med semikolon og matches mod posteringsteksten (inkl. modpart fra banken). Første andel, hvis mønster passer, får betalingen. "Fra" er første måned, der regnes som forfalden; "primosaldo" er evt. forudbetaling (+) eller restance (−) før den måned.</p>
      ${this.tabel('andelshavere', [{ key: 'adresse', label: 'Andel' }, { key: 'navn', label: 'Andelshaver' }, { key: 'afgift', label: 'Afgift pr. md.', type: 'num', width: 'w-beloeb' }, { key: 'moenstre', label: 'Mønstre (tekst indeholder; adskil med ;)' }, { key: 'fra', label: 'Fra (ÅÅÅÅ-MM)', width: 'w-bilag' }, { key: 'primoSaldo', label: 'Primosaldo', type: 'num', width: 'w-beloeb' }], { tilfoejLabel: 'Tilføj andel', ekstraKnapper: '<button class="knap" data-action="standard-andelshavere">Standardliste (Polarvej I)</button>' })}
    </div>`;
  }

  async renderVedtaegter(el) {
    const v = this.vedtaegter || { punkter: [], antal: {} };
    const status = v.antal.fejl ? `<div class="kontrol-banner fejl">${v.antal.fejl} vedtægtsbestemmelse(r) er ikke opfyldt i regnskabet for ${this.state.aar}.</div>` : v.antal.advarsel ? `<div class="kontrol-banner advarsel">Vedtægterne er opfyldt med ${v.antal.advarsel} bemærkning(er).</div>` : `<div class="kontrol-banner ok">Regnskabet for ${this.state.aar} opfylder vedtægternes krav.</div>`;
    const tjek = v.punkter.map(x => `<div class="kontrol ${x.status}"><div class="k-titel"><span class="k-status">${x.status}</span>${esc(x.paragraf)} · ${esc(x.titel)}</div><div class="k-fork">${esc(x.tekst)}</div></div>`).join('');
    el.innerHTML = `<h2>Aktuelle vedtægter</h2><p class="hjaelp">Henter vedtægterne …</p>`;
    let meta = null;
    try { const r = await fetch('arkiv/vedtaegter.json', { cache: 'no-cache' }); if (r.ok) meta = await r.json(); } catch (e) { /* ignorer */ }
    const best = meta ? `<div class="panel"><h3>Regnskabsrelevante bestemmelser</h3><p class="hjaelp">${esc(meta.titel)}, vedtaget ${esc(meta.vedtaget)}, senest ændret ${esc(meta.senestAendret)}. ${esc(meta.grundlag)}.</p><table class="vedt"><thead><tr><th>Paragraf</th><th>Emne</th><th>Bestemmelse</th><th>Sådan håndteres det i regnskabet</th></tr></thead><tbody>${meta.bestemmelser.map(b => `<tr><td class="par">${esc(b.paragraf)}</td><td><b>${esc(b.emne)}</b></td><td>${esc(b.tekst)}</td><td>${esc(b.program)}</td></tr>`).join('')}</tbody></table></div>` : '';
    const fil = meta ? 'arkiv/' + meta.fil : 'arkiv/vedtaegter.pdf';
    el.innerHTML = `<h2>Aktuelle vedtægter</h2>
      <div class="panel"><h3>Vedtægtstjek af regnskabet for ${this.state.aar}</h3>${status}${tjek}</div>
      ${best}
      <div class="panel"><h3>Vedtægterne</h3><p class="hjaelp"><a href="${fil}" target="_blank" rel="noopener">Åbn vedtægterne i nyt vindue (PDF)</a>. Nye vedtægter lægges i mappen arkiv/ og registreres i arkiv/vedtaegter.json.</p><iframe class="vedt-pdf" src="${fil}" title="Vedtægter"></iframe></div>`;
  }

  async renderArkiv(el) {
    el.innerHTML = '<h2>Arkiv</h2><p class="hjaelp">Henter arkivlisten …</p>';
    try {
      const r = await fetch('arkiv/arkiv.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('arkiv/arkiv.json kunne ikke hentes (' + r.status + ')');
      const data = await r.json();
      el.innerHTML = `<h2>Arkiv</h2>
      <p class="hjaelp">Årsrapporter, lånedokumenter, bankens kontoudtog og dokumentation samlet ét sted. Filerne ligger i mappen <code>arkiv/</code> i programmets repo. Nye filer tilføjes ved at lægge dem i mappen og skrive en linje i <code>arkiv/arkiv.json</code>.</p>
      ${(data.grupper || []).map(g => `<div class="panel"><h3>${esc(g.titel)}</h3><ul class="arkiv-liste">${(g.filer || []).map(f => `<li><a href="arkiv/${esc(f.fil)}" target="_blank" rel="noopener">${esc(f.titel)}</a> <span class="kontoplan-hint">(${esc(f.fil.replace(/^\.\.\//, ''))})</span>${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}</li>`).join('')}</ul></div>`).join('')}`;
    } catch (e) {
      el.innerHTML = `<h2>Arkiv</h2><p class="hjaelp" style="color:var(--fejl)">${esc(e.message)}. Arkivet kræver, at programmet køres fra en webserver (fx GitHub Pages), ikke som lokal fil.</p>`;
    }
  }

  htmlKontoplan() {
    const S = this.state;
    const mappings = alleMappings(S);
    const cols = [
      { key: 'nr', label: 'Nr.', type: 'int', width: 'w-bilag' },
      { key: 'navn', label: 'Kontonavn' },
      { key: 'linje', label: 'Regnskabslinje (note) / balancepost', type: 'select', options: mappings },
    ];
    const beregnet = [{ label: `Bevægelse ${S.aar}`, value: (it) => fmtKr(this.engine.konto(Number(it.nr))) }];
    return `<h2>Kontoplan</h2>
    <p class="hjaelp">Kontoplanen bestemmer, hvor hver postering havner i årsregnskabet. Hver konto knyttes til en linje i noterne (indtægt/omkostning) eller til en balancepost (lån, anden gæld, tilgodehavender, andelsindskud, overførsel mellem likvide konti). Flere konti kan pege på samme linje.</p>
    <div class="panel">${this.tabel('kontoplan', cols, { beregnet, tilfoejLabel: 'Tilføj konto', ekstraKnapper: '<button class="knap" data-action="standard-kontoplan">Tilføj manglende standardkonti</button>' })}</div>
    <div class="panel"><h3>Konteringsregler ved bankimport</h3>
      <p class="hjaelp">Bruges når posteringer importeres fra bankens CSV-fil. Reglerne gennemgås oppefra – første regel der passer, bestemmer kontoen. En regel passer, når posteringsteksten indeholder mønsteret (og evt. retning og præcist beløb passer). Tomt mønster + beløb bruges fx til boligafgift på 2.000 kr.</p>
      ${this.tabel('importRegler', [{ key: 'moenster', label: 'Tekst indeholder' }, { key: 'retning', label: 'Retning', type: 'select', options: [{ id: 'ind', label: 'Indbetaling' }, { id: 'ud', label: 'Udbetaling' }], width: 'w-likvid' }, { key: 'beloeb', label: 'Beløb (valgfrit)', type: 'num', width: 'w-beloeb' }, { key: 'konto', label: 'Konto', type: 'select', numeric: true, options: this.kontoOptions(), width: 'w-konto' }], { tilfoejLabel: 'Tilføj regel', ekstraKnapper: '<button class="knap" data-action="standard-importregler">Gendan standardregler</button>' })}
    </div>`;
  }

  htmlBalance() {
    const S = this.state;
    const e = this.engine;
    const laanHtml = S.laan.map((l, i) => {
      const p = `laan.${i}`;
      const n = `laan.${l.id}`;
      const plan = e.harPlan(l);
      const aarene = [...new Set((l.betalingsplan || []).map(t => aarAf(t.dato)))].filter(Number.isFinite).sort();
      const planTabel = aarene.length ? `<table class="edit" style="max-width:640px"><thead><tr><th>År</th><th class="num">Terminer</th><th class="num">Rente og bidrag</th><th class="num">Afdrag</th><th class="num">Ydelse</th><th class="num">Restgæld ultimo</th></tr></thead><tbody>${aarene.map(aa => { const pa = planAar(l.betalingsplan, aa); const rest = (Number(l.hovedstol) || 0) - (l.betalingsplan || []).filter(t => aarAf(t.dato) <= aa).reduce((x, t) => x + (Number(t.afdrag) || 0), 0); return `<tr style="${aa === S.aar ? 'font-weight:600;background:#eef2f6' : ''}"><td>${aa}</td><td style="text-align:right">${pa.terminer}</td><td style="text-align:right">${fmtKr(pa.rente)}</td><td style="text-align:right">${fmtKr(pa.afdrag)}</td><td style="text-align:right">${fmtKr(pa.ydelse)}</td><td style="text-align:right">${fmtKr(rest)}</td></tr>`; }).join('')}</tbody></table>` : '';
      return `<div class="panel"><h3>${esc(l.navn || 'Lån')}</h3><div class="grid">
        ${this.felt('Betegnelse (vises i noten)', `${p}.navn`)}
        ${this.felt('Kreditor', `${p}.kreditor`)}
        ${this.felt('Hovedstol', `${p}.hovedstol`, 'num')}
        ${this.felt('Optaget (tekst, fx "udbetalt 5. juli 2017")', `${p}.optagetTekst`)}
        ${this.felt('Kilde til renter, afdrag og restgæld', `${p}.kilde`, 'select', { rerender: true, options: [{ id: 'manuel', label: 'Manuel indtastning (fra årsopgørelsen)' }, { id: 'plan', label: 'Kreditforeningens betalingsplan (terminer nedenfor)' }], hint: plan ? 'Renter, kortfristet del og restgæld hentes fra betalingsplanen' : ((l.betalingsplan || []).length ? 'Betalingsplan findes, men bruges ikke' : 'Indsæt en betalingsplan nedenfor for automatisk opgørelse') })}
        ${this.felt(`Obligationskurs pr. 31/12 ${S.aar} (%)`, `${p}.kurs`, 'num', { hint: 'Udfyldes kursen, beregnes kursværdien som restgæld × kurs. Tomt = indtast kursværdien direkte.', rerender: true })}
        ${this.felt(`Kursværdi af restgæld pr. 31/12 ${S.aar}`, `${p}.kursvaerdi`, 'num', { hint: e.node(`${n}.kursvaerdi`).input ? 'Fra kreditforeningens årsopgørelse – bruges i andelsværdiberegningen' : `Beregnet: ${fmtKr(e.get(n + '.kursvaerdi'))} kr. (restgæld × kurs)` })}
        ${this.felt('Kursværdi, tekst (fx "pr. 31. december 2025")', `${p}.kursvaerdiTekst`)}
      </div>
      <h3 style="margin-top:14px">Manuelle tal ${plan ? '<span class="kontoplan-hint">(låst – hentes fra betalingsplanen)</span>' : ''}</h3><div class="grid">
        ${this.felt(`Restgæld primo (31/12 ${S.aar - 1})`, `${p}.restgaeldPrimo`, 'num')}
        ${this.felt(`Kortfristet del primo (afdrag i ${S.aar} iflg. sidste års regnskab)`, `${p}.kortfristetPrimo`, 'num')}
        ${this.felt(`Renter og bidrag i ${S.aar} iflg. årsopgørelse`, `${p}.renter`, 'num', { hint: 'Afdrag = betalte ydelser − renter og bidrag' })}
        ${this.felt(`Kortfristet del ultimo (afdrag i ${S.aar + 1} iflg. betalingsplan)`, `${p}.kortfristet`, 'num')}
        ${this.felt('Afdrag iflg. årsopgørelse (til kontrol, kan udelades)', `${p}.afdragIflg`, 'num')}
        ${this.felt('Restgæld ultimo iflg. årsopgørelse (til kontrol, kan udelades)', `${p}.restgaeldUltimoIflg`, 'num')}
        ${this.felt('Beskrivelse i noten (lånetype, rente, bidrag)', `${p}.beskrivelse`, 'textarea', { wide: true, rows: 2 })}
      </div>
      <h3 style="margin-top:14px">Betalingsplan (${(l.betalingsplan || []).length} terminer${aarene.length ? `, ${aarene[0]}–${aarene[aarene.length - 1]}` : ''})</h3>
      <p class="hjaelp">Kopiér tabellen med terminer fra kreditforeningens låneafregning eller årsopgørelse (dato, rente og bidrag, afdrag, evt. ydelse og restgæld) og indsæt den her. Ved rentetilpasning eller bidragsændring indsættes den nye plan, som erstatter de fremtidige terminer.</p>
      <textarea id="plan-tekst-${i}" rows="4" placeholder="01.03.2025  3.763,39  11.415,15  15.178,54  615.815,76&#10;01.06.2025  3.694,90  11.457,96  15.152,86  604.357,80"></textarea>
      <div class="knapper"><button class="knap" data-action="plan-parse:${i}">Indlæs terminer fra teksten</button>${(l.betalingsplan || []).length ? `<button class="knap slet" data-action="plan-slet:${i}">Slet betalingsplan</button>` : ''}</div>
      ${planTabel}
      ${(l.betalingsplan || []).length ? `<details><summary style="cursor:pointer;margin:8px 0">Vis/redigér alle terminer</summary>${this.tabel(`${p}.betalingsplan`, [{ key: 'dato', label: 'Termin', type: 'date', width: 'w-dato' }, { key: 'rente', label: 'Rente og bidrag', type: 'num', width: 'w-beloeb' }, { key: 'afdrag', label: 'Afdrag', type: 'num', width: 'w-beloeb' }], { beregnet: [{ label: 'Ydelse', value: (t) => fmtKr((Number(t.rente) || 0) + (Number(t.afdrag) || 0)) }], tilfoejLabel: 'Tilføj termin' })}</details>` : ''}
      <table class="edit" style="max-width:520px;margin-top:8px"><tbody>
        <tr><td>Betalte ydelser iflg. kasserapport</td><td style="text-align:right" data-calc="${n}.ydelser">${fmtKr(e.get(n + '.ydelser'))}</td></tr>
        ${plan ? `<tr><td>Ydelser iflg. betalingsplan ${S.aar}</td><td style="text-align:right" data-calc="${n}.ydelserIflg">${fmtKr(e.get(n + '.ydelserIflg'))}</td></tr>` : ''}
        <tr><td>Renter og bidrag</td><td style="text-align:right" data-calc="${n}.renter">${fmtKr(e.get(n + '.renter'))}</td></tr>
        <tr><td>Beregnet afdrag (ydelser − renter)</td><td style="text-align:right" data-calc="${n}.afdrag">${fmtKr(e.get(n + '.afdrag'))}</td></tr>
        <tr><td>Restgæld ultimo</td><td style="text-align:right;font-weight:600" data-calc="${n}.restgaeldUltimo">${fmtKr(e.get(n + '.restgaeldUltimo'))}</td></tr>
        <tr><td>Heraf kortfristet (afdrag i ${S.aar + 1})</td><td style="text-align:right" data-calc="${n}.kortfristet">${fmtKr(e.get(n + '.kortfristet'))}</td></tr>
        <tr><td>Heraf langfristet</td><td style="text-align:right" data-calc="${n}.langfristet">${fmtKr(e.get(n + '.langfristet'))}</td></tr>
        ${plan ? `<tr><td>Restløbetid pr. 31/12 ${S.aar}</td><td style="text-align:right">${fmtKr(restloebetid(l.betalingsplan, S.aar))} år (sidste termin ${esc(sidsteTermin(l.betalingsplan))})</td></tr>` : ''}
      </tbody></table>
      <div class="knapper"><button class="knap lille slet" data-slet="laan" data-index="${i}">Slet lån</button></div></div>`;
    }).join('');
    const balanceposter = [{ id: 'forud', label: 'Forudmodtaget boligafgift' }, ...S.andenGaeld.map(a => ({ id: 'ag:' + a.id, label: 'Anden gæld: ' + a.tekst })), ...S.tilgodehavender.map(t => ({ id: 'tg:' + t.id, label: 'Tilgodehavende: ' + t.tekst }))];
    return `<h2>Primo, ejendom, egenkapital og lån</h2>
    <p class="hjaelp">Primotal er sidste års ultimotal (fra årsrapporten for ${S.aar - 1}). Kontrolsiden tjekker, at primobalancen balancerer.</p>
    ${this.koblingHtml()}
    <div class="panel"><h3>Likvide beholdninger</h3>
      ${this.tabel('likvidkonti', [{ key: 'navn', label: 'Konto (som vist i noten)' }, { key: 'primo', label: `Saldo primo 1/1 ${S.aar}`, type: 'num', width: 'w-beloeb' }, { key: 'kontoudtog', label: `Saldo iflg. kontoudtog 31/12 ${S.aar} (til afstemning)`, type: 'num', width: 'w-beloeb' }], { beregnet: [{ label: 'Beregnet ultimo', value: (it) => fmtKr(e.get(`likvid.${it.id}.ultimo`)) }], tilfoejLabel: 'Tilføj likvid konto' })}
    </div>
    <div class="panel"><h3>Ejendom</h3><div class="grid">
      ${this.felt('Kostpris primo (grund og bygninger)', 'ejendom.kostprisPrimo', 'num')}
      ${this.felt('Opskrivninger primo', 'ejendom.opskrivningPrimo', 'num')}
      ${this.felt(`Årets opskrivning (+) / tilbageførsel (−)`, 'ejendom.opskrivningAaret', 'num', { hint: 'Føres direkte på egenkapitalen (reserve for opskrivning)' })}
      ${this.felt('Vurderingsprincip (andelsboliglovens § 5, stk. 2)', 'ejendom.vurderingsprincip', 'select', { options: VURDERINGSPRINCIPPER.map(v => ({ id: v.id, label: `Litra ${v.litra}: ${v.label}` })) })}
      ${this.felt('Ejendommens værdi efter det valgte princip', 'ejendom.vurdering', 'num')}
      ${this.felt('Vurderingens dato/tekst (fx "pr. 1. januar 2024")', 'ejendom.vurderingTekst')}
      ${this.felt('', 'ejendom.fastholdt', 'bool', { checkLabel: 'Værdien er fastholdt efter § 5, stk. 3 (vurdering foretaget før 1. juli 2020)' })}
    </div>
    <p class="hjaelp">Regnskabsmæssig værdi = kostpris + opskrivninger (bogført til dagsværdi). Tilgang til kostpris i året bogføres i kasserapporten på en konto knyttet til "Balance: Ejendom".</p></div>
    <div class="panel"><h3>Andele og andelsværdi</h3><div class="grid">
      ${this.felt('Antal andele', 'andele.antal', 'int')}
      ${this.felt('Indskud pr. andel (kr.)', 'andele.indskudPrAndel', 'num')}
      ${this.felt('Fordelingstal ved andelsværdi', 'andele.fordelingstalType', 'select', { options: [{ id: 'indskud', label: 'Indskudt andelskapital (antal × indskud)' }, { id: 'andet', label: 'Andet fordelingstal (indtast sum)' }] })}
      ${this.felt('Fordelingstal i alt (kun ved "andet")', 'andele.fordelingstalAndet', 'num')}
      ${this.felt('Senest vedtagne andelsværdi pr. andelskrone', 'andele.senestVedtagetPrKrone', 'num')}
      ${this.felt('Vedtaget på generalforsamlingen i (år)', 'andele.senestVedtagetAar')}
      ${this.felt('Andre reguleringer i andelsværdiberegningen (+/−)', 'andele.andreReguleringer', 'num', { hint: 'Fx fradrag besluttet af generalforsamlingen' })}
    </div></div>
    <div class="panel"><h3>Egenkapital primo (31/12 ${S.aar - 1})</h3><div class="grid">
      ${this.felt('Overført resultat primo', 'egenkapitalPrimo.overfoertResultat', 'num')}
      ${this.felt('Genopretningskonto primo', 'egenkapitalPrimo.genopretning', 'num')}
      ${this.felt('Reserve til vedligeholdelse primo', 'egenkapitalPrimo.vedligehold', 'num')}
      ${this.felt('Andre reserver primo', 'egenkapitalPrimo.andreReserver', 'num')}
      ${this.felt(`Overført resultat primo iflg. den aflagte årsrapport for ${S.aar - 1} (tomt = ingen korrektion)`, 'egenkapitalPrimo.overfoertIflgRapport', 'num', { hint: 'Afviger det fra det korrigerede primo, viser noten en "korrektion vedrørende tidligere år"' })}
      ${this.felt('Forklaring på korrektionen (vises i noten)', 'egenkapitalPrimo.korrektionTekst', 'textarea', { wide: true, rows: 3 })}
    </div><p class="hjaelp">Andelsindskud primo beregnes som antal × indskud fratrukket indskud fra nye andele i året.</p></div>
    <div class="panel"><h3>Resultatdisponering (bestyrelsens forslag)</h3><div class="grid">
      ${this.felt('Overført til reserve til vedligeholdelse', 'disponering.tilVedligehold', 'num')}
      ${this.felt('Overført til andre reserver', 'disponering.tilAndreReserver', 'num')}
      ${this.felt('Overført til genopretningskonto', 'disponering.tilGenopretning', 'num')}
      ${this.felt('Anvendt af reserve til vedligeholdelse i året', 'disponering.anvendtVedligehold', 'num')}
      ${this.felt('Anvendt af andre reserver i året', 'disponering.anvendtAndreReserver', 'num')}
      ${this.felt('Anvendt af genopretningskonto i året', 'disponering.anvendtGenopretning', 'num')}
    </div>
    <table class="edit" style="max-width:520px;margin-top:8px"><tbody>
      <tr><td>Årets resultat</td><td style="text-align:right" data-calc="res.resultat">${fmtKr(e.get('res.resultat'))}</td></tr>
      <tr><td>Betalte prioritetsafdrag (overføres til overført resultat)</td><td style="text-align:right" data-calc="disp.afdrag">${fmtKr(e.get('disp.afdrag'))}</td></tr>
      <tr><td>Overført restandel af årets resultat</td><td style="text-align:right;font-weight:600" data-calc="disp.rest">${fmtKr(e.get('disp.rest'))}</td></tr>
    </tbody></table></div>
    <h2>Prioritetsgæld</h2>
    ${laanHtml || '<p class="hjaelp">Ingen lån oprettet.</p>'}
    <div class="knapper"><button class="knap" data-tilfoej="laan">+ Tilføj lån (opretter samtidig en konto til låneydelser)</button></div>
    <div class="panel"><h3>Anden gæld</h3>
      ${this.tabel('andenGaeld', [{ key: 'tekst', label: 'Tekst (vises i noten)' }, { key: 'primo', label: 'Primo', type: 'num', width: 'w-beloeb' }], { beregnet: [{ label: 'Ultimo', value: (it) => fmtKr(e.get(`ag.${it.id}.ultimo`)) }], tilfoejLabel: 'Tilføj anden gæld' })}
      <div class="grid">${this.felt('Forudmodtaget boligafgift primo', 'forudmodtaget.primo', 'num')}</div>
      <p class="hjaelp">Bevægelser i året bogføres i kasserapporten på konti knyttet til posten (fx depositum modtaget) eller som regulering nedenfor.</p></div>
    <div class="panel"><h3>Tilgodehavender</h3>
      ${this.tabel('tilgodehavender', [{ key: 'tekst', label: 'Tekst (vises i noten)' }, { key: 'primo', label: 'Primo', type: 'num', width: 'w-beloeb' }], { beregnet: [{ label: 'Ultimo', value: (it) => fmtKr(e.get(`tg.${it.id}.ultimo`)) }], tilfoejLabel: 'Tilføj tilgodehavende' })}</div>
    <div class="panel"><h3>Reguleringer (periodiseringer uden likvid bevægelse)</h3>
      <p class="hjaelp">Bruges til skyldige eller forudbetalte beløb, fx "skyldig revisor" (omkostning i år, betales næste år) eller "forudmodtaget boligafgift for januar". Beløbet føres på resultatlinjen og på balanceposten. Tilbageførsel af sidste års regulering indtastes med negativt beløb.</p>
      ${this.tabel('reguleringer', [{ key: 'tekst', label: 'Tekst' }, { key: 'beloeb', label: 'Beløb', type: 'num', width: 'w-beloeb' }, { key: 'linje', label: 'Resultatlinje', type: 'select', options: ALLE_LINJER.map(l => ({ id: l.id, label: `Note ${l.note}: ${l.label}` })) }, { key: 'balancepost', label: 'Balancepost', type: 'select', options: balanceposter }], { tilfoejLabel: 'Tilføj regulering' })}</div>`;
  }

  htmlBudget() {
    const S = this.state;
    const e = this.engine;
    const rows = NOTER_RESULTAT.map(n => {
      const lines = n.linjer.map(l => `<tr><td>${esc(l.label)}</td><td style="text-align:right" data-calc="${l.id}">${fmtKr(e.get(l.id))}</td><td class="num"><input type="text" inputmode="decimal" class="num" data-path="budget.${l.id}" data-type="num" value="${fmtKr(S.budget[l.id] || 0)}"></td><td class="num"><input type="text" inputmode="decimal" class="num" data-path="sidsteAar.linjer.${l.id}" data-type="num" value="${fmtKr(S.sidsteAar.linjer[l.id] || 0)}"></td></tr>`).join('');
      return `<tr class="sum"><td style="text-align:left">Note ${n.nr} ${esc(n.titel)}</td><td data-calc="${n.id}.total">${fmtKr(e.get(n.id + '.total'))}</td><td data-calc="bud.${n.id}.total">${fmtKr(e.get('bud.' + n.id + '.total'))}</td><td data-calc="prev.${n.id}.total">${fmtKr(e.get('prev.' + n.id + '.total'))}</td></tr>${lines}`;
    }).join('');
    return `<h2>Budget ${S.aar + 1} og sammenligningstal ${S.aar - 1}</h2>
    <p class="hjaelp">Budgettet vises i resultatopgørelsens højre kolonne. Omkostninger indtastes med minus. Sidste års tal kan vises som ekstra kolonne.</p>
    ${this.koblingHtml()}
    <div class="panel">
      ${this.felt('', 'sidsteAar.vis', 'bool', { checkLabel: `Vis kolonnen "Regnskab ${S.aar - 1}" i resultatopgørelse og noter` })}
      <div class="knapper"><button class="knap" data-action="kopier-budget">Kopiér årets tal til budgettet (afrundet)</button></div>
      <table class="edit"><thead><tr><th>Linje</th><th class="num">Regnskab ${S.aar}</th><th class="num">Budget ${S.aar + 1}</th><th class="num">Regnskab ${S.aar - 1}</th></tr></thead><tbody>${rows}
      <tr class="sum"><td style="text-align:left">Årets resultat</td><td data-calc="res.resultat">${fmtKr(e.get('res.resultat'))}</td><td data-calc="bud.res.resultat">${fmtKr(e.get('bud.res.resultat'))}</td><td data-calc="prev.res.resultat">${fmtKr(e.get('prev.res.resultat'))}</td></tr>
      <tr><td>Henlæggelse til vedligeholdelsesfond (vedtægternes § 30, stk. 3)</td><td style="text-align:right" data-calc="disp.vedligehold">${fmtKr(e.get('disp.vedligehold'))}</td><td class="num"><input type="text" inputmode="decimal" class="num" data-path="budgetHenlaeggelse" data-type="num" value="${fmtKr(S.budgetHenlaeggelse || 0)}"></td><td></td></tr>
      <tr class="sum"><td style="text-align:left">Heraf afdrag på prioritetsgæld</td><td data-calc="disp.afdrag">${fmtKr(e.get('disp.afdrag'))}</td><td data-calc="bud.disp.afdrag">${fmtKr(e.get('bud.disp.afdrag'))}</td><td></td></tr>
      <tr class="sum"><td style="text-align:left">Overført restandel</td><td data-calc="disp.rest">${fmtKr(e.get('disp.rest'))}</td><td data-calc="bud.disp.rest">${fmtKr(e.get('bud.disp.rest'))}</td><td></td></tr>
      </tbody></table></div>`;
  }

  htmlNoegle() {
    const S = this.state; const y = S.aar;
    const typer = [['b1', 'B1 Andelsboliger'], ['b2', 'B2 Erhvervsandele'], ['b3', 'B3 Boliglejemål'], ['b4', 'B4 Erhvervslejemål'], ['b5', 'B5 Øvrige lejemål, kældre, garager m.m.']];
    const ar = typer.map(([b, t]) => `<tr><td>${t}</td>
      <td class="num"><input type="text" inputmode="decimal" class="num" data-path="noegle.arealer.y2.${b}" data-type="int" value="${fmtInt(S.noegle.arealer.y2[b])}"></td>
      <td class="num"><input type="text" inputmode="decimal" class="num" data-path="noegle.arealer.y1.${b}" data-type="int" value="${fmtInt(S.noegle.arealer.y1[b])}"></td>
      <td class="num"><input type="text" inputmode="decimal" class="num" data-path="noegle.antal.${b}" data-type="int" value="${fmtInt(S.noegle.antal[b])}"></td>
      <td class="num"><input type="text" inputmode="decimal" class="num" data-path="noegle.arealer.y0.${b}" data-type="int" value="${fmtInt(S.noegle.arealer.y0[b])}"></td></tr>`).join('');
    const ft = FORDELINGSTAL.map(f => ({ id: f.id, label: f.label }));
    return `<h2>Nøgleoplysninger (bekendtgørelse nr. 336 af 20. marts 2025, bilag 1)</h2>
    <p class="hjaelp">Nøgleoplysningerne B1–B6, C1–C3, D1–D2, E1–E2, F1–F4, G1–G3, H1–H3, J, K1–K3, M1–M3 og R skal optages som noter til årsregnskabet (§ 3). De beregnede felter (F2–F4, H, J, K, M, R for året) udregnes automatisk. Stiftelses- og opførelsesår (D1–D2) indtastes under Stamdata.</p>
    <div class="panel"><h3>B. Arealer og antal</h3>
      <table class="edit"><thead><tr><th>Boligtype</th><th class="num">BBR-areal m² ${y - 2}</th><th class="num">BBR-areal m² ${y - 1}</th><th class="num">Antal ${y}</th><th class="num">BBR-areal m² ${y}</th></tr></thead><tbody>${ar}</tbody></table></div>
    <div class="panel"><h3>C. Fordelingstal</h3><div class="grid">
      ${this.felt('C1 Fordelingstal ved opgørelse af andelsværdien', 'noegle.fordelingstalAndelsvaerdi', 'select', { options: ft })}
      ${this.felt('C2 Fordelingstal ved opgørelse af boligafgiften', 'noegle.fordelingstalBoligafgift', 'select', { options: ft })}
      ${this.felt('C3 Tekst (feltets ordlyd fra bilag 1 – udfyld hvis relevant)', 'noegle.c3Tekst', 'text', { hint: 'Kontrollér ordlyden af felt C3 i bilag 1 til bekendtgørelse nr. 336/2025' })}
      ${this.felt('C3 Svar', 'noegle.c3Svar')}
    </div></div>
    <div class="panel"><h3>E. Hæftelse</h3><div class="grid">
      ${this.felt('', 'noegle.haefter', 'bool', { checkLabel: 'E1 Andelshaverne hæfter for mere end deres indskud' })}
      ${this.felt('E1 Uddybning (fx "personligt og solidarisk for realkreditlån")', 'noegle.haefterTekst')}
      ${this.felt('E2 Tekst (feltets ordlyd fra bilag 1 – udfyld hvis relevant)', 'noegle.e2Tekst', 'text', { hint: 'Kontrollér ordlyden af felt E2 i bilag 1 til bekendtgørelse nr. 336/2025' })}
      ${this.felt('E2 Svar', 'noegle.e2Svar')}
    </div></div>
    <div class="panel"><h3>G. Tilskud og klausuler</h3>
      ${this.felt('', 'noegle.g1', 'bool', { checkLabel: 'G1 Foreningen har modtaget offentligt tilskud, som skal tilbagebetales ved foreningens opløsning' })}
      ${this.felt('', 'noegle.g2', 'bool', { checkLabel: 'G2 Ejendommen er pålagt tilskudsbestemmelser, jf. lov om frigørelse for visse tilskudsbestemmelser m.v.' })}
      ${this.felt('', 'noegle.g3', 'bool', { checkLabel: 'G3 Der er tinglyst tilbagekøbsklausul (hjemfaldspligt) på ejendommen' })}
    </div>
    <div class="panel"><h3>H. Indtægter i december måned (× 12 / m²)</h3><div class="grid">
      ${this.felt('H1 Boligafgift, december', 'noegle.boligafgiftDecember', 'num')}
      ${this.felt('H2 Erhvervslejeindtægter, december', 'noegle.erhvervslejeDecember', 'num')}
      ${this.felt('H3 Boliglejeindtægter, december', 'noegle.boliglejeDecember', 'num')}
    </div></div>
    <div class="panel"><h3>J, M, R – tidligere år (kr. pr. m², fra de to foregående årsrapporter)</h3><div class="grid">
      ${this.felt(`J Årets resultat pr. m² ${y - 2}`, 'noegle.resultatPrM2.y2', 'int')}
      ${this.felt(`J Årets resultat pr. m² ${y - 1}`, 'noegle.resultatPrM2.y1', 'int')}
      ${this.felt(`M1 Vedligeholdelse, løbende pr. m² ${y - 2}`, 'noegle.vedligeholdLoebende.y2', 'int')}
      ${this.felt(`M1 Vedligeholdelse, løbende pr. m² ${y - 1}`, 'noegle.vedligeholdLoebende.y1', 'int')}
      ${this.felt(`M2 Genopretning/renovering pr. m² ${y - 2}`, 'noegle.vedligeholdGenopretning.y2', 'int')}
      ${this.felt(`M2 Genopretning/renovering pr. m² ${y - 1}`, 'noegle.vedligeholdGenopretning.y1', 'int')}
      ${this.felt(`R Årets afdrag pr. m² ${y - 2}`, 'noegle.afdragPrM2.y2', 'int')}
      ${this.felt(`R Årets afdrag pr. m² ${y - 1}`, 'noegle.afdragPrM2.y1', 'int')}
    </div></div>
    <div class="panel"><h3>Frivilligt</h3>
      ${this.felt('', 'noegle.visP', 'bool', { checkLabel: 'Vis nøgletal P (friværdi) – udgået af bekendtgørelsen pr. 1. juli 2025, kan medtages frivilligt' })}
    </div>`;
  }

  htmlTekster() {
    const t = (key, label, hint) => `<div class="panel"><h3>${esc(label)}</h3>${hint ? `<p class="hjaelp">${esc(hint)}</p>` : ''}${this.felt('', 'tekster.' + key, 'textarea', { rows: key === 'praksis' ? 22 : 5 })}<div class="knapper"><button class="knap lille" data-action="standardtekst:${key}">Gendan standardtekst</button></div></div>`;
    return `<h2>Tekster i årsrapporten</h2>
    <p class="hjaelp">Flettefelter: {{forening.navn}}, {{aar}}, {{aarNaeste}}, {{aarForrige}}, {{laan.restgaeld}}, {{laan.kursvaerdi}}, {{ejendom.bogfoert}}, {{ejendom.vurdering}}, {{av.litra}}, {{av.princip}}, {{av.prKrone}}, {{av.prAndel}}. I "Anvendt regnskabspraksis" giver linjer der starter med "## " overskrifter og "### " underoverskrifter.</p>
    ${t('paategning', 'Bestyrelsespåtegning')}
    ${t('bilagskontrol', 'Bilagskontrollørernes erklæring', 'Hvis foreningen bruger revisor, indsættes revisors erklæring her i stedet.')}
    ${t('praksis', 'Anvendt regnskabspraksis')}
    ${t('pantsaetning', 'Note: Pantsætninger og sikkerhedsstillelser')}
    ${t('eventualforpligtelser', 'Note: Eventualforpligtelser')}
    ${t('vedligeholdBegrundelse', 'Note: Reserve til vedligeholdelse – generalforsamlingens beslutning og begrundelse (vedtægternes § 30, stk. 3)', 'Skriv, hvad generalforsamlingen har besluttet om årets henlæggelse, og hvorfor. Teksten vises under noten om reserve til vedligeholdelse.')}
    ${t('forbedringer', 'Note: Andelsværdi – andelshavernes egne forbedringer (vedtægternes § 14)')}
    ${t('forsikringer', 'Note: Forsikringer – indledning (vedtægternes § 29, stk. 5)')}
    ${t('andelsvaerdiIntro', 'Note: Beregning af andelsværdi – indledning')}
    ${t('noegleIntro', 'Note: Nøgleoplysninger – indledning')}`;
  }

  htmlHjaelp() {
    return `<h2>Sådan bruger du programmet</h2>
    <div class="panel">
    <ol>
      <li><b>Stamdata</b>: foreningens navn, CVR, bestyrelse, bilagskontrollører og datoer.</li>
      <li><b>Kasserapport</b>: importér bankens CSV-eksport (posteringerne konteres automatisk efter reglerne under Kontoplan) eller indtast ind- og udbetalinger manuelt med dato, bilagsnummer, tekst, konto og likvid konto. Kontokortet nederst viser posteringerne pr. konto.</li>
      <li><b>Boligafgift</b>: måned for måned pr. andel med restancer og forudbetalinger, på tværs af alle år.</li>
      <li><b>Kontoplan</b>: knyt hver konto til en linje i regnskabet. Standardkontoplanen dækker de fleste behov.</li>
      <li><b>Primo &amp; lån</b>: sidste års balancetal, ejendommens værdi, andele, resultatdisponering, lån, anden gæld og reguleringer. For lån kan kreditforeningens betalingsplan indsættes (kopieret fra låneafregningen eller årsopgørelsen); så beregnes renter, afdrag, kortfristet del og restgæld automatisk for hvert år, og de bogførte ydelser afstemmes mod planen.</li>
      <li><b>Budget &amp; sidste år</b>: budget for næste år (vises i resultatopgørelsen) og evt. sidste års tal.</li>
      <li><b>Nøgleoplysninger</b>: arealer, fordelingstal, hæftelse, tilskud, december-indtægt og tidligere års nøgletal.</li>
      <li><b>Regnskab</b>: den færdige årsrapport, afsluttet med en automatisk vurdering af regnskabets robusthed (styrker, opmærksomhedspunkter, advarselstegn). Slå "Vis formler" til for at se beregningerne, eller klik på et tal for at spore det tilbage til posteringer og indtastninger.</li>
      <li><b>Kontrolside</b>: alle afstemninger. Regnskabet er klar, når alle kontroller er grønne (advarsler bør gennemgås).</li>
      <li><b>Excel</b>: eksporterer hele regnskabet som projektmappe med rigtige formler på tværs af arkene (Grunddata og Kasserapport er kilderne). <b>Udskriv / PDF</b>: åbner browserens udskrift, hvor du vælger "Gem som PDF".</li>
    </ol>
    <p><b>Aktuelle vedtægter</b>: fanen viser vedtægterne, de regnskabsrelevante bestemmelser og et automatisk vedtægtstjek af det valgte regnskabsår (bestyrelse, revision, frister, indskud, fordelingstal, andelsværdi, henlæggelsesfond, fremlejedepositum, forsikringsnote).</p>
    <p><b>Arkiv</b>: fanen Arkiv viser de aflagte årsrapporter, lånedokumenter og kontoudtog, som ligger i mappen arkiv/ i repoet.</p>
    <p><b>Flere regnskabsår</b>: Når 2025 er indtastet, klikker du <b>+ Nyt år</b> i topbjælken. 2026 oprettes med 2025's ultimotal som primotal, 2025's resultat i sammenligningskolonnen og nøgletallene forskudt. Koblingen er levende: retter du noget i 2025, følger 2026's primotal med. Skift mellem årene i topbjælkens årsvælger; regnskab, kontrolside, Excel og PDF gælder altid det valgte år.</p>
    <p>Data gemmes automatisk i browseren. Brug <b>Gem fil</b> for at gemme en kopi (.json) med alle regnskabsår, som kan åbnes igen på en anden computer.</p>
    </div>
    <div class="panel"><h3>Regelgrundlag (2026)</h3>
    <ul>
      <li>Årsregnskabsloven, regnskabsklasse A (andelsboligforeninger aflægger efter klasse A, jf. andelsboligforeningslovens § 6, stk. 2).</li>
      <li>Andelsboligforeningsloven § 5 (andelsværdi: litra a anskaffelsespris, b valuarvurdering, c offentlig vurdering, d nettoprisindekseret offentlig vurdering; § 5, stk. 3 fastholdt vurdering) og § 6 (årsregnskab, note om andelsværdi og nøgleoplysninger).</li>
      <li>Bekendtgørelse nr. 336 af 20. marts 2025 om oplysningspligt ved salg af andelsboliger m.v. samt om bestyrelsens pligt til at fremlægge skema over centrale nøgleoplysninger (i kraft 1. juli 2025). § 3: felterne B1–B6, C1–C3, D1–D2, E1–E2, F1–F4, G1–G3, H1–H3, J, K1–K3, M1–M3 og R fra bilag 1 skal være noter i årsregnskabet. Nøgletal P (friværdi) er udgået.</li>
      <li>Erhvervsstyrelsens "Regnskabsvejledning for andelsboligforeninger" (december 2021) og modelregnskab: opstilling af resultatopgørelse, balance, noter, resultatdisponering, kortfristet del af prioritetsgæld, egenkapital med generalforsamlingsbestemte reserver.</li>
    </ul></div>`;
  }

  // ---------- Rapport ----------
  renderRapport() {
    const el = document.getElementById('rapport');
    if (this.fejl) { el.innerHTML = `<div class="panel">Fejl i beregningen: ${esc(this.fejl)}</div>`; return; }
    const e = this.engine;
    const cell = (c, col, rowKind) => {
      if (!c) return '<td></td>';
      if (c.node) {
        const n = e.node(c.node);
        let v = e.get(c.node);
        if (c.neg) v = -v;
        const txt = fmtBy(v, n.fmt);
        const formel = n.input ? 'indtastet' : '= ' + e.formelTekst(c.node);
        return `<td class="num"><span class="val ${n.input ? 'input' : ''}" data-node="${c.node}" title="${esc(n.label)}">${txt}</span><div class="formel">${esc((c.neg ? '− ' : '') + formel)}</div></td>`;
      }
      return `<td class="${col && col.center ? 'center' : col && col.num ? 'num' : ''}">${esc(c.text ?? '')}</td>`;
    };
    const para = (text) => '<div class="para">' + String(text || '').split(/\n/).map(line => {
      if (line.startsWith('### ')) return `<h4>${esc(line.slice(4))}</h4>`;
      if (line.startsWith('## ')) return `<h3>${esc(line.slice(3))}</h3>`;
      return esc(line);
    }).join('\n') + '</div>';
    let sidenr = 0;
    const html = this.rapport.pages.map((p) => {
      const blocks = p.blocks.map(b => {
        switch (b.type) {
          case 'forside': return `<div class="forside">${b.lines.map((l, i) => `<div class="l${i}">${esc(l)}</div>`).join('')}</div>`;
          case 'title': return `<h2 class="titel">${b.note ? `<span style="color:var(--muted);font-size:.9rem;margin-right:8px">Note ${b.note}</span>` : ''}${esc(b.text)}</h2>`;
          case 'para': return para(b.text);
          case 'sign': return `${b.titel ? `<div class="sign-titel">${esc(b.titel)}</div>` : ''}<div class="sign">${b.personer.map(x => `<div class="person"><div class="navn">${esc(x.navn)}</div><div class="titel">${esc(x.titel)}</div></div>`).join('')}</div>`;
          case 'vurdering': return `<div class="vurd-samlet vurd-${b.niveau}"><div class="vurd-niveau">${{ styrke: 'Robust', opmaerksomhed: 'Robust med opmærksomhedspunkter', advarsel: 'Advarselstegn' }[b.niveau]}</div><div>${esc(b.tekst)}</div><div class="vurd-antal">${b.antal.styrke} styrker · ${b.antal.opmaerksomhed} opmærksomhedspunkter · ${b.antal.advarsel} advarselstegn</div></div>`;
          case 'liste': return `<h3 class="vurd-h vurd-${b.kategori}">${esc(b.titel)}</h3>${b.punkter.length ? b.punkter.map(x => `<div class="vurd vurd-${b.kategori}"><div class="vurd-titel">${esc(x.titel)}</div><div class="vurd-tekst">${esc(x.tekst)}</div></div>`).join('') : '<p class="vurd-ingen">Ingen.</p>'}`;
          case 'table': {
            const cols = b.columns;
            const head = `<tr>${cols.map((c, i) => `<th class="${i < 2 ? 'txt' : c.center ? 'center' : ''}">${esc(c.label)}</th>`).join('')}</tr>`;
            const rows = b.rows.map(r => {
              if (r.kind === 'blank') return `<tr class="blank"><td colspan="${cols.length}"></td></tr>`;
              if (r.kind === 'text') return `<tr class="text"><td></td><td colspan="${cols.length - 1}">${esc(r.label)}</td></tr>`;
              const cells = r.cells || [];
              return `<tr class="${r.kind}"><td class="note">${esc(r.note ?? '')}</td><td>${esc(r.label ?? '')}</td>${cols.slice(2).map((col, i) => cell(cells[i], col, r.kind)).join('')}</tr>`;
            }).join('');
            return `<table class="rpt"><thead>${head}</thead><tbody>${rows}</tbody></table>${b.note ? `<div class="tabelnote" style="margin:-8px 0 12px;font-size:.78rem;color:var(--muted)">${esc(b.note)}</div>` : ''}`;
          }
        }
        return '';
      }).join('');
      const side = p.id === 'forside' ? '' : `<div class="ftr">Side ${++sidenr}</div>`;
      return `<section class="page" id="side-${p.id}">${p.header ? `<div class="hdr"><span>${esc(p.header)}</span><span>Årsrapport ${this.state.aar}</span></div>` : ''}${blocks}${side}</section>`;
    }).join('');
    el.innerHTML = html;
    el.classList.toggle('vis-formler', this.visFormler);
  }

  visSpor(id) {
    const e = this.engine;
    const panel = document.getElementById('spor');
    const ind = document.getElementById('spor-indhold');
    const render = (nodeId) => {
      const t = e.trace(nodeId, 1);
      const deps = t.deps.map(d => `<div class="dep ${d.input ? 'input' : ''}" data-id="${d.id}"><span class="dl">${esc(d.label)}</span><span class="dv">${fmtBy(d.value, d.fmt)}</span></div>`).join('');
      let kilde = '';
      // Vis posteringer bag KONTO/LIKVID-udtryk
      const n = e.node(nodeId);
      if (!n.input && /KONTO\(|LIKVID(IND|UD)\(/.test(n.expr)) {
        const kontoer = [...n.expr.matchAll(/KONTO\((\d+)\)/g)].map(m => Number(m[1]));
        const likv = [...n.expr.matchAll(/LIKVID(?:IND|UD)\("([^"]+)"\)/g)].map(m => m[1]);
        const ps = this.state.posteringer.filter(p => kontoer.includes(Number(p.konto)) || likv.includes(p.likvid));
        if (ps.length) kilde = `<div class="deps"><b>Posteringer (${ps.length})</b>${ps.map(p => `<div class="dep"><span class="dl">${esc(p.dato)} ${esc(p.bilag)} ${esc(p.tekst)} <span style="color:var(--muted)">(konto ${esc(p.konto)})</span></span><span class="dv">${fmtKr(num(p.ind) - num(p.ud))}</span></div>`).join('')}</div>`;
      }
      ind.innerHTML = `<div class="spor-node"><span class="v">${fmtBy(t.value, t.fmt)}</span><div class="lbl">${esc(t.label)}</div><div class="f">${t.input ? 'Indtastet værdi' : '= ' + esc(t.formel)}</div><div class="f" style="color:var(--muted)">id: ${esc(nodeId)}</div>${deps ? `<div class="deps"><b>Bygger på</b>${deps}</div>` : ''}${kilde}</div>${this._sporHist.length > 1 ? '<button class="knap lille" id="spor-tilbage">← Tilbage</button>' : ''}`;
      ind.querySelectorAll('.dep[data-id]').forEach(d => d.addEventListener('click', () => { this._sporHist.push(d.dataset.id); render(d.dataset.id); }));
      const tb = document.getElementById('spor-tilbage'); if (tb) tb.addEventListener('click', () => { this._sporHist.pop(); render(this._sporHist[this._sporHist.length - 1]); });
    };
    this._sporHist = [id];
    render(id);
    panel.classList.add('open');
  }

  // ---------- Kontrol ----------
  renderKontrol() {
    const el = document.getElementById('tab-kontrol');
    if (this.fejl) { el.innerHTML = `<div class="kontrol-banner fejl">Fejl i beregningen: ${esc(this.fejl)}</div>`; return; }
    const k = this.kontrol;
    const banner = k.antal.fejl ? `<div class="kontrol-banner fejl">Regnskabet balancerer IKKE – ${k.antal.fejl} kontrol(ler) fejler. Ret fejlene, før regnskabet aflægges.</div>`
      : k.antal.advarsel ? `<div class="kontrol-banner advarsel">Regnskabet balancerer, og afstemningerne stemmer. ${k.antal.advarsel} advarsel(er) bør gennemgås.</div>`
      : `<div class="kontrol-banner ok">Regnskabet balancerer, og alle afstemninger er korrekte.</div>`;
    const e = this.engine;
    const items = k.kontroller.map(c => {
      const afstem = c.venstre && c.hoejre ? `<table class="afstem"><tr><td>${esc(c.venstre.label)}</td><td class="num">${c.venstre.node ? `<span class="val" data-node="${c.venstre.node}">${fmtKr(c.venstre.value)}</span>` : fmtKr(c.venstre.value)}</td></tr><tr><td>${esc(c.hoejre.label)}</td><td class="num">${c.hoejre.node ? `<span class="val" data-node="${c.hoejre.node}">${fmtKr(c.hoejre.value)}</span>` : fmtKr(c.hoejre.value)}</td></tr><tr><td><b>Difference</b></td><td class="num"><b>${fmtKr(c.diff)}</b></td></tr></table>`
        : c.venstre ? `<table class="afstem"><tr><td>${esc(c.venstre.label)}</td><td class="num">${c.venstre.node ? `<span class="val" data-node="${c.venstre.node}">${fmtKr(c.venstre.value)}</span>` : fmtKr(c.venstre.value)}</td></tr></table>` : '';
      return `<div class="kontrol ${c.status}"><div class="k-titel"><span class="k-status">${c.status}</span>${esc(c.titel)}</div><div class="k-fork">${esc(c.forklaring)}</div>${afstem}${c.detaljer.length ? `<ul>${c.detaljer.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</div>`;
    }).join('');
    el.innerHTML = `<h2>Kontrolside – afstemninger</h2>${banner}
    <div class="panel"><b>Nøgletal:</b> Årets resultat <span class="val" data-node="res.resultat">${fmtKr(e.get('res.resultat'))}</span> · Aktiver i alt <span class="val" data-node="bal.aktiver.ultimo">${fmtKr(e.get('bal.aktiver.ultimo'))}</span> · Passiver i alt <span class="val" data-node="bal.passiver.ultimo">${fmtKr(e.get('bal.passiver.ultimo'))}</span> · Likvide beholdninger <span class="val" data-node="likvid.total.ultimo">${fmtKr(e.get('likvid.total.ultimo'))}</span> · Andelsværdi pr. andelskrone <span class="val" data-node="av.prKrone">${fmtKr(e.get('av.prKrone'))}</span></div>
    ${items}`;
  }
}
