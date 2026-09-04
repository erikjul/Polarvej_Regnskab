// excel.js – eksport af hele regnskabet til en Excel-projektmappe med rigtige formler.
// Kilder: arket "Grunddata" (alle indtastede tal, blå) og "Kasserapport" (posteringer).
// Alle øvrige tal i rapportarkene er formler, der refererer på tværs af arkene.
import { toExcel } from './expr.js';
import { alleMappings } from './model.js';
import { downloadBlob } from './storage.js';
import { sorter, aarAf } from './betalingsplan.js';

const KAP_FRA = 5, KAP_TIL = 1500; // rækkeområde for posteringer i Kasserapport
const NUMFMT = { kr: '#,##0.00;-#,##0.00', int: '#,##0;-#,##0', dec2: '0.00', pct: '0.0" %"', pct0: '0" %"' };
const COL = (i) => String.fromCharCode(64 + i); // 1 → A
const q = (name) => "'" + name.replace(/'/g, "''") + "'";
const sheetName = (s) => s.replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31);

class Ark {
  constructor(name) { this.name = sheetName(name); this.rows = []; this.merges = []; this.widths = null; }
  add(cells, opts = {}) { this.rows.push({ cells, ...opts }); return this.rows.length; }
  get next() { return this.rows.length + 1; }
}

