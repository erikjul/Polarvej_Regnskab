// model.js – datamodel, faste regnskabslinjer, standardkontoplan og standardtekster.

// Resultatopgørelsens noter og linjer (fast opstilling, jf. Erhvervsstyrelsens modelregnskab for andelsboligforeninger)
export const NOTER_RESULTAT = [
  { nr: 1, id: 'n1', titel: 'Boligafgift og lejeindtægter', art: 'indtaegt', linjer: [
    { id: 'n1.boligafgift', label: 'Boligafgift' },
    { id: 'n1.boligleje', label: 'Boliglejeindtægter' },
    { id: 'n1.erhvervsleje', label: 'Erhvervslejeindtægter' },
    { id: 'n1.oevrig', label: 'Øvrige lejeindtægter (garager, kældre m.v.)' },
  ]},
  { nr: 2, id: 'n2', titel: 'Øvrige indtægter', art: 'indtaegt', linjer: [
    { id: 'n2.bonus', label: 'Forsikringsbonus' },
    { id: 'n2.uforudset', label: 'Uforudsete indtægter' },
    { id: 'n2.andelshandel', label: 'Gebyrer ved handel med andelsboliger' },
    { id: 'n2.rente', label: 'Renteindtægter, pengeinstitut' },
    { id: 'n2.andet', label: 'Andre indtægter' },
  ]},
  { nr: 3, id: 'n3', titel: 'Ejendomsskat og forsikringer', art: 'omkostning', linjer: [
    { id: 'n3.ejendomsskat', label: 'Ejendomsskat (grundskyld)' },
    { id: 'n3.renovation', label: 'Renovation, rottebekæmpelse m.v.' },
    { id: 'n3.forsikring', label: 'Forsikringer' },
    { id: 'n3.andet', label: 'Øvrige ejendomsomkostninger' },
  ]},
  { nr: 4, id: 'n4', titel: 'Vedligeholdelse', art: 'omkostning', linjer: [
    { id: 'n4.loebende', label: 'Vedligeholdelse, løbende' },
    { id: 'n4.genopretning', label: 'Vedligeholdelse, genopretning og renovering' },
  ]},
  { nr: 5, id: 'n5', titel: 'Administrationsomkostninger', art: 'omkostning', linjer: [
    { id: 'n5.revisor', label: 'Revisor / regnskabsassistance' },
    { id: 'n5.administrator', label: 'Administrator' },
    { id: 'n5.gebyrbank', label: 'Gebyrer, pengeinstitut' },
    { id: 'n5.gebyrkredit', label: 'Gebyrer, realkreditinstitut' },
    { id: 'n5.generalforsamling', label: 'Generalforsamling og møder' },
    { id: 'n5.andelshandel', label: 'Omkostninger ved handel med andelsboliger' },
    { id: 'n5.diverse', label: 'Diverse omkostninger' },
  ]},
  { nr: 6, id: 'n6', titel: 'Øvrige foreningsomkostninger', art: 'omkostning', linjer: [
    { id: 'n6.honorar', label: 'Bestyrelseshonorar' },
    { id: 'n6.abf', label: 'Kontingent, ABF' },
    { id: 'n6.grundejer', label: 'Kontingent, grundejerforening' },
    { id: 'n6.andet', label: 'Andre foreningsomkostninger' },
  ]},
  { nr: 7, id: 'n7', titel: 'Finansielle omkostninger', art: 'finans', linjer: [
    { id: 'n7.renter', label: 'Prioritetsrenter og bidrag', laan: true },
    { id: 'n7.kurstab', label: 'Kurstab og kurtage' },
    { id: 'n7.laaneomk', label: 'Stiftelsesprovision og lånesagsgebyrer' },
    { id: 'n7.tinglysning', label: 'Tinglysningsafgift' },
    { id: 'n7.andet', label: 'Øvrige finansielle omkostninger' },
  ]},
];

