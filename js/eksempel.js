// eksempel.js – eksempeldata: Andelsboligforeningen Polarvej I, regnskabsåret 2025.
// Tallene stammer fra foreningens kasserapport og årsrapport for 2025.
import { tomState, STANDARD_TEKSTER } from './model.js';
import { DLR_BETALINGSPLAN } from './data-dlr-betalingsplan.js';
import { POSTERINGER, BANK_ULTIMO } from './data-historik.js';
import { opretNytAar } from './samling.js';
import { STANDARD_ANDELSHAVERE } from './boligafgift.js';


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
  s.andelshavere = STANDARD_ANDELSHAVERE.map(a => ({ ...a }));
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
    kurs: 98.30,
    kursvaerdi: 0,
    kursvaerdiTekst: 'Kursen er uændret 98,30 siden udbetalingen i 2017.',
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

// Samling med alle regnskabsår 2021–2026: bankens posteringer for hvert år og kædede primotal.
// Primo 2021 er udledt af bankens saldo 31/12 2020 (regnet baglæns), DLR's betalingsplan og de faste poster.
// Rapporterede tal fra de aflagte årsrapporter bruges kun til sammenligning (se docs/afvigelser.md).
export const RAPPORTERET = {
  // Overført resultat ultimo iflg. de aflagte årsrapporter (note 12)
  overfoert: { 2020: 1702318.84, 2021: 1736513.16, 2022: 1793650.64, 2023: 1843463.42, 2024: 1913651.63, 2025: 1945307.74 },
  resultat: { 2021: 34194.32, 2022: 57137.48, 2023: 36488.92, 2024: 70188.21, 2025: 51160.91 },
  restgaeld: { 2021: 796127.30, 2022: 711857.46, 2023: 653970.08, 2024: 627230.91, 2025: 581312.81 },
  kortfristet: { 2021: 61769.76, 2022: 44563.52, 2023: 45235.74, 2024: 45918.10, 2025: 46610.76 },
  renter: { 2021: 0, 2022: 17868.48, 2023: 16808.90, 2024: 15733.35, 2025: 15733.35 },
  afdragDisp: { 2021: 62161.19, 2022: 61769.76, 2023: 61769.76, 2024: 60969.09, 2025: 60969.09 },
  boligafgift: { 2021: 0, 2022: 190000, 2023: 190000, 2024: 197000, 2025: 192000 },
  likvider: { 2021: 221171.98, 2022: 211908.10, 2023: 203833.50, 2024: 228785.97, 2025: 233020.55 },
  andelskrone: { 2022: 14.05, 2023: 14.04, 2024: 14.10, 2025: 14.08 },
  kursvaerdi: { 2021: 846786.53, 2022: 846786.53, 2023: 846786.53, 2024: 846786.53, 2025: 846786.53 },
};

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
    st.andenGaeld.find(a => a.id === 'depositum').primo = 20000; // depositum modtaget før 2021; hensat på deponeringskonto fra april 2022
    st.reguleringer = [];
    if (y === 2022) st.reguleringer.push({ id: 'r2022handel', tekst: 'Foreningens andel af overdragelsessummer (Polarvej 23 og 43) indtægtsføres', beloeb: -24000, linje: 'n2.andelshandel', balancepost: 'ag:handel' });
    if (y === 2024) st.reguleringer.push({ id: 'r2024handel', tekst: 'Foreningens andel af overdragelsessum (Polarvej 31) indtægtsføres', beloeb: -6400, linje: 'n2.andelshandel', balancepost: 'ag:handel' });
    if (y < 2025) {
      st.budget = {};
      st.ledelse.datoPaategning = ''; st.ledelse.datoBilagskontrol = ''; st.ledelse.datoGeneralforsamling = '';
      st.noegle.resultatPrM2 = { y2: 0, y1: 0 }; st.noegle.afdragPrM2 = { y2: 0, y1: 0 };
    }
    if (y === 2021) {
      // Primo 2021 (= 31/12 2020): bank 212.736,17 + kontanter 174 + ejendom 10.300.000 − DLR-restgæld 804.180,33 − depositum 20.000 − indskud − opskrivning
      st.primoKilde = 'manuel';
      const overfoert = Math.round((BANK_ULTIMO[2020] + 174 + 10300000 - 804180.33 - 20000 - 686400 - 7300000) * 100) / 100;
      st.egenkapitalPrimo = { overfoertResultat: overfoert, genopretning: 0, vedligehold: 0, andreReserver: 0, overfoertIflgRapport: RAPPORTERET.overfoert[2020], korrektionTekst: 'Primo 2021 er opgjort ud fra bankens saldo pr. 31. december 2020, DLR Kredits betalingsplan (restgæld 804.180,33 kr.) og fremlejedepositum 20.000 kr. Differencen til den aflagte årsrapport er 11,00 kr.' };
    } else {
      st.primoKilde = 'forrigeAar';
      st.egenkapitalPrimo.overfoertIflgRapport = ''; st.egenkapitalPrimo.korrektionTekst = '';
    }
    regnskaber[y] = st;
  }
  const samling = { version: 2, aktivAar: 2025, regnskaber };
  // 2026: nyt år med korrigeret primo; den aflagte årsrapport for 2025 viser overført resultat 1.945.307,74
  const st26 = opretNytAar(samling, 2025);
  st26.posteringer = POSTERINGER[2026].map(p => ({ ...p })); // bankens posteringer 1/1–4/9 2026
  st26.likvidkonti.find(k => k.id === 'bank').kontoudtog = BANK_ULTIMO[2026];
  st26.budget = { ...regnskaber[2025].budget };
  st26.egenkapitalPrimo.overfoertIflgRapport = RAPPORTERET.overfoert[2025];
  st26.egenkapitalPrimo.korrektionTekst = 'Egenkapitalen pr. 31. december 2025 er afstemt til bankens kontoudtog og DLR Kredits betalingsplan og svarer til den aflagte årsrapport for 2025. Sammenligningstallene for 2025 er dog korrigeret i forhold til den aflagte årsrapport: boligafgift 190.000 kr. (aflagt 192.000), renter og bidrag 14.641,58 kr. (aflagt 15.733,35), betalte afdrag 45.918,10 kr. (aflagt 60.969,09), vedligeholdelse 10.350 kr. (aflagt under diverse omkostninger) og årets resultat 50.152,68 kr. (aflagt 51.160,91). Korrektionerne påvirker ikke egenkapitalen.';
  st26.andele.senestVedtagetAar = '2026';
  samling.aktivAar = 2025;
  return samling;
}
