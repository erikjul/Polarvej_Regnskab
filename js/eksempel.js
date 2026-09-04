// eksempel.js – eksempeldata: Andelsboligforeningen Polarvej I, regnskabsåret 2025.
// Tallene stammer fra foreningens kasserapport og årsrapport for 2025.
import { tomState, STANDARD_TEKSTER } from './model.js';
import { DLR_BETALINGSPLAN } from './data-dlr-betalingsplan.js';
import { POSTERINGER, BANK_ULTIMO } from './data-historik.js';


export function eksempelPolarvej2025() {
  const s = tomState(2025);
  s.forening = {
    navn: 'Andelsboligforeningen Polarvej I',
    kortnavn: 'Polarvejens Andelsboligforening I',
    adresse: 'Polarvej 23',
    postnrBy: '7100 Vejle',
    by: 'Vejle',
    cvr: '29 05 06 43',
    stiftelsesaar: 1983,
    opfoerelsesaar: 1983,
  };
  s.ledelse = {
    bestyrelse: [
      { navn: 'Heidi Jensen', titel: 'Formand' },
      { navn: 'Erik Jul Nielsen', titel: 'Kasserer' },
      { navn: 'Tina Qualmann', titel: 'Bestyrelsesmedlem' },
    ],
    dirigent: 'Tina Qualmann',
    bilagskontrolloerer: [{ navn: 'Amal Mehdi' }, { navn: 'Jette Bruun' }],
    datoPaategning: '2026-03-10',
    datoBilagskontrol: '2026-03-16',
    datoGeneralforsamling: '2026-03-17',
  };
  s.tekster = { ...STANDARD_TEKSTER };
  s.likvidkonti = [
    { id: 'bank', navn: 'Middelfart Sparekasse, forretningskonto', primo: 208611.97, kontoudtog: 212846.55 },
    { id: 'depo', navn: 'Middelfart Sparekasse, deponeringskonto (hensat fremlejedepositum)', primo: 20000, kontoudtog: 20000 },
    { id: 'henl', navn: 'Middelfart Sparekasse, henlæggelseskonto', primo: 0, kontoudtog: 0 },
    { id: 'kasse', navn: 'Kontanter', primo: 174, kontoudtog: 174 },
  ];
  // Kontoplan: standard + lånekonto
  s.kontoplan.push({ nr: 120, navn: 'DLR Kredit, låneydelse (renter + afdrag)', linje: 'laan:dlr' });
  s.kontoplan.push({ nr: 80, navn: 'Fremlejedepositum modtaget/tilbagebetalt', linje: 'ag:depositum' });
  s.kontoplan.push({ nr: 85, navn: 'Andelsoverdragelser, gennemløb (købesum ind / provenu ud)', linje: 'ag:handel' });
  s.kontoplan.sort((a, b) => a.nr - b.nr);

  // Alle posteringer på forretningskontoen i 2025 fra Middelfart Sparekasses CSV-eksport (data/bank-eksport-2025.csv), konteret af scripts/byg-historik.mjs
  s.posteringer = POSTERINGER[2025].map(p => ({ ...p }));
  s.reguleringer = [];
  s.ejendom = {
    kostprisPrimo: 3000000,
    opskrivningPrimo: 7300000,
    opskrivningAaret: 0,
    vurderingsprincip: 'offentlig',
    vurdering: 10300000,
    vurderingTekst: 'pr. 1. oktober 2017',
    fastholdt: false,
  };
  s.andele = {
    antal: 8,
    indskudPrAndel: 85800,
    fordelingstalType: 'indskud',
    fordelingstalAndet: 0,
    senestVedtagetPrKrone: 14.25,
    senestVedtagetAar: '2017',
    andreReguleringer: 0,
  };
  s.egenkapitalPrimo = { overfoertResultat: 1913651.63, genopretning: 0, vedligehold: 0, andreReserver: 0 };
  s.disponering = { tilVedligehold: 0, tilAndreReserver: 0, tilGenopretning: 0, anvendtVedligehold: 0, anvendtAndreReserver: 0, anvendtGenopretning: 0 };
  s.laan = [{
    id: 'dlr',
    navn: 'DLR Kredit, obligationslån (lån nr. 20)',
    kreditor: 'DLR Kredit A/S',
    hovedstol: 950000,
    optagetTekst: 'udbetalt 5. juli 2017',
    kilde: 'plan',
    betalingsplan: DLR_BETALINGSPLAN.map(t => ({ ...t })),
    restgaeldPrimo: 627230.91,
    kortfristetPrimo: 45918.10,
    renter: 14641.58,
    afdragIflg: '',
    restgaeldUltimoIflg: '',
    kortfristet: 46610.76,
    kursvaerdi: 0,
    kursvaerdiTekst: '',
    beskrivelse: 'Lånet er et konverterbart obligationslån (annuitetslån, 20 år, 81 kvartårlige terminer) med en nominel rente på 1,5 % p.a. og administrationsbidrag på 0,9 % p.a. af obligationsrestgælden. Obligationsserie 42.s.A 2037, fondskode DK000633801-7.',
  }];
  s.andenGaeld = [
    { id: 'depositum', tekst: 'Depositum fra fremlejer, Polarvej 64 (hensat på deponeringskonto)', primo: 20000 },
    { id: 'handel', tekst: 'Mellemregning, andelsoverdragelser (købesum modtaget, endnu ikke afregnet)', primo: 0 },
  ];
  s.tilgodehavender = [];
  s.forudmodtaget = { primo: 0 };
  s.budget = {
    'n1.boligafgift': 192000, 'n2.uforudset': 1000,
    'n3.ejendomsskat': -82000, 'n3.renovation': -2000, 'n3.forsikring': -16000,
    'n5.gebyrbank': -2100, 'n5.generalforsamling': -3000, 'n5.diverse': -3400,
    'n6.honorar': -3500, 'n6.abf': -2100, 'n6.grundejer': -4400,
    'n7.renter': -16000,
  };
  s.sidsteAar = { vis: false, linjer: {} };
  s.noegle = {
    arealer: {
      y2: { b1: 889, b2: 0, b3: 0, b4: 0, b5: 0 },
      y1: { b1: 889, b2: 0, b3: 0, b4: 0, b5: 0 },
      y0: { b1: 889, b2: 0, b3: 0, b4: 0, b5: 0 },
    },
    antal: { b1: 8, b2: 0, b3: 0, b4: 0, b5: 0 },
    fordelingstalAndelsvaerdi: 'indskud',
    fordelingstalBoligafgift: 'indskud',
    c3Tekst: '', c3Svar: '',
    haefter: false, haefterTekst: '',
    e2Tekst: '', e2Svar: '',
    g1: true, g2: false, g3: false,
    boligafgiftDecember: 16000, erhvervslejeDecember: 0, boliglejeDecember: 0,
    resultatPrM2: { y2: 41, y1: 79 },
    vedligeholdLoebende: { y2: 0, y1: 0 },
    vedligeholdGenopretning: { y2: 0, y1: 0 },
    afdragPrM2: { y2: 69, y1: 69 },
    visP: false,
  };
  return s;
}