export const ALLE_LINJER = NOTER_RESULTAT.flatMap(n => n.linjer.map(l => ({ ...l, note: n.nr, noteId: n.id, art: n.art })));
export const LINJE_BY_ID = Object.fromEntries(ALLE_LINJER.map(l => [l.id, l]));

// Balanceposter som en konto kan pege på (ud over resultatlinjerne)
export function balanceMappings(state) {
  const m = [
    { id: 'bal.ejendom', label: 'Balance: Ejendom, forbedringer (tilgang til kostpris)' },
    { id: 'bal.indskud', label: 'Balance: Andelsindskud (nye andele / indskud)' },
    { id: 'bal.forud', label: 'Balance: Forudmodtaget boligafgift' },
    { id: 'bal.overfoersel', label: 'Balance: Overførsel mellem likvide konti (neutral)' },
  ];
  (state.laan || []).forEach(l => m.push({ id: 'laan:' + l.id, label: 'Lån: ydelse (renter + afdrag) – ' + l.navn }));
  (state.andenGaeld || []).forEach(a => m.push({ id: 'ag:' + a.id, label: 'Anden gæld: ' + a.tekst }));
  (state.tilgodehavender || []).forEach(t => m.push({ id: 'tg:' + t.id, label: 'Tilgodehavende: ' + t.tekst }));
  return m;
}

export function alleMappings(state) {
  return [
    ...ALLE_LINJER.map(l => ({ id: l.id, label: 'Note ' + l.note + ': ' + l.label })),
    ...balanceMappings(state),
  ];
}

let idCounter = 0;
export function nyId(prefix = 'x') {
  idCounter++;
  return prefix + Date.now().toString(36) + idCounter.toString(36);
}

export const STANDARD_KONTOPLAN = [
  { nr: 10, navn: 'Boligafgift / husleje', linje: 'n1.boligafgift' },
  { nr: 20, navn: 'Forsikringsbonus', linje: 'n2.bonus' },
  { nr: 30, navn: 'Gebyr ved andelshandel (indtægt)', linje: 'n2.andelshandel' },
  { nr: 40, navn: 'Uforudsete indtægter', linje: 'n2.uforudset' },
  { nr: 45, navn: 'Renteindtægter, bank', linje: 'n2.rente' },
  { nr: 50, navn: 'Diverse omkostninger', linje: 'n5.diverse' },
  { nr: 90, navn: 'Ejendomsskat', linje: 'n3.ejendomsskat' },
  { nr: 95, navn: 'Renovation og rottebekæmpelse', linje: 'n3.renovation' },
  { nr: 100, navn: 'Forsikring', linje: 'n3.forsikring' },
  { nr: 105, navn: 'Vedligeholdelse, løbende', linje: 'n4.loebende' },
  { nr: 106, navn: 'Vedligeholdelse, genopretning/renovering', linje: 'n4.genopretning' },
  { nr: 110, navn: 'Grundejerforening', linje: 'n6.grundejer' },
  { nr: 130, navn: 'ABF kontingent', linje: 'n6.abf' },
  { nr: 140, navn: 'Bestyrelseshonorar', linje: 'n6.honorar' },
  { nr: 150, navn: 'Generalforsamling og møder', linje: 'n5.generalforsamling' },
  { nr: 160, navn: 'Revisor', linje: 'n5.revisor' },
  { nr: 170, navn: 'Gebyrer, bank', linje: 'n5.gebyrbank' },
  { nr: 180, navn: 'Gebyrer, realkredit', linje: 'n5.gebyrkredit' },
  { nr: 190, navn: 'Omkostninger ved andelshandel', linje: 'n5.andelshandel' },
  { nr: 300, navn: 'Overførsel mellem konti', linje: 'bal.overfoersel' },
  { nr: 310, navn: 'Andelsindskud, nye andele', linje: 'bal.indskud' },
  { nr: 320, navn: 'Forudmodtaget boligafgift', linje: 'bal.forud' },
];

