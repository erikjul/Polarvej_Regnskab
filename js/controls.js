// controls.js – kontrolsiden: afstemninger og sandsynlighedskontroller.
// Hver kontrol: { id, titel, forklaring, status: 'ok'|'fejl'|'advarsel'|'info', venstre, hoejre, diff, detaljer[] }
import { fmtKr } from './format.js';
import { alleMappings, LINJE_BY_ID } from './model.js';

const TOL = 0.005;
const naer = (a, b) => Math.abs(a - b) < TOL;

export function kontroller(engine) {
  const S = engine.state;
  const y = S.aar;
  const g = (id) => engine.get(id);
  const out = [];
  const push = (c) => { out.push(c); return c; };
  const afstem = (id, titel, venstreId, hoejreId, forklaring, opts = {}) => {
    const v = g(venstreId), h = g(hoejreId);
    const diff = v - h;
    return push({
      id, titel, forklaring,
      status: naer(v, h) ? 'ok' : (opts.advarsel ? 'advarsel' : 'fejl'),
      venstre: { label: engine.label(venstreId), value: v, node: venstreId },
      hoejre: { label: engine.label(hoejreId), value: h, node: hoejreId },
      diff,
      formel: `[${engine.label(venstreId)}] − [${engine.label(hoejreId)}] = ${fmtKr(diff)}`,
      detaljer: opts.detaljer || [],
    });
  };

  // 1. Balancen
  const primoDiff = g('bal.diff.primo');
  const ultimoDiff = g('bal.diff.ultimo');
  const c1 = afstem('bal.ultimo', `Balancen balancerer pr. 31/12 ${y}`, 'bal.aktiver.ultimo', 'bal.passiver.ultimo', 'Aktiver i alt skal være lig passiver i alt.');
  const c2 = afstem('bal.primo', `Primobalancen (31/12 ${y - 1}) balancerer`, 'bal.aktiver.primo', 'bal.passiver.primo', 'Sidste års balance (de indtastede primotal) skal balancere. Kontrollér primotallene under "Primo & lån" mod sidste års årsrapport.');
  if (c1.status !== 'ok' && naer(primoDiff, ultimoDiff)) {
    c1.detaljer.push('Differencen er den samme primo og ultimo. Årets bevægelser er altså konsistente – fejlen ligger i de indtastede primotal (sidste års balance).');
  }

  // 2. Kasserapport: alle posteringer konteret og gyldige
  const gyldige = new Set(alleMappings(S).map(m => m.id));
  const kontoer = Object.fromEntries((S.kontoplan || []).map(k => [Number(k.nr), k]));
  const likvidIds = new Set((S.likvidkonti || []).map(k => k.id));
  const fejl = [];
  const adv = [];
  const bilag = new Map();
  (S.posteringer || []).forEach((p, i) => {
    const ref = `Bilag ${p.bilag || '(uden nr.)'} ${p.dato || ''} "${p.tekst || ''}"`;
    const k = kontoer[Number(p.konto)];
    if (!p.konto && p.konto !== 0) fejl.push(`${ref}: mangler konto.`);
    else if (!k) fejl.push(`${ref}: konto ${p.konto} findes ikke i kontoplanen.`);
    else if (!k.linje || !gyldige.has(k.linje)) fejl.push(`${ref}: konto ${p.konto} "${k.navn}" er ikke knyttet til en regnskabslinje.`);
    if (!likvidIds.has(p.likvid)) fejl.push(`${ref}: ukendt likvid konto "${p.likvid || ''}".`);
    const ind = Number(p.ind) || 0, ud = Number(p.ud) || 0;
    if (ind === 0 && ud === 0) adv.push(`${ref}: beløb er 0.`);
    if (ind !== 0 && ud !== 0) adv.push(`${ref}: både indsat og hævet er udfyldt.`);
    if (ind < 0 || ud < 0) adv.push(`${ref}: negativt beløb – brug den modsatte kolonne i stedet.`);
    if (p.dato && !(String(p.dato).startsWith(String(y) + '-'))) adv.push(`${ref}: datoen ligger uden for regnskabsåret ${y}.`);
    if (!p.dato) adv.push(`${ref}: mangler dato.`);
    if (p.bilag) { if (bilag.has(p.bilag)) adv.push(`Bilagsnummer ${p.bilag} er brugt mere end én gang.`); bilag.set(p.bilag, i); }
  });
  push({ id: 'post.kontering', titel: 'Alle posteringer er konteret på en gyldig konto', forklaring: `${(S.posteringer || []).length} posteringer i kasserapporten.`, status: fejl.length ? 'fejl' : 'ok', detaljer: fejl });
  push({ id: 'post.kvalitet', titel: 'Posteringernes datoer, beløb og bilagsnumre', forklaring: 'Datoer inden for regnskabsåret, ét beløb pr. postering, entydige bilagsnumre.', status: adv.length ? 'advarsel' : 'ok', detaljer: adv });

  // 3. Pengestrømsafstemning (resultat + balancebevægelser = ændring i likvider)
  afstem('cf', 'Pengestrømsafstemning: årets resultat og balancebevægelser forklarer ændringen i likvide beholdninger', 'cf.faktisk', 'cf.beregnet', 'Ændring i likvide beholdninger = årets resultat (korrigeret for ikke-likvide reguleringer) − afdrag + bevægelser på balancekonti. En difference betyder, at posteringer mangler kontering.');

  // 4. Overførsler mellem likvide konti skal gå i nul
  push({ id: 'overfoersel', titel: 'Overførsler mellem likvide konti går i nul', forklaring: 'Posteringer på overførselskontoen skal summere til 0 (samme beløb hævet på én konto og indsat på en anden).', status: naer(g('bal.overfoersel'), 0) ? 'ok' : 'fejl', venstre: { label: 'Sum af overførsler', value: g('bal.overfoersel'), node: 'bal.overfoersel' }, hoejre: { label: 'Forventet', value: 0 }, diff: g('bal.overfoersel'), detaljer: [] });

  // 5. Bankafstemning pr. likvid konto
  (S.likvidkonti || []).forEach(k => {
    const id = `likvid.${k.id}.kontoudtog`;
    if (engine.has(id)) {
      afstem('bank.' + k.id, `Afstemning: ${k.navn}`, `likvid.${k.id}.ultimo`, id, `Beregnet saldo (primo + indbetalinger − udbetalinger) skal svare til saldoen på kontoudtoget pr. 31/12 ${y}.`, {
        detaljer: [`Primo ${fmtKr(g(`likvid.${k.id}.primo`))} + indbetalinger ${fmtKr(g(`likvid.${k.id}.ind`))} − udbetalinger ${fmtKr(g(`likvid.${k.id}.ud`))} = ${fmtKr(g(`likvid.${k.id}.ultimo`))}`],
      });
    } else {
      push({ id: 'bank.' + k.id, titel: `Afstemning: ${k.navn}`, forklaring: 'Indtast saldo iflg. kontoudtog pr. 31/12 under "Primo & lån" for at afstemme.', status: 'info', venstre: { label: 'Beregnet saldo', value: g(`likvid.${k.id}.ultimo`), node: `likvid.${k.id}.ultimo` }, detaljer: [] });
    }
  });

  // 6. Resultatopgørelse og disponering
  afstem('res.disp', 'Resultatdisponeringen summerer til årets resultat', 'disp.total', 'res.resultat', 'Overførsel til reserver + afdrag + restandel skal give årets resultat.');
  afstem('res.sum', 'Resultatopgørelsen: indtægter + omkostninger + finansielle poster = årets resultat', 'res.resultat', 'res.check', 'Formelkontrol af resultatopgørelsen.') ;

  // 7. Egenkapitalbevægelse
  afstem('ek', 'Egenkapitalen ultimo = primo + årets resultat + opskrivning + nye indskud', 'ek.total.ultimo', 'ek.check', 'Egenkapitalen må kun ændre sig med årets resultat, årets opskrivning af ejendommen og indskud fra nye andele.');

  // 8. Lån
  (S.laan || []).forEach(l => {
    const p = `laan.${l.id}`;
    const ingenYdelser = g(`${p}.ydelser`) === 0 || y >= new Date().getFullYear(); // året er ikke afsluttet/bogført → advarsel i stedet for fejl
    if (engine.has(`${p}.afdragIflg`)) afstem(`laan.${l.id}.afdrag`, `${l.navn}: afdrag stemmer med årsopgørelsen/betalingsplanen`, `${p}.afdrag`, `${p}.afdragIflg`, 'Beregnet afdrag (betalte ydelser − renter og bidrag) skal svare til afdraget på kreditforeningens årsopgørelse eller betalingsplan.', { advarsel: ingenYdelser });
    if (engine.has(`${p}.restgaeldUltimoIflg`)) afstem(`laan.${l.id}.restgaeld`, `${l.navn}: restgæld ultimo stemmer med årsopgørelsen/betalingsplanen`, `${p}.restgaeldUltimo`, `${p}.restgaeldUltimoIflg`, 'Restgæld primo − årets afdrag skal svare til restgælden på årsopgørelsen eller betalingsplanen.', { advarsel: ingenYdelser });
    if (engine.harPlan(l)) afstem(`laan.${l.id}.ydelser`, `${l.navn}: bogførte ydelser stemmer med betalingsplanen for ${y}`, `${p}.ydelser`, `${p}.ydelserIflg`, 'Summen af låneydelser i kasserapporten skal svare til årets terminer (renter + bidrag + afdrag) i kreditforeningens betalingsplan. En difference betyder en manglende, dobbelt eller forkert bogført ydelse – eller at planen er ændret (rentetilpasning, bidragsændring).', { advarsel: ingenYdelser, detaljer: ingenYdelser ? ['Der er endnu ikke bogført ydelser i året.'] : [] });
    const d = [];
    if (!engine.harPlan(l)) d.push('Ingen betalingsplan – renter, kortfristet del og restgæld indtastes manuelt. Indsæt kreditforeningens betalingsplan under "Primo & lån" for automatisk opgørelse og afstemning.');
    if (g(`${p}.ydelser`) === 0) d.push('Der er ikke bogført ydelser på lånet i kasserapporten (kontoen for låneydelser).');
    if (g(`${p}.renter`) > g(`${p}.ydelser`) && g(`${p}.ydelser`) > 0) d.push('Renter og bidrag overstiger de betalte ydelser – afdraget bliver negativt.');
    if (g(`${p}.kortfristet`) > g(`${p}.restgaeldUltimo`)) d.push('Kortfristet del overstiger restgælden.');
    if (g(`${p}.kortfristet`) === 0 && g(`${p}.restgaeldUltimo`) > 0) d.push(`Kortfristet del (afdrag i ${y + 1}) er 0 – udfyld fra kreditforeningens betalingsplan.`);
    const kv = g(`${p}.kursvaerdi`), rg = g(`${p}.restgaeldUltimo`);
    if (rg > 0 && (kv > rg * 1.25 || kv < rg * 0.5)) d.push(`Kursværdien (${fmtKr(kv)}) afviger meget fra restgælden (${fmtKr(rg)}). Kontrollér at kursværdien er pr. 31/12 ${y} (kreditforeningens årsopgørelse).`);
    if (kv === 0 && rg > 0) d.push('Kursværdien er 0 – indtast kursværdien pr. balancedagen (bruges i andelsværdiberegningen).');
    push({ id: `laan.${l.id}.sandsynlig`, titel: `${l.navn}: sandsynlighedskontrol`, forklaring: `Ydelser ${fmtKr(g(`${p}.ydelser`))} = renter/bidrag ${fmtKr(g(`${p}.renter`))} + afdrag ${fmtKr(g(`${p}.afdrag`))}. Restgæld ${fmtKr(g(`${p}.restgaeldPrimo`))} → ${fmtKr(rg)}.`, status: d.length ? 'advarsel' : 'ok', detaljer: d });
  });

  // 9. Reguleringer
  const rf = [];
  (S.reguleringer || []).forEach(r => {
    if (!LINJE_BY_ID[r.linje]) rf.push(`Regulering "${r.tekst}": ugyldig resultatlinje.`);
    if (!r.balancepost || !gyldige.has(r.balancepost) && r.balancepost !== 'forud') rf.push(`Regulering "${r.tekst}": ugyldig balancepost.`);
  });
  if ((S.reguleringer || []).length) push({ id: 'reg', titel: 'Reguleringer (periodiseringer) har gyldig resultatlinje og balancepost', forklaring: `${S.reguleringer.length} reguleringer.`, status: rf.length ? 'fejl' : 'ok', detaljer: rf });

  // 10. Andelsværdi
  const avd = [];
  if (g('av.fordelingstal') <= 0) avd.push('Fordelingstallet er 0 – andelsværdien kan ikke beregnes.');
  if (g('ejendom.vurdering') <= 0) avd.push('Ejendommens værdi (vurdering) er ikke indtastet.');
  if (g('av.senest') > g('av.prKrone') && g('av.prKrone') > 0) avd.push(`Den senest vedtagne andelsværdi (${fmtKr(g('av.senest'))}) overstiger den beregnede maksimale værdi (${fmtKr(g('av.prKrone'))}). Andelsværdien skal nedsættes (andelsboliglovens § 5).`);
  if (g('nk.antal.b1') !== g('andele.antal')) avd.push(`Antal andelsboliger i nøgleoplysningerne (${g('nk.antal.b1')}) afviger fra antal andele (${g('andele.antal')}).`);
  if ((S.ejendom || {}).vurderingsprincip === 'valuar' && !(S.ejendom || {}).vurderingTekst) avd.push('Angiv valuarvurderingens dato – en valuarvurdering må højst være 42 måneder gammel (andelsboliglovens § 5, stk. 2, litra b), medmindre den er fastholdt efter § 5, stk. 3.');
  push({ id: 'av', titel: 'Andelsværdi: grundlag og lovlighed', forklaring: `Beregnet ${fmtKr(g('av.prKrone'))} kr. pr. andelskrone (${fmtKr(g('av.prAndel'), 0)} kr. pr. andel). Senest vedtaget ${fmtKr(g('av.senest'))}.`, status: avd.length ? 'advarsel' : 'ok', detaljer: avd });

  // 11. Nøgleoplysninger
  const nkd = [];
  if (g('nk.areal.y0.b6') <= 0) nkd.push('Arealer (BBR) mangler – nøgletal pr. m² kan ikke beregnes.');
  const sumAreal = (S.andelshavere || []).reduce((t, a) => t + (Number(a.areal) || 0), 0);
  if (sumAreal > 0 && Math.abs(sumAreal - g('nk.areal.y0.b1')) > 0.5) nkd.push(`Boligernes arealer i andelslisten summerer til ${fmtKr(sumAreal, 0)} m², men nøgleoplysning B1 (andelsboliger) er ${fmtKr(g('nk.areal.y0.b1'), 0)} m². Nøgletallene pr. m² (F2, H1, J, K1–K3, M, R) beregnes ud fra B1 – afklar hvilket tal der er rigtigt iflg. BBR.`);
  if (g('nk.h1.maaned') <= 0) nkd.push('Boligafgift for december måned mangler (felt H1).');
  if (g('nk.j.y1') === 0 && g('nk.j.y2') === 0) nkd.push('Tidligere års nøgletal (J, M, R) er ikke udfyldt – tag dem fra de to foregående årsrapporter.');
  if (!(S.forening || {}).stiftelsesaar || !(S.forening || {}).opfoerelsesaar) nkd.push('Stiftelsesår/opførelsesår mangler (felt D1/D2).');
  push({ id: 'nk', titel: 'Nøgleoplysninger (bekendtgørelse nr. 336/2025, bilag 1) er udfyldt', forklaring: 'Felterne B1–B6, C1–C3, D1–D2, E1–E2, F1–F4, G1–G3, H1–H3, J, K1–K3, M1–M3 og R skal fremgå af noterne.', status: nkd.length ? 'advarsel' : 'ok', detaljer: nkd });

  // 12. Stamdata og underskrifter
  const sd = [];
  const F = S.forening || {}, L = S.ledelse || {};
  if (!F.navn) sd.push('Foreningens navn mangler.');
  if (!F.cvr) sd.push('CVR-nr. mangler.');
  if (!(L.bestyrelse || []).some(b => b.navn)) sd.push('Ingen bestyrelsesmedlemmer angivet.');
  if (!(L.bilagskontrolloerer || []).some(b => b.navn)) sd.push('Ingen bilagskontrollører angivet.');
  if (!L.datoPaategning) sd.push('Dato for bestyrelsens påtegning mangler.');
  if (!L.datoGeneralforsamling) sd.push('Dato for generalforsamlingen mangler.');
  if (!L.dirigent) sd.push('Dirigent mangler.');
  push({ id: 'stam', titel: 'Stamdata, påtegning og underskrifter', forklaring: 'Årsrapporten skal underskrives af bestyrelsen og dirigenten og forsynes med datoer.', status: sd.length ? 'advarsel' : 'ok', detaljer: sd });

  // 13. Budget
  push({ id: 'budget', titel: `Budget ${y + 1} er udfyldt`, forklaring: `Budgetteret resultat ${fmtKr(g('bud.res.resultat'))}; heraf afdrag ${fmtKr(g('bud.disp.afdrag'))} og restandel ${fmtKr(g('bud.disp.rest'))}.`, status: g('bud.res.indtaegter') === 0 ? 'advarsel' : (g('bud.disp.rest') < 0 ? 'info' : 'ok'), detaljer: g('bud.res.indtaegter') === 0 ? ['Der er ikke indtastet budget.'] : (g('bud.disp.rest') < 0 ? ['Budgettet dækker ikke afdragene – boligafgiften er muligvis for lav.'] : []) });

  const antal = { ok: 0, fejl: 0, advarsel: 0, info: 0 };
  out.forEach(c => antal[c.status]++);
  const balancerer = out.filter(c => c.status === 'fejl').length === 0;
  return { kontroller: out, antal, balancerer };
}