// Samling med alle regnskabsår 2021–2025: bankens posteringer for hvert år, kædede primotal fra 2022.
// Egenkapital primo 2021 og andre primotal for 2021 kendes ikke endnu (udfyldes fra årsrapporten for 2021/2022).
export function eksempelSamling() {
  const regnskaber = {};
  for (const y of [2021, 2022, 2023, 2024, 2025]) {
    const st = eksempelPolarvej2025();
    st.aar = y;
    st.posteringer = POSTERINGER[y].map(p => ({ ...p }));
    st.likvidkonti.find(k => k.id === 'bank').primo = BANK_ULTIMO[y - 1];
    st.likvidkonti.find(k => k.id === 'bank').kontoudtog = BANK_ULTIMO[y];
    const depo = st.likvidkonti.find(k => k.id === 'depo');
    depo.primo = y <= 2022 ? 0 : 20000; depo.kontoudtog = y <= 2021 ? 0 : 20000;
    st.andenGaeld.find(a => a.id === 'depositum').primo = y <= 2021 ? 0 : 20000;
    if (y < 2025) {
      st.budget = {};
      st.ledelse.datoPaategning = ''; st.ledelse.datoBilagskontrol = ''; st.ledelse.datoGeneralforsamling = '';
      st.noegle.resultatPrM2 = { y2: 0, y1: 0 }; st.noegle.afdragPrM2 = { y2: 0, y1: 0 };
    }
    if (y === 2021) {
      // Primotal 2021 kendes ikke endnu – sættes fra årsrapporten
      st.primoKilde = 'manuel';
      st.egenkapitalPrimo = { overfoertResultat: 0, genopretning: 0, vedligehold: 0, andreReserver: 0 };
      st.primoBemaerkning = 'Egenkapital primo 2021 mangler – udfyldes fra årsrapporten for 2020/2021.';
    } else if (y === 2025) {
      st.primoKilde = 'manuel'; // beholder primotallene fra årsrapporten 2024, indtil 2021–2024 er afstemt
    } else {
      st.primoKilde = 'forrigeAar';
    }
    regnskaber[y] = st;
  }
  return { version: 2, aktivAar: 2025, regnskaber };
}