export function byggeWorkbook(engine, rapport, kontrol, ExcelJSLib) {
  const XL = ExcelJSLib || globalThis.ExcelJS;
  if (!XL) throw new Error('ExcelJS er ikke indlæst');
  const S = engine.state;
  const y = S.aar;
  const homes = new Map(); // nodeId -> { ark, col, row }
  const ref = (id) => { const h = homes.get(id); if (!h) throw new Error('Node uden placering i Excel: ' + id); return `${q(h.ark)}!${COL(h.col)}${h.row}`; };
  const xctx = {
    ref,
    konto: (nr) => `SUMIF(Kasserapport!$D$${KAP_FRA}:$D$${KAP_TIL},${nr},Kasserapport!$G$${KAP_FRA}:$G$${KAP_TIL})-SUMIF(Kasserapport!$D$${KAP_FRA}:$D$${KAP_TIL},${nr},Kasserapport!$H$${KAP_FRA}:$H$${KAP_TIL})`,
    likvidInd: (id) => `SUMIF(Kasserapport!$I$${KAP_FRA}:$I$${KAP_TIL},"${id}",Kasserapport!$G$${KAP_FRA}:$G$${KAP_TIL})`,
    likvidUd: (id) => `SUMIF(Kasserapport!$I$${KAP_FRA}:$I$${KAP_TIL},"${id}",Kasserapport!$H$${KAP_FRA}:$H$${KAP_TIL})`,
    plan: (id, aar, felt) => `SUMIFS(Betalingsplan!$${felt === 'rente' ? 'D' : 'E'}$4:$${felt === 'rente' ? 'D' : 'E'}$1000,Betalingsplan!$A$4:$A$1000,"${id}",Betalingsplan!$B$4:$B$1000,${aar})`,
    planAkk: (id, aar) => `SUMIFS(Betalingsplan!$E$4:$E$1000,Betalingsplan!$A$4:$A$1000,"${id}",Betalingsplan!$B$4:$B$1000,"<="&${aar})`,
  };
  const arkListe = [];

  // ---------- Kasserapport ----------
  const kap = new Ark('Kasserapport');
  kap.widths = [12, 9, 44, 8, 30, 30, 15, 15, 10];
  kap.add([{ c: 1, v: `Kasserapport ${y} – ${S.forening.navn || ''}`, bold: true, size: 14 }]);
  kap.add([{ c: 1, v: 'Indtast posteringer fra række 5. Konto (kolonne D) styrer, hvor beløbet lander i regnskabet. Likvid-id (kolonne I) angiver bankkonto/kasse.' }]);
  kap.add([]);
  kap.add(['Dato', 'Bilag', 'Tekst', 'Konto', 'Kontonavn', 'Likvid konto', 'Indsat', 'Hævet', 'Likvid-id'].map((v, i) => ({ c: i + 1, v, bold: true, border: 'bottom' })));
  const kontoNavn = Object.fromEntries((S.kontoplan || []).map(k => [Number(k.nr), k.navn]));
  const likvidNavn = Object.fromEntries((S.likvidkonti || []).map(k => [k.id, k.navn]));
  (S.posteringer || []).forEach(p => {
    kap.add([
      { c: 1, v: p.dato ? new Date(p.dato + 'T00:00:00') : null, fmt: 'dd.mm.yyyy' },
      { c: 2, v: p.bilag || '' }, { c: 3, v: p.tekst || '' }, { c: 4, v: p.konto === '' || p.konto === null ? null : Number(p.konto), input: true },
      { c: 5, v: kontoNavn[Number(p.konto)] || '' }, { c: 6, v: likvidNavn[p.likvid] || '' },
      { c: 7, v: Number(p.ind) || 0, fmt: NUMFMT.kr, input: true }, { c: 8, v: Number(p.ud) || 0, fmt: NUMFMT.kr, input: true }, { c: 9, v: p.likvid || '' },
    ]);
  });
  while (kap.rows.length < KAP_FRA + (S.posteringer || []).length + 1) kap.add([]);
  const sumRow = KAP_TIL + 1;
  while (kap.rows.length < sumRow - 1) kap.add([]);
  kap.add([{ c: 3, v: 'I alt', bold: true }, { c: 7, f: `SUM(G${KAP_FRA}:G${KAP_TIL})`, fmt: NUMFMT.kr, bold: true, border: 'top' }, { c: 8, f: `SUM(H${KAP_FRA}:H${KAP_TIL})`, fmt: NUMFMT.kr, bold: true, border: 'top' }]);
  kap.add([{ c: 3, v: 'Netto (indsat − hævet)', bold: true }, { c: 7, f: `G${sumRow}-H${sumRow}`, fmt: NUMFMT.kr, bold: true }]);
  arkListe.push(kap);

  // ---------- Grunddata (alle input-noder) ----------
  const gd = new Ark('Grunddata');
  gd.widths = [34, 62, 18];
  gd.add([{ c: 1, v: `Grunddata ${y} – ${S.forening.navn || ''}`, bold: true, size: 14 }]);
  gd.add([{ c: 1, v: 'Blå tal er indtastede værdier. Ret dem her – alle rapportark opdateres via formler. Kolonne A er feltets id.' }]);
  gd.add([]);
  const inputs = engine.order.filter(id => engine.node(id).input);
  const grupper = [...new Set(inputs.map(id => engine.node(id).group))];
  grupper.forEach(g => {
    gd.add([{ c: 2, v: g, bold: true, border: 'bottom' }]);
    inputs.filter(id => engine.node(id).group === g).forEach(id => {
      const n = engine.node(id);
      const r = gd.add([{ c: 1, v: id, muted: true }, { c: 2, v: n.label }, { c: 3, v: n.value, fmt: NUMFMT[n.fmt] || NUMFMT.kr, input: true }]);
      homes.set(id, { ark: gd.name, col: 3, row: r });
    });
    gd.add([]);
  });
  arkListe.push(gd);

  // ---------- Rapportark ----------
  const cellFor = (c, fmtDefault) => {
    if (!c) return null;
    if (c.node) {
      const n = engine.node(c.node);
      const fmt = NUMFMT[n.fmt] || NUMFMT.kr;
      if (n.input) return { node: c.node, neg: !!c.neg, fmt, kind: 'ref' };
      if (!c.neg && !homes.has(c.node)) return { node: c.node, fmt, kind: 'home' };
      return { node: c.node, neg: !!c.neg, fmt, kind: 'ref' };
    }
    return { v: c.text ?? '' };
  };
  rapport.pages.forEach(p => {
    const ark = new Ark(p.titel);
    ark.widths = [7, 62, 18, 18, 18, 18, 18, 18];
    if (p.header) ark.add([{ c: 2, v: p.header, muted: true }, { c: 3, v: `Årsrapport ${y}`, muted: true }]);
    p.blocks.forEach(b => {
      switch (b.type) {
        case 'forside': b.lines.forEach((l, i) => ark.add([{ c: 2, v: l, bold: i === 0 || i === 4, size: i === 0 ? 18 : i === 4 ? 20 : 12 }])); break;
        case 'title': ark.add([{ c: 2, v: (b.note ? `Note ${b.note}  ` : '') + b.text, bold: true, size: 14 }]); ark.add([]); break;
        case 'para': String(b.text || '').split(/\n/).forEach(line => {
          const h3 = line.startsWith('## '), h4 = line.startsWith('### ');
          const txt = h3 ? line.slice(3) : h4 ? line.slice(4) : line;
          const r = ark.add([{ c: 2, v: txt, bold: h3 || h4, wrap: !h3 && !h4, size: h3 ? 12 : undefined }], { height: h3 || h4 ? 18 : Math.max(15, Math.ceil(txt.length / 95) * 15) });
          if (!h3 && !h4 && txt.length > 60) ark.merges.push([r, 2, r, 6]);
        }); break;
        case 'sign':
          if (b.titel) ark.add([{ c: 2, v: b.titel, bold: true }]);
          ark.add([]); ark.add([]);
          ark.add(b.personer.map((x, i) => ({ c: 2 + i * 2, v: x.navn, bold: true, border: 'top' })));
          ark.add(b.personer.map((x, i) => ({ c: 2 + i * 2, v: x.titel, muted: true })));
          ark.add([]);
          break;
        case 'table': {
          ark.add(b.columns.map((col, i) => ({ c: i + 1, v: col.label, bold: true, border: 'bottom', align: i < 2 ? 'left' : col.center ? 'center' : 'right', wrap: true })), { height: 30 });
          b.rows.forEach(r => {
            if (r.kind === 'blank') { ark.add([]); return; }
            if (r.kind === 'text') { const rr = ark.add([{ c: 2, v: r.label, wrap: true }], { height: Math.max(15, Math.ceil(String(r.label).length / 95) * 15) }); ark.merges.push([rr, 2, rr, 6]); return; }
            const cells = [{ c: 1, v: r.note ?? '', muted: true }, { c: 2, v: r.label ?? '', bold: ['head', 'notehead', 'total', 'grand'].includes(r.kind), italic: r.kind === 'sub' }];
            (r.cells || []).forEach((c, i) => {
              const x = cellFor(c);
              if (!x) return;
              x.c = 3 + i;
              if (r.kind === 'total') x.border = 'top';
              if (r.kind === 'grand') { x.border = 'double'; x.bold = true; }
              if (x.v !== undefined && b.columns[2 + i] && b.columns[2 + i].center) x.align = 'center';
              cells.push(x);
            });
            const rowNr = ark.add(cells);
            cells.forEach(x => { if (x.kind === 'home') homes.set(x.node, { ark: ark.name, col: x.c, row: rowNr }); });
          });
          if (b.note) ark.add([{ c: 2, v: b.note, muted: true, wrap: true }], { height: Math.max(15, Math.ceil(String(b.note).length / 95) * 15) });
          ark.add([]);
          break;
        }
      }
    });
    arkListe.push(ark);
  });

  // ---------- Kontrol ----------
  const kt = new Ark('Kontrol');
  kt.widths = [8, 70, 18, 18, 16, 10];
  kt.add([{ c: 2, v: `Kontrolside – afstemninger ${y}`, bold: true, size: 14 }]);
  kt.add([{ c: 2, v: 'Status beregnes med formler: OK når differencen er under 0,005 kr.' }]);
  kt.add([]);
  kt.add([{ c: 2, v: 'Kontrol', bold: true, border: 'bottom' }, { c: 3, v: 'Beregnet', bold: true, border: 'bottom', align: 'right' }, { c: 4, v: 'Skal være', bold: true, border: 'bottom', align: 'right' }, { c: 5, v: 'Difference', bold: true, border: 'bottom', align: 'right' }, { c: 6, v: 'Status', bold: true, border: 'bottom' }]);
  const statusRows = [];
  kontrol.kontroller.forEach(c => {
    const cells = [{ c: 2, v: c.titel, bold: true }];
    if (c.venstre && c.venstre.node && c.hoejre && (c.hoejre.node || c.hoejre.value !== undefined)) {
      cells.push({ node: c.venstre.node, kind: 'ref', fmt: NUMFMT.kr, c: 3 });
      if (c.hoejre.node) cells.push({ node: c.hoejre.node, kind: 'ref', fmt: NUMFMT.kr, c: 4 }); else cells.push({ c: 4, v: c.hoejre.value, fmt: NUMFMT.kr });
      const r = kt.next;
      cells.push({ c: 5, f: `C${r}-D${r}`, fmt: NUMFMT.kr });
      cells.push({ c: 6, f: `IF(ABS(E${r})<0.005,"OK","FEJL")`, bold: true });
      statusRows.push(r);
    } else {
      cells.push({ c: 6, v: c.status.toUpperCase() });
    }
    kt.add(cells);
    if (c.forklaring) kt.add([{ c: 2, v: c.forklaring, muted: true, wrap: true }], { height: Math.max(15, Math.ceil(c.forklaring.length / 95) * 15) });
    (c.detaljer || []).forEach(d => kt.add([{ c: 2, v: '• ' + d, wrap: true }], { height: Math.max(15, Math.ceil(d.length / 95) * 15) }));
  });
  kt.add([]);
  if (statusRows.length) kt.add([{ c: 2, v: 'Samlet status (alle afstemninger)', bold: true }, { c: 6, f: `IF(COUNTIF(F4:F${kt.next - 1},"FEJL")=0,"OK","FEJL")`, bold: true }]);
  arkListe.push(kt);

  // ---------- Kontoplan ----------
  const kp = new Ark('Kontoplan');
  kp.widths = [8, 44, 50, 18];
  kp.add([{ c: 1, v: 'Kontoplan', bold: true, size: 14 }]);
  kp.add([]);
  kp.add([{ c: 1, v: 'Nr.', bold: true, border: 'bottom' }, { c: 2, v: 'Kontonavn', bold: true, border: 'bottom' }, { c: 3, v: 'Regnskabslinje / balancepost', bold: true, border: 'bottom' }, { c: 4, v: `Bevægelse ${y}`, bold: true, border: 'bottom', align: 'right' }]);
  const mapLabel = Object.fromEntries(alleMappings(S).map(m => [m.id, m.label]));
  (S.kontoplan || []).slice().sort((a, b) => a.nr - b.nr).forEach(k => kp.add([{ c: 1, v: Number(k.nr) }, { c: 2, v: k.navn }, { c: 3, v: mapLabel[k.linje] || '(ikke knyttet)' }, { c: 4, f: xctx.konto(Number(k.nr)), fmt: NUMFMT.kr }]));
  arkListe.push(kp);

  // ---------- Betalingsplan ----------
  const bp = new Ark('Betalingsplan');
  bp.widths = [10, 6, 12, 16, 16, 16, 18, 30];
  bp.add([{ c: 1, v: 'Betalingsplaner for prioritetsgæld (fra kreditforeningens låneafregning/årsopgørelse)', bold: true, size: 14 }]);
  bp.add([{ c: 1, v: 'Rapportens renter, afdrag, kortfristet del og restgæld hentes med SUMIFS fra dette ark for lån med kilde "betalingsplan".' }]);
  bp.add(['Lån-id', 'År', 'Termin', 'Rente og bidrag', 'Afdrag', 'Ydelse', 'Restgæld efter termin', 'Lån'].map((v, i) => ({ c: i + 1, v, bold: true, border: 'bottom' })));
  (S.laan || []).forEach(l => {
    let rest = Number(l.hovedstol) || 0;
    sorter(l.betalingsplan || []).forEach(t => {
      rest -= Number(t.afdrag) || 0;
      const r = bp.next;
      bp.add([{ c: 1, v: l.id }, { c: 2, v: aarAf(t.dato) }, { c: 3, v: t.dato ? new Date(t.dato + 'T00:00:00') : null, fmt: 'dd.mm.yyyy' }, { c: 4, v: Number(t.rente) || 0, fmt: NUMFMT.kr, input: true }, { c: 5, v: Number(t.afdrag) || 0, fmt: NUMFMT.kr, input: true }, { c: 6, f: `D${r}+E${r}`, fmt: NUMFMT.kr }, { c: 7, v: Math.round(rest * 100) / 100, fmt: NUMFMT.kr }, { c: 8, v: l.navn }]);
    });
  });
  arkListe.push(bp);

  // ---------- Beregninger (noder der ikke vises i rapporten) ----------
  const be = new Ark('Beregninger');
  be.widths = [34, 62, 18];
  be.add([{ c: 1, v: 'Hjælpeberegninger', bold: true, size: 14 }]);
  be.add([{ c: 1, v: 'Beregnede tal, som ikke vises direkte i rapporten, men som rapportens formler bygger på.' }]);
  be.add([]);
  engine.order.filter(id => !engine.node(id).input && !homes.has(id)).forEach(id => {
    const n = engine.node(id);
    const r = be.add([{ c: 1, v: id, muted: true }, { c: 2, v: n.label }, { node: id, kind: 'home', fmt: NUMFMT[n.fmt] || NUMFMT.kr, c: 3 }]);
    homes.set(id, { ark: be.name, col: 3, row: r });
  });
  arkListe.push(be);

  // ---------- Skriv projektmappen ----------
  const wb = new XL.Workbook();
  wb.creator = 'Polarvej Regnskab';
  wb.calcProperties = { fullCalcOnLoad: true };
  // rækkefølge: rapportark først, derefter kilder
  const order = [...arkListe.filter(a => !['Kasserapport', 'Grunddata', 'Kontrol', 'Kontoplan', 'Beregninger', 'Betalingsplan'].includes(a.name)), kt, kap, kp, gd, bp, be];
  order.forEach(ark => {
    const ws = wb.addWorksheet(ark.name, { views: [{ showGridLines: ['Kasserapport', 'Grunddata', 'Kontoplan', 'Betalingsplan'].includes(ark.name) }] });
    if (ark.widths) ark.widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ark.rows.forEach((row, ri) => {
      const r = ri + 1;
      const wsRow = ws.getRow(r);
      if (row.height) wsRow.height = row.height;
      row.cells.forEach(x => {
        const cell = ws.getCell(r, x.c);
        if (x.node) {
          const n = engine.node(x.node);
          let f;
          if (x.kind === 'home') f = toExcel(n.ast, xctx);
          else f = ref(x.node);
          if (x.neg) f = `-(${f})`;
          cell.value = { formula: f, result: (x.neg ? -1 : 1) * engine.get(x.node) };
          cell.numFmt = x.fmt || NUMFMT.kr;
          cell.alignment = { horizontal: 'right', vertical: 'top' };
        } else if (x.f !== undefined) {
          cell.value = { formula: x.f };
          if (x.fmt) cell.numFmt = x.fmt;
          cell.alignment = { horizontal: 'right' };
        } else if (x.v !== undefined && x.v !== null) {
          cell.value = x.v;
          if (x.fmt) cell.numFmt = x.fmt;
          if (typeof x.v === 'number') cell.alignment = { horizontal: 'right' };
        }
        const font = {};
        if (x.bold) font.bold = true;
        if (x.italic) font.italic = true;
        if (x.size) font.size = x.size;
        if (x.input) font.color = { argb: 'FF0B3D91' };
        if (x.muted) font.color = { argb: 'FF6B7280' };
        if (Object.keys(font).length) cell.font = font;
        if (x.wrap) cell.alignment = { ...(cell.alignment || {}), wrapText: true, vertical: 'top' };
        if (x.align) cell.alignment = { ...(cell.alignment || {}), horizontal: x.align };
        if (x.border === 'top') cell.border = { top: { style: 'thin' } };
        if (x.border === 'bottom') cell.border = { bottom: { style: 'thin' } };
        if (x.border === 'double') cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
      });
    });
    ark.merges.forEach(m => { try { ws.mergeCells(m[0], m[1], m[2], m[3]); } catch (e) { /* overlap – ignorer */ } });
    if (ark.name === 'Kasserapport') ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: true }];
  });
  return wb;
}

export async function eksporterExcel(engine, rapport, kontrol) {
  const wb = byggeWorkbook(engine, rapport, kontrol);
  const buf = await wb.xlsx.writeBuffer();
  const navn = ((engine.state.forening || {}).navn || 'regnskab').replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '_');
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Aarsrapport_${navn}_${engine.state.aar}.xlsx`);
}
