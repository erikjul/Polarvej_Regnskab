// vurdering.js – automatisk vurdering af regnskabets robusthed til andelshaverne.
// Hvert punkt har en kategori: 'styrke' (grøn), 'opmaerksomhed' (gul) eller 'advarsel' (rød).
// Grænseværdierne er inspireret af ABF's og Erhvervsstyrelsens nøgletal for andelsboligforeninger
// og kan justeres i GRAENSER. Vurderingen erstatter ikke bestyrelsens eller revisors vurdering.
import { fmtKr, fmtInt, fmtPct } from './format.js';
import { boligafgiftOversigt } from './boligafgift.js';
import { restloebetid } from './betalingsplan.js';

export const GRAENSER = {
  belaaningGul: 50, belaaningRoed: 80,            // gæld i % af ejendommens regnskabsmæssige værdi
  gaeldPrM2Gul: 5000, gaeldPrM2Roed: 15000,        // (gæld − omsætningsaktiver) pr. m²
  likviditetMdrGul: 6, likviditetMdrRoed: 3,       // likvide beholdninger i måneders drifts- og finansomkostninger
  ydelseAndelGul: 40, ydelseAndelRoed: 60,         // låneydelser i % af boligafgiften
  vedligeholdPrM2Gul: 50,                          // gennemsnitlig vedligeholdelse pr. m² de sidste 3 år
  andelsvaerdiBufferGul: 5,                        // vedtaget andelsværdi i % under den beregnede maksimale
  vurderingAlderGul: 4,                            // år siden ejendomsvurderingen
};

const pct = (a, b) => (b ? (a / b) * 100 : 0);