export const STANDARD_TEKSTER = {
  paategning:
`Bestyrelsen har dags dato aflagt årsrapporten for {{aar}} for {{forening.navn}}.

Årsrapporten er aflagt i overensstemmelse med årsregnskabslovens bestemmelser for regnskabsklasse A, andelsboligforeningslovens § 5, stk. 11, og § 6, stk. 2 og 8, samt foreningens vedtægter.

Vi anser den valgte regnskabspraksis for hensigtsmæssig, og efter vor opfattelse giver årsregnskabet et retvisende billede af andelsboligforeningens aktiver og passiver, finansielle stilling samt resultat.

Ingen af andelsboligforeningens aktiver er pantsat eller behæftet med ejendomsforbehold ud over de anførte, og der påhviler ikke andelsboligforeningen eventualforpligtelser, som ikke fremgår af årsregnskabet.

Der er efter regnskabsårets afslutning ikke indtruffet begivenheder, der væsentligt vil kunne påvirke vurderingen af andelsboligforeningens finansielle stilling.

Årsrapporten indstilles til generalforsamlingens godkendelse.`,

  bilagskontrol:
`Undertegnede bilagskontrollører har foretaget bilagskontrol i overensstemmelse med vedtægternes § 31. Bilagskontrollen har ikke givet anledning til bemærkninger.`,

  praksis:
`Årsrapporten for {{forening.navn}} er aflagt i overensstemmelse med årsregnskabslovens bestemmelser for regnskabsklasse A, andelsboligforeningslovens § 5, stk. 11, og § 6, stk. 2 og 8, samt bekendtgørelse nr. 336 af 20. marts 2025 om oplysningspligt ved salg af andelsboliger m.v. samt om bestyrelsens pligt til at fremlægge skema over centrale nøgleoplysninger.

Formålet med årsrapporten er at give et retvisende billede af foreningens aktiviteter for regnskabsperioden og at vise, om den budgetterede og hos medlemmerne opkrævede boligafgift er tilstrækkelig.

Endvidere er formålet at give de krævede nøgleoplysninger, at give oplysning om andelenes værdi og at give oplysninger om tilbagebetalingspligt vedrørende modtaget støtte.

## Resultatopgørelsen

### Opstillingsform
Resultatopgørelsen er opstillet, så denne bedst viser andelsboligforeningens aktivitet i det forløbne regnskabsår.

### Indtægter
Boligafgift og lejeindtægt vedrørende regnskabsperioden indgår i resultatopgørelsen.

### Omkostninger
Omkostninger vedrørende regnskabsperioden indgår i resultatopgørelsen.

### Finansielle poster
Finansielle indtægter og omkostninger indregnes i resultatopgørelsen med de beløb, der vedrører regnskabsperioden. Finansielle omkostninger består af regnskabsperiodens renteomkostninger og bidrag vedrørende prioritetsgæld.

## Balancen

### Materielle anlægsaktiver
Andelsboligforeningens ejendom (grund og bygning) indregnes på anskaffelsestidspunktet og værdiansættes til kostpris.

Ved efterfølgende indregninger værdiansættes foreningens ejendom til dagsværdien på balancedagen. Opskrivninger i forhold til seneste indregning føres direkte på foreningens egenkapital på en særskilt opskrivningshenlæggelse.

Vurderes det, at ejendommens værdi på balancedagen er lavere end dagsværdi, nedskrives ejendommen til denne lavere værdi. Nedskrivningen indregnes i resultatopgørelsen.

Der afskrives ikke på andelsboligforeningens ejendom.

### Tilgodehavender
Tilgodehavender værdiansættes til nominel værdi.

### Likvide beholdninger
Likvide beholdninger omfatter indeståender i pengeinstitut samt kontantbeholdning.

### Egenkapital
Under andelsboligforeningens egenkapital indregnes medlemmernes andelsindskud.

"Overført resultat m.v." indeholder akkumuleret resultat, tillægsværdi ved nyudstedelse af andele samt resterende overførsel af årets resultat.

Under "andre reserver" indregnes beløb reserveret til fremtidig vedligeholdelse samt reservation til imødegåelse af værdiforringelse af andelsboligforeningens ejendom, kursreguleringer m.v. i overensstemmelse med generalforsamlingsbeslutning. I henhold til vedtægterne indgår de reserverede beløb ikke i beregningen af andelsværdien.

### Prioritetsgæld
Prioritetsgæld indregnes ved låneoptagelsen til kostpris, svarende til det modtagne provenu efter fradrag af afholdte transaktionsomkostninger. I efterfølgende perioder værdiansættes prioritetsgælden til amortiseret kostpris svarende til den kapitaliserede værdi ved anvendelse af den effektive rente. Forskellen mellem provenuet og den nominelle værdi indregnes dermed i resultatopgørelsen over lånets løbetid.

Prioritetsgælden er således værdiansat til amortiseret kostpris, der for kontantlån svarer til lånets restgæld. For obligationslån svarer amortiseret kostpris til en restgæld, der opgøres som det oprindeligt modtagne provenu ved låneoptagelsen reduceret med betalte afdrag og korrigeret for en over afdragstiden foretagen afskrivning af lånets kurstab og låneomkostninger på optagelsestidspunktet.

### Øvrige gældsforpligtelser
Øvrige gældsforpligtelser værdiansættes til nominel værdi.

## Øvrige noter

### Nøgleoplysninger
De i noten "Nøgleoplysninger" anførte nøgleoplysninger har til formål at leve op til de krav, der følger af § 3 i bekendtgørelse nr. 336 af 20. marts 2025 fra Social- og Boligministeriet om oplysningspligt ved salg af andelsboliger m.v. samt om bestyrelsens pligt til at fremlægge skema over centrale nøgleoplysninger.

### Andelsværdi
Bestyrelsens forslag til andelsværdi fremgår af noten "Beregning af andelsværdi". Andelsværdien opgøres i henhold til andelsboligforeningsloven samt vedtægternes § 6 og § 14.

Vedtægterne bestemmer desuden i § 14, at selvom der lovligt kan vedtages en højere andelsværdi, er det den på generalforsamlingen vedtagne andelsværdi, der er gældende.`,

  pantsaetning:
`Til sikkerhed for gæld til realkreditinstitut, restgæld {{laan.restgaeld}} kr., er der givet pant i grund og bygninger, hvis regnskabsmæssige værdi pr. 31. december {{aar}} udgør {{ejendom.bogfoert}} kr.`,

  eventualforpligtelser:
`Andelsboligforeningen har modtaget ydelsesstøtte til lån i realkreditinstitut fra staten og kommunen til etablering af andelsboligforeningen. Ydelsesstøtten kan kræves tilbagebetalt ved opløsning af foreningen efter almenboliglovens § 160 k. Den samlede modtagne ydelsesstøtte udgør pr. seneste opgørelse 2.167 t.kr.`,

  andelsvaerdiIntro:
`Bestyrelsen foreslår følgende værdiansættelse i henhold til andelsboligforeningslovens § 5, stk. 2, litra {{av.litra}} ({{av.princip}}), samt vedtægternes § 6, stk. 1:`,

  noegleIntro:
`Nøgletallene viser centrale dele af foreningens økonomi og er primært udregnet på baggrund af arealer. I {{forening.navn}} anvendes andelsindskuddene som fordelingsnøgle, og de arealbaserede nøgletal for andelsværdi og boligafgift svarer derfor ikke til de, der konkret gælder for den enkelte andelshaver.

I bilag 1 til bekendtgørelse nr. 336 af 20. marts 2025 er opregnet en række nøgleoplysninger om foreningens økonomi, der skal optages som noter til årsregnskabet (§ 3). Disse nøgleoplysninger følger her:`,
};

