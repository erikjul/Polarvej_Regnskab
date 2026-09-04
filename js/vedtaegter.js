// vedtaegter.js – automatisk tjek af regnskabet mod foreningens vedtægter (Polarvejens Andelsboligforening I).
// Paragrafhenvisningerne følger vedtægterne som ændret 25. marts 2019.
import { fmtKr } from './format.js';

const dage = (a, b) => (new Date(b) - new Date(a)) / 86400000;

export function vedtaegtstjek(engine, ctx = {}) {
  const S = engine.state;
  const y = S.aar;
  const g = (id) => (engine.has(id) ? engine.get(id) : 0);
  const L = S.ledelse || {};
  const ud = [];
  const add = (status, paragraf, titel, tekst) => ud.push({ status, paragraf, titel, tekst });

  // § 30, stk. 1: regnskabsår = kalenderår, hele bestyrelsen underskriver
  add('ok', '§ 30, stk. 1', 'Regnskabsåret følger kalenderåret', `Årsrapporten dækker 1. januar – 31. december ${y}.`);
  const best = (L.bestyrelse || []).filter(b => b.navn);
  const harFormand = best.some(b => /formand/i.test(b.titel || '') && !/næst/i.test(b.titel || ''));
  const harKasserer = best.some(b => /kasserer/i.test(b.titel || ''));
  if (best.length < 3) add('fejl', '§ 26, stk. 1', 'Bestyrelsen skal bestå af formand og mindst 2 medlemmer', `Påtegningen har ${best.length} underskrivere.`);
  else if (!harFormand || !harKasserer) add('advarsel', '§ 28', 'Formand og kasserer skal fremgå af påtegningen', `Foreningen tegnes af formand og kasserer. ${harFormand ? '' : 'Ingen er angivet som formand. '}${harKasserer ? '' : 'Ingen er angivet som kasserer.'}`);
  else add('ok', '§ 26 og § 28', 'Hele bestyrelsen underskriver', `${best.length} bestyrelsesmedlemmer, herunder formand og kasserer, er anført i påtegningen.`);

  // § 31: bilagskontrollører uvildige
  const bk = (L.bilagskontrolloerer || []).filter(b => b.navn);
  const bestNavne = best.map(b => b.navn.trim().toLowerCase());
  const overlap = bk.filter(b => bestNavne.includes(b.navn.trim().toLowerCase()));
  if (!bk.length) add('advarsel', '§ 31, stk. 1', 'Ingen bilagskontrollører eller revisor angivet', 'Årsrapporten skal revideres af revisor eller kontrolleres af uvildige bilagskontrollører valgt på generalforsamlingen.');
  else if (overlap.length) add('fejl', '§ 31, stk. 1', 'Bilagskontrollør sidder i bestyrelsen', `${overlap.map(b => b.navn).join(', ')} er både bilagskontrollør og bestyrelsesmedlem. Bilagskontrollører skal være uvildige andelshavere uden for bestyrelsen og ikke beslægtet med kasserer eller formand.`);
  else add('ok', '§ 31, stk. 1', 'Bilagskontrollørerne er uden for bestyrelsen', `${bk.map(b => b.navn).join(' og ')}. Bestyrelsen bekræfter, at de ikke er beslægtet med kasserer eller formand.`);

  // § 21, stk. 2 og § 22/§ 31, stk. 2: generalforsamling og frister
  if (L.datoGeneralforsamling) {
    const frist = `${y + 1}-04-30`;
    if (L.datoGeneralforsamling > frist) add('fejl', '§ 21, stk. 2', 'Generalforsamlingen er afholdt for sent', `Ordinær generalforsamling skal afholdes inden 4 måneder efter regnskabsårets udløb (senest 30. april ${y + 1}); den er sat til ${L.datoGeneralforsamling}.`);
    else add('ok', '§ 21, stk. 2', 'Generalforsamling inden 4 måneder efter regnskabsårets udløb', `Generalforsamling ${L.datoGeneralforsamling}, frist 30. april ${y + 1}.`);
    if (L.datoPaategning) {
      const d = dage(L.datoPaategning, L.datoGeneralforsamling);
      if (d < 14) add('advarsel', '§ 22, stk. 1 og § 31, stk. 2', 'Årsrapporten er underskrevet mindre end 14 dage før generalforsamlingen', `Den underskrevne årsrapport og budgettet skal udsendes sammen med indkaldelsen, der har 14 dages varsel. Påtegning ${L.datoPaategning}, generalforsamling ${L.datoGeneralforsamling} (${Math.round(d)} dage).`);
      else add('ok', '§ 22, stk. 1 og § 31, stk. 2', 'Årsrapporten kan udsendes med indkaldelsen', `Påtegning ${L.datoPaategning}, ${Math.round(d)} dage før generalforsamlingen.`);
    }
    if (L.datoBilagskontrol && L.datoPaategning && L.datoBilagskontrol < L.datoPaategning) add('advarsel', '§ 31', 'Bilagskontrollen er dateret før bestyrelsens påtegning', 'Bilagskontrollørerne bør erklære sig om den årsrapport, bestyrelsen har aflagt, dvs. samme dag eller senere.');
  } else add('advarsel', '§ 21, stk. 2', 'Dato for generalforsamlingen mangler', `Ordinær generalforsamling skal afholdes senest 30. april ${y + 1}.`);

  // § 4: indskud
  if (Math.abs(g('andele.indskud') - 85800) > 0.5) add('advarsel', '§ 4, stk. 1', 'Indskud pr. andel afviger fra vedtægterne', `Vedtægterne fastsætter 85.800 kr. pr. fordelingstal; regnskabet bruger ${fmtKr(g('andele.indskud'), 0)} kr.`);
  else add('ok', '§ 4, stk. 1', 'Indskud 85.800 kr. pr. andel', `Andelsindskud ${fmtKr(g('ek.indskud.ultimo'), 0)} kr. = ${fmtKr(g('andele.antal'), 0)} andele × 85.800 kr.`);

  // § 6, stk. 1 og § 8, stk. 2: fordelingstal = indskud
  const N = S.noegle || {};
  if ((S.andele || {}).fordelingstalType !== 'indskud' || N.fordelingstalAndelsvaerdi !== 'indskud' || N.fordelingstalBoligafgift !== 'indskud') add('fejl', '§ 6, stk. 1 og § 8, stk. 2', 'Fordelingstal skal være indskuddet', 'Andel i formuen og boligafgift fordeles efter indskud. Kontrollér fordelingstal under Primo & lån og Nøgleoplysninger (C1/C2).');
  else add('ok', '§ 6, stk. 1 og § 8, stk. 2', 'Fordelingstal er det oprindelige indskud', 'Andelsværdi pr. andelskrone og boligafgift fordeles efter indskud (nøgleoplysning C1 og C2).');

  // § 14, stk. 1 a / § 30, stk. 2: andelsværdi ≤ maksimum, forslag som note
  if (g('av.senest') > g('av.prKrone') + 0.005) add('fejl', '§ 14, stk. 1, litra a', 'Vedtaget andelsværdi overstiger det lovlige maksimum', `Vedtaget ${fmtKr(g('av.senest'))} mod beregnet maksimum ${fmtKr(g('av.prKrone'))} kr. pr. andelskrone. Bestyrelsen skal nedsætte værdien.`);
  else add('ok', '§ 14, stk. 1, litra a og § 30, stk. 2', 'Bestyrelsens forslag til andelsværdi er anført som note', `Beregnet maksimum ${fmtKr(g('av.prKrone'))} kr. pr. andelskrone; senest vedtaget ${fmtKr(g('av.senest'))}. Reserver indgår ikke i beregningen.`);

  // § 6, stk. 1 / § 14: kvadratmeterpris må ikke give en højere pris end værdien efter indskud
  const medAreal = (S.andelshavere || []).filter(a => Number(a.areal) > 0);
  if (medAreal.length) {
    const over = medAreal.filter(a => g(`andel.${a.id}.vaerdiM2`) > g('av.prAndel') * 1.005);
    const sumAreal = medAreal.reduce((t, a) => t + Number(a.areal), 0);
    if (over.length) add('advarsel', '§ 6, stk. 1 og § 14, stk. 1', 'Kvadratmeterprisen giver en højere pris end værdien efter indskud', `${over.map(a => a.adresse).join(', ')}: areal × kr./m² overstiger den maksimale værdi pr. andel efter indskud (${fmtKr(g('av.prAndel'), 0)} kr.). Den maksimale pris følger indskuddet; kvadratmeterprisen kan kun bruges til formidling, hvis den ikke overstiger denne.`);
    else add('ok', '§ 6, stk. 1 og § 14, stk. 1', 'Kvadratmeterprisen giver ikke højere priser end værdien efter indskud', `${medAreal.length} boliger, ${fmtKr(sumAreal, 0)} m² i alt; kvadratmeterpris ${fmtKr(g('av.prM2'), 0)} kr./m².`);
  }

  // § 30, stk. 3: henlæggelsesfond hvert år
  const henl = g('disp.vedligehold') + g('disp.genopretning') + g('disp.andre');
  const budHenl = g('bud.disp.vedligehold');
  const begr = ((S.tekster || {}).vedligeholdBegrundelse || '').trim();
  if (henl > 0) add('ok', '§ 30, stk. 3', 'Der henlægges til fonden i året', `Henlagt ${fmtKr(henl, 0)} kr. ifølge resultatdisponeringen; reserver i alt ${fmtKr(g('ek.reserver.ultimo'), 0)} kr. holdes uden for andelsværdien.`);
  else if (begr) add('advarsel', '§ 30, stk. 3', 'Henlæggelse til fonden er 0 kr. – begrundelsen fremgår af regnskabet', `Vedtægterne kræver, at generalforsamlingen hvert år fastsætter et beløb til henlæggelse, og at posten vises i budget og balance. Beløbet er 0 kr.${budHenl > 0 ? ` Budgettet for ${y + 1} henlægger ${fmtKr(budHenl, 0)} kr.` : ` Budgettet for ${y + 1} henlægger heller ikke.`} Generalforsamlingens beslutning bør fremgå af referatet.`);
  else add('fejl', '§ 30, stk. 3', 'Henlæggelse til fonden mangler uden begrundelse', 'Vedtægterne kræver hvert år et beløb til henlæggelse som særlig post i budget og balance, fastsat af generalforsamlingen. Skriv generalforsamlingens beslutning og begrundelse under Tekster ("Henlæggelser til vedligeholdelse").');

  // § 11, stk. 2, litra h: fremlejedepositum
  const depo = g('ag.total.ultimo');
  const antalFremleje = Number((S.fremleje || {}).antal) || 0;
  if (antalFremleje > 0) {
    if (Math.abs(depo - antalFremleje * 20000) > 0.5) add('advarsel', '§ 11, stk. 2, litra h', 'Fremlejedepositum stemmer ikke med antal fremlejede boliger', `${antalFremleje} fremlejet(e) bolig(er) kræver ${fmtKr(antalFremleje * 20000, 0)} kr. i depositum på lukket konto; anden gæld viser ${fmtKr(depo, 0)} kr.`);
    else add('ok', '§ 11, stk. 2, litra h', 'Fremlejedepositum er hensat', `${antalFremleje} fremlejet(e) bolig(er), depositum ${fmtKr(depo, 0)} kr. på deponeringskonto.`);
  }

  // § 29, stk. 3: kassebeholdning
  const kasse = (S.likvidkonti || []).filter(k => /kontant|kasse/i.test(k.navn)).reduce((s, k) => s + g(`likvid.${k.id}.ultimo`), 0);
  if (kasse > 5000) add('advarsel', '§ 29, stk. 3', 'Stor kontantbeholdning', `Kontanter ${fmtKr(kasse, 0)} kr. Foreningens midler skal stå på en særskilt konto i et pengeinstitut bortset fra en mindre kassebeholdning.`);
  else add('ok', '§ 29, stk. 3', 'Midlerne står i pengeinstitut', `Kontantbeholdning ${fmtKr(kasse, 0)} kr.; øvrige midler på foreningens konti.`);

  // § 29, stk. 5: forsikringssum i note
  const F = S.forsikring || {};
  if (!(Number(F.bestyrelsesansvar) > 0)) add('fejl', '§ 29, stk. 5', 'Forsikringssum for bestyrelsesansvar mangler i noten', 'Foreningen skal tegne bestyrelsesansvars- og besvigelsesforsikring, og forsikringssummen skal oplyses i en note. Indtast under Stamdata → Forsikringer, eller oplys i noten, at forsikringen ikke er tegnet.');
  else add('ok', '§ 29, stk. 5', 'Forsikringssum er oplyst i noten', `Bestyrelsesansvar ${fmtKr(F.bestyrelsesansvar, 0)} kr.${Number(F.besvigelse) > 0 ? `, besvigelse ${fmtKr(F.besvigelse, 0)} kr.` : ''}${F.selskab ? ' (' + F.selskab + ')' : ''}.`);

  // § 5, stk. 2: hæftelse
  if (N.haefter) add('ok', '§ 5, stk. 2', 'Personlig hæftelse er oplyst', 'Nøgleoplysning E1 angiver, at andelshaverne hæfter for mere end indskuddet.');
  else add('info', '§ 5, stk. 1–2', 'Hæftelse begrænset til indskud (E1: nej)', 'Forudsætter, at DLR Kredit ikke har taget forbehold om personlig pro rata-hæftelse i lånedokumenterne. Bestyrelsen bør bekræfte det.');

  // § 8, stk. 4: boligafgift forud – restancer
  if (ctx.restancer !== undefined) {
    if (ctx.restancer > 0.5) add('advarsel', '§ 8, stk. 4', 'Restancer på boligafgift', `Boligafgift skal betales forud den første hverdag i måneden. Restancer pr. 31/12 ${y}: ${fmtKr(ctx.restancer, 0)} kr. Der kan opkræves gebyr på 10 %.`);
    else add('ok', '§ 8, stk. 4', 'Boligafgiften er betalt', `Ingen restancer pr. 31/12 ${y}.`);
  }

  const antal = { ok: 0, fejl: 0, advarsel: 0, info: 0 };
  ud.forEach(x => antal[x.status]++);
  return { punkter: ud, antal };
}