export function vurdering(engine, ctx = {}) {
  const S = engine.state;
  const y = S.aar;
  const g = (id) => (engine.has(id) ? engine.get(id) : 0);
  const p = [];
  const add = (kategori, titel, tekst) => p.push({ kategori, titel, tekst });
  const G = GRAENSER;

  // 1. Afstemning og datagrundlag
  const k = ctx.kontrol;
  if (k) {
    if (k.antal.fejl === 0) add('styrke', 'Regnskabet er afstemt', `Balancen balancerer, likvide beholdninger er afstemt til pengeinstituttets kontoudtog, og prioritetsgælden følger kreditforeningens betalingsplan. Alle ${k.kontroller.length} kontroller er gennemført uden fejl.`);
    else add('advarsel', 'Regnskabet indeholder uafstemte poster', `${k.antal.fejl} kontrol(ler) fejler: ${k.kontroller.filter(c => c.status === 'fejl').map(c => c.titel).join('; ')}. Tallene bør ikke lægges til grund, før differencerne er fundet.`);
  }

  // 2. Soliditet og belåning
  const ejendom = g('ejendom.bogfoert.ultimo'), gaeld = g('bal.gaeld.ultimo'), aktiver = g('bal.aktiver.ultimo'), ek = g('ek.total.ultimo');
  const belaaning = pct(gaeld, ejendom);
  const soliditet = pct(ek, aktiver);
  const belText = `Gældsforpligtelser ${fmtKr(gaeld, 0)} kr. svarer til ${fmtPct(belaaning)} af ejendommens regnskabsmæssige værdi (${fmtKr(ejendom, 0)} kr.). Egenkapitalen udgør ${fmtPct(soliditet)} af aktiverne.`;
  if (belaaning > G.belaaningRoed) add('advarsel', 'Meget høj belåning', belText + ' En belåning over ' + G.belaaningRoed + ' % gør foreningen sårbar over for fald i ejendomsværdien og rentestigninger.');
  else if (belaaning > G.belaaningGul) add('opmaerksomhed', 'Høj belåning', belText);
  else add('styrke', 'Lav belåning og høj soliditet', belText);

  // 3. Gæld pr. m² (nøgletal K2)
  const bolig = g('nk.areal.y0.bolig');
  const nettogaeldM2 = bolig ? (gaeld - g('bal.omsaetning.ultimo')) / bolig : 0;
  if (bolig) {
    const t = `Gæld fratrukket omsætningsaktiver udgør ${fmtInt(nettogaeldM2)} kr. pr. m² (nøgletal K2). Den tekniske andelsværdi er ${fmtInt(g('nk.k3'))} kr. pr. m² (K3).`;
    if (nettogaeldM2 > G.gaeldPrM2Roed) add('advarsel', 'Høj gæld pr. m²', t + ` Over ${fmtInt(G.gaeldPrM2Roed)} kr. pr. m² regnes normalt som højt for en andelsboligforening.`);
    else if (nettogaeldM2 > G.gaeldPrM2Gul) add('opmaerksomhed', 'Moderat gæld pr. m²', t);
    else add('styrke', 'Lav gæld pr. m²', t);
  }

  // 4. Likviditet
  const likvid = g('likvid.total.ultimo');
  const depositum = g('ag.total.ultimo');
  const fri = likvid - depositum; // deponerede midler er ikke frie
  const aarsomk = -(g('res.omkostninger') + g('res.fin')) + g('laan.total.afdrag');
  const mdr = aarsomk > 0 ? fri / (aarsomk / 12) : 99;
  const naesteAar = g('laan.total.kortfristet') + Math.abs(g('laan.total.renter'));
  const lt = `Frie likvide beholdninger ${fmtKr(fri, 0)} kr. (ekskl. deponeret depositum ${fmtKr(depositum, 0)} kr.) svarer til ${fmtKr(mdr, 1)} måneders drifts-, finans- og afdragsudgifter. Næste års låneydelser udgør ${fmtKr(naesteAar, 0)} kr.`;
  if (mdr < G.likviditetMdrRoed) add('advarsel', 'Lav likviditet', lt + ' Under ' + G.likviditetMdrRoed + ' måneders dækning betyder, at en uforudset udgift kan kræve ekstraordinær opkrævning.');
  else if (mdr < G.likviditetMdrGul) add('opmaerksomhed', 'Begrænset likviditet', lt);
  else add('styrke', 'Solid likviditet', lt);

  // 5. Dækker boligafgiften drift og afdrag?
  const resultat = g('res.resultat'), rest = g('disp.rest'), afdrag = g('laan.total.afdrag');
  const rt = `Årets resultat er ${fmtKr(resultat, 0)} kr. Efter betalte afdrag på ${fmtKr(afdrag, 0)} kr. er der ${fmtKr(rest, 0)} kr. tilbage${rest >= 0 ? ' til opsparing' : ', som er taget af likviditeten'}.`;
  if (resultat < 0) add('advarsel', 'Underskud på driften', rt + ' Boligafgiften dækker ikke foreningens løbende omkostninger.');
  else if (rest < 0) add('opmaerksomhed', 'Boligafgiften dækker ikke fuldt ud afdragene', rt + ' Det er ikke akut, men over tid udhules likviditeten, medmindre boligafgiften eller indtægterne øges.');
  else add('styrke', 'Boligafgiften dækker drift og afdrag', rt);

  // 6. Låneydelsernes andel af boligafgiften
  const boligafgift = g('n1.total');
  const ydelser = g('laan.total.ydelser');
  const ya = pct(ydelser, boligafgift);
  if (boligafgift > 0 && ydelser > 0) {
    const t = `Låneydelser (renter, bidrag og afdrag) på ${fmtKr(ydelser, 0)} kr. udgør ${fmtPct(ya)} af boligafgiften på ${fmtKr(boligafgift, 0)} kr.`;
    if (ya > G.ydelseAndelRoed) add('advarsel', 'Låneydelser fylder meget i boligafgiften', t);
    else if (ya > G.ydelseAndelGul) add('opmaerksomhed', 'Låneydelser fylder en del i boligafgiften', t);
    else add('styrke', 'Låneydelserne er en lille del af boligafgiften', t);
  }

  // 7. Lånetype og rentebinding
  (S.laan || []).forEach(l => {
    if (engine.harPlan(l)) {
      const rl = restloebetid(l.betalingsplan, y);
      add('styrke', `Prioritetslånet er fastforrentet med afdrag`, `${l.navn}: restgæld ${fmtKr(g(`laan.${l.id}.restgaeldUltimo`), 0)} kr., fast ydelse efter kreditforeningens betalingsplan, restløbetid ${fmtKr(rl, 2)} år. Ingen rentetilpasning eller afdragsfrihed, så ydelsen er kendt for hele løbetiden.`);
    } else if (g(`laan.${l.id}.restgaeldUltimo`) > 0) {
      add('opmaerksomhed', `Lånevilkår bør oplyses`, `${l.navn}: restgæld ${fmtKr(g(`laan.${l.id}.restgaeldUltimo`), 0)} kr. Der er ikke indlæst en betalingsplan, så rentebinding, afdragsprofil og restløbetid fremgår ikke af regnskabet.`);
    }
  });

  // 8. Vedligeholdelse og henlæggelser
  const m3 = [g('nk.m3.y2'), g('nk.m3.y1'), g('nk.m3.y0')];
  const mAvg = m3.reduce((a, b) => a + b, 0) / 3;
  const reserver = g('ek.reserver.ultimo');
  const opf = Number((S.forening || {}).opfoerelsesaar) || 0;
  const alder = opf ? y - opf : 0;
  const vt = `Vedligeholdelse har de sidste tre år udgjort ${m3.map(v => fmtInt(v)).join(', ')} kr. pr. m² (gennemsnit ${fmtInt(mAvg)} kr. pr. m²). Generalforsamlingsbestemte reserver til vedligeholdelse udgør ${fmtKr(reserver, 0)} kr.${alder ? ` Ejendommen er ${alder} år gammel.` : ''}`;
  if (mAvg < G.vedligeholdPrM2Gul && reserver <= 0) add('opmaerksomhed', 'Lav vedligeholdelse og ingen henlæggelser', vt + ' Andelshaverne bør sikre sig, at der findes en vedligeholdelsesplan, og at større arbejder (tag, vinduer, installationer) kan finansieres uden pludselige stigninger i boligafgiften.');
  else add('styrke', 'Vedligeholdelse og henlæggelser', vt);

  // 9. Andelsværdi: lovlighed og buffer
  const maks = g('av.prKrone'), vedtaget = g('av.senest');
  if (maks > 0 && vedtaget > 0) {
    const buffer = pct(maks - vedtaget, maks);
    const at = `Den beregnede maksimale andelsværdi er ${fmtKr(maks)} kr. pr. andelskrone (${fmtInt(g('av.prAndel'))} kr. pr. andel); den senest vedtagne er ${fmtKr(vedtaget)} (${fmtInt(g('av.senestPrAndel'))} kr. pr. andel).`;
    if (vedtaget > maks + 0.005) add('advarsel', 'Den vedtagne andelsværdi overstiger det lovlige maksimum', at + ' Andelsværdien skal nedsættes, jf. andelsboligforeningslovens § 5. Handler til den vedtagne pris kan være ulovlige.');
    else if (buffer < G.andelsvaerdiBufferGul) add('opmaerksomhed', 'Lille buffer i andelsværdien', at + ` Bufferen er kun ${fmtPct(buffer)}: et fald i ejendomsvurderingen på mere end det tvinger andelsværdien ned.`);
    else add('styrke', 'Andelsværdien er lovlig med god margin', at + ` Bufferen til det lovlige maksimum er ${fmtPct(buffer)}.`);
  }

  // 10. Vurderingsgrundlag
  const E = S.ejendom || {};
  const vm = /(\d{4})/.exec(E.vurderingTekst || '');
  const vAar = vm ? Number(vm[1]) : 0;
  if (E.vurderingsprincip === 'offentlig' || E.vurderingsprincip === 'indekseret') {
    const t = `Ejendommen er værdiansat efter den offentlige ejendomsvurdering (${fmtKr(g('ejendom.vurdering'), 0)} kr.${E.vurderingTekst ? ', ' + E.vurderingTekst : ''}).`;
    if (vAar && y - vAar > G.vurderingAlderGul) add('opmaerksomhed', 'Ejendomsvurderingen er gammel', t + ` Vurderingen er ${y - vAar} år gammel. En ny offentlig vurdering eller en valuarvurdering kan ændre andelsværdien væsentligt i begge retninger.`);
    else add('styrke', 'Forsigtigt vurderingsprincip', t + ' Den offentlige vurdering er typisk mere konservativ end en valuarvurdering.');
  } else if (E.vurderingsprincip === 'valuar') add('opmaerksomhed', 'Valuarvurdering', `Ejendommen er værdiansat efter en valuarvurdering (${fmtKr(g('ejendom.vurdering'), 0)} kr.). Valuarvurderinger kan svinge og er højst 42 måneder gyldige; andelsværdien afhænger direkte af den.`);

  // 11. Restancer på boligafgift
  if (ctx.samling && (S.andelshavere || []).length) {
    const ov = boligafgiftOversigt(ctx.samling, S.andelshavere, `${y}-12`);
    const restancer = ov.andele.filter(r => r.saldo < -0.5);
    const sum = restancer.reduce((a, r) => a + r.saldo, 0);
    if (restancer.length) add(-sum > (Number(restancer[0].andel.afgift) || 0) * 3 ? 'advarsel' : 'opmaerksomhed', 'Restancer på boligafgift', `${restancer.length} andel(e) skylder i alt ${fmtKr(-sum, 0)} kr. pr. 31/12 ${y} (${restancer.map(r => r.andel.adresse + ' ' + fmtKr(-r.saldo, 0)).join(', ')}). Restancer belaster likviditeten og bør inddrives.`);
    else add('styrke', 'Ingen restancer på boligafgift', `Alle ${ov.andele.length} andele har betalt boligafgiften til tiden pr. 31/12 ${y}.`);
  }

  // 12. Struktur: få andele, hæftelse, tilskud
  const antal = g('andele.antal');
  if (antal && antal <= 12) add('opmaerksomhed', 'Lille forening', `Foreningen har ${fmtInt(antal)} andele. Hver andel bærer ${fmtPct(100 / antal)} af boligafgiften, så én restance eller én tom bolig mærkes straks i likviditeten, og større vedligeholdelsesarbejder fordeles på få andelshavere.`);
  const N = S.noegle || {};
  if (N.haefter) add('opmaerksomhed', 'Personlig hæftelse', 'Andelshaverne hæfter for mere end deres indskud (nøgleoplysning E1).');
  else add('styrke', 'Begrænset hæftelse', 'Andelshaverne hæfter ikke for mere end deres indskud (nøgleoplysning E1).');
  if (N.g1) add('opmaerksomhed', 'Offentligt tilskud med tilbagebetalingspligt', (S.tekster || {}).eventualforpligtelser ? 'Foreningen har modtaget offentlig ydelsesstøtte, som kan kræves tilbagebetalt ved foreningens opløsning (se eventualforpligtelser). Det har ingen betydning i den løbende drift, men betyder, at foreningen ikke kan opløses uden at afregne støtten.' : 'Foreningen har modtaget offentligt tilskud, som skal tilbagebetales ved opløsning (nøgleoplysning G1).');

  // 13. Budget
  const budRest = g('bud.disp.rest'), budRes = g('bud.res.resultat');
  if (g('bud.res.indtaegter') > 0) {
    const bt = `Budgettet for ${y + 1} viser et resultat på ${fmtKr(budRes, 0)} kr. og ${fmtKr(budRest, 0)} kr. efter afdrag på ${fmtKr(g('bud.disp.afdrag'), 0)} kr.`;
    if (budRes < 0) add('advarsel', 'Budgettet viser underskud', bt);
    else if (budRest < 0) add('opmaerksomhed', 'Budgettet dækker ikke afdragene fuldt ud', bt + ' Overvej en regulering af boligafgiften.');
    else add('styrke', 'Budgettet hænger sammen', bt);
  }

  const advarsler = p.filter(x => x.kategori === 'advarsel').length;
  const opm = p.filter(x => x.kategori === 'opmaerksomhed').length;
  let niveau, tekst;
  if (advarsler) { niveau = 'advarsel'; tekst = `Regnskabet indeholder ${advarsler} advarselstegn, som andelshaverne bør forholde sig til, før de lægger tallene til grund.`; }
  else if (opm > 3) { niveau = 'opmaerksomhed'; tekst = `Regnskabet er robust på de centrale punkter, men der er ${opm} opmærksomhedspunkter, som bestyrelsen bør følge op på.`; }
  else { niveau = 'styrke'; tekst = `Regnskabet er robust: lav belåning, solid likviditet, kendte låneydelser og afstemte tal. ${opm ? opm + ' opmærksomhedspunkt(er) er anført nedenfor.' : ''}`; }
  return { niveau, tekst, punkter: p, antal: { styrke: p.length - advarsler - opm, opmaerksomhed: opm, advarsel: advarsler } };
}