export const VURDERINGSPRINCIPPER = [
  { id: 'anskaffelse', litra: 'a', label: 'Anskaffelsesprisen' },
  { id: 'valuar', litra: 'b', label: 'Valuarvurdering (kontant handelsværdi)' },
  { id: 'offentlig', litra: 'c', label: 'Offentlig ejendomsvurdering' },
  { id: 'indekseret', litra: 'd', label: 'Nettoprisindekseret offentlig ejendomsvurdering' },
];

export const FORDELINGSTAL = [
  { id: 'bbr', label: 'Boligernes areal (BBR)' },
  { id: 'anden', label: 'Boligernes areal (anden kilde)' },
  { id: 'indskud', label: 'Det oprindelige indskud' },
  { id: 'andet', label: 'Andet' },
];

export function tomState(aar = new Date().getFullYear() - 1) {
  return {
    version: 1,
    aar,
    forening: { navn: '', kortnavn: '', adresse: '', postnrBy: '', by: '', cvr: '', stiftelsesaar: '', opfoerelsesaar: '' },
    ledelse: {
      bestyrelse: [{ navn: '', titel: 'Formand' }, { navn: '', titel: 'Kasserer' }, { navn: '', titel: 'Bestyrelsesmedlem' }],
      dirigent: '',
      bilagskontrolloerer: [{ navn: '' }, { navn: '' }],
      datoPaategning: '', datoBilagskontrol: '', datoGeneralforsamling: '',
    },
    tekster: { ...STANDARD_TEKSTER },
    likvidkonti: [
      { id: 'bank', navn: 'Pengeinstitut, forretningskonto', primo: 0, kontoudtog: null },
      { id: 'kasse', navn: 'Kontanter', primo: 0, kontoudtog: null },
    ],
    kontoplan: STANDARD_KONTOPLAN.map(k => ({ ...k })),
    posteringer: [],
    reguleringer: [],
    ejendom: { kostprisPrimo: 0, opskrivningPrimo: 0, opskrivningAaret: 0, vurderingsprincip: 'offentlig', vurdering: 0, vurderingTekst: '', fastholdt: false },
    andele: { antal: 0, indskudPrAndel: 0, fordelingstalType: 'indskud', fordelingstalAndet: 0, senestVedtagetPrKrone: 0, senestVedtagetAar: '', andreReguleringer: 0 },
    egenkapitalPrimo: { overfoertResultat: 0, genopretning: 0, vedligehold: 0, andreReserver: 0 },
    disponering: { tilVedligehold: 0, tilAndreReserver: 0, tilGenopretning: 0, anvendtVedligehold: 0, anvendtAndreReserver: 0, anvendtGenopretning: 0 },
    laan: [],
    andenGaeld: [],
    tilgodehavender: [],
    forudmodtaget: { primo: 0 },
    budget: {},
    sidsteAar: { vis: false, linjer: {} },
    noegle: {
      arealer: {
        y2: { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 },
        y1: { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 },
        y0: { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 },
      },
      antal: { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 },
      fordelingstalAndelsvaerdi: 'indskud',
      fordelingstalBoligafgift: 'indskud',
      c3Tekst: '', c3Svar: '',
      haefter: false, haefterTekst: '',
      e2Tekst: '', e2Svar: '',
      g1: false, g2: false, g3: false,
      boligafgiftDecember: 0, erhvervslejeDecember: 0, boliglejeDecember: 0,
      resultatPrM2: { y2: 0, y1: 0 },
      vedligeholdLoebende: { y2: 0, y1: 0 },
      vedligeholdGenopretning: { y2: 0, y1: 0 },
      afdragPrM2: { y2: 0, y1: 0 },
      visP: false,
    },
  };
}

// Sikrer at ældre/ufuldstændige gemte data får alle felter
export function normaliser(state) {
  const base = tomState(state.aar);
  const deep = (b, s) => {
    if (Array.isArray(b)) return Array.isArray(s) ? s : b;
    if (b && typeof b === 'object') {
      const out = { ...b };
      if (s && typeof s === 'object') for (const k of Object.keys(s)) out[k] = (k in b) ? deep(b[k], s[k]) : s[k];
      return out;
    }
    return s === undefined || s === null ? b : s;
  };
  const st = deep(base, state);
  st.tekster = { ...STANDARD_TEKSTER, ...(state.tekster || {}) };
  return st;
}
