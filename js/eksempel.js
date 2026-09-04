// eksempel.js – eksempeldata: Andelsboligforeningen Polarvej I, regnskabsåret 2025.
// Tallene stammer fra foreningens kasserapport og årsrapport for 2025.
import { tomState, STANDARD_TEKSTER } from './model.js';
import { DLR_BETALINGSPLAN } from './data-dlr-betalingsplan.js';

const P = (dato, bilag, tekst, konto, likvid, ind, ud) => ({ id: 'p' + bilag.replace('.', '_'), dato, bilag, tekst, konto, likvid, ind: ind || 0, ud: ud || 0 });

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
  s.kontoplan.sort((a, b) => a.nr - b.nr);

  s.posteringer = [
    P('2025-01-01', '01.25', 'Husleje januar', 10, 'bank', 16000),
    P('2025-01-01', '02.25', 'Alm. Brand Forsikring, tilbagebetaling', 40, 'bank', 2184.28),
    P('2025-01-02', '03.25', 'ALKA Husforsikring', 100, 'bank', 0, 15552.78),
    P('2025-01-06', '04.25', 'Vejle Kommune, renovation og rottebekæmpelse', 90, 'bank', 0, 1545.12),
    P('2025-01-06', '05.25', 'Vejle Kommune, ejendomsskat', 90, 'bank', 0, 34034),
    P('2025-02-01', '06.25', 'Husleje februar', 10, 'bank', 16000),
    P('2025-02-06', '07.25', 'byggesagkyndig.nu', 50, 'bank', 0, 4683.84),
    P('2025-02-06', '08.25', 'Gældsstyrelsen', 50, 'bank', 0, 23952.86),
    P('2025-02-11', '09.25', 'Gældsstyrelsen, tilbagebetaling', 40, 'bank', 23698.09),
    P('2025-02-28', '10.25', 'Gebyr MidSpar', 170, 'bank', 0, 10),
    P('2025-03-01', '11.25', 'Husleje marts', 10, 'bank', 16000),
    P('2025-03-28', '12.25', 'Gebyr MidSpar', 170, 'bank', 0, 500),
    P('2025-03-31', '13.25', 'DLR Kredit, låneydelse', 120, 'bank', 0, 15178.54),
    P('2025-04-01', '14.25', 'Husleje april', 10, 'bank', 16000),
    P('2025-04-11', '15.25', 'Bestyrelseshonorar Erik Jul Nielsen', 140, 'bank', 0, 1000),
    P('2025-04-11', '16.25', 'Bestyrelseshonorar Heidi Jensen', 140, 'bank', 0, 1500),
    P('2025-04-11', '17.25', 'Bestyrelseshonorar Tina Qualmann', 140, 'bank', 0, 1000),
    P('2025-04-11', '18.25', 'Din Madpartner, generalforsamling', 150, 'bank', 0, 3000),
    P('2025-04-30', '19.25', 'Gebyr MidSpar', 170, 'bank', 0, 40),
    P('2025-05-01', '20.25', 'Husleje maj', 10, 'bank', 16000),
    P('2025-05-21', '21.25', 'Skattekontoen, ejendomsskat', 90, 'bank', 0, 23505.38),
    P('2025-06-01', '22.25', 'Husleje juni', 10, 'bank', 16000),
    P('2025-06-10', '23.25', 'Totalalgeservice', 50, 'bank', 0, 5400),
    P('2025-06-10', '24.25', 'Dansk Tagbearbejdning', 50, 'bank', 0, 4850),
    P('2025-06-10', '25.25', 'Kontingent grundejerforeningen', 110, 'bank', 0, 4000),
    P('2025-06-30', '26.25', 'DLR Kredit, låneydelse', 120, 'bank', 0, 15152.86),
    P('2025-06-30', '27.25', 'Gebyr MidSpar', 170, 'bank', 0, 520),
    P('2025-07-01', '28.25', 'Husleje juli', 10, 'bank', 16000),
    P('2025-08-01', '29.25', 'Husleje august', 10, 'bank', 16000),
    P('2025-09-01', '30.25', 'Husleje september', 10, 'bank', 16000),
    P('2025-09-24', '31.25', 'Bonus Tryghedsgruppen', 20, 'bank', 894.71),
    P('2025-09-30', '32.25', 'DLR Kredit, låneydelse', 120, 'bank', 0, 15127.08),
    P('2025-09-30', '33.25', 'Gebyr MidSpar', 170, 'bank', 0, 500),
    P('2025-10-01', '34.25', 'Husleje oktober', 10, 'bank', 16000),
    P('2025-10-01', '35.25', 'ABF foreningskontingent', 130, 'bank', 0, 2016),
    P('2025-11-01', '36.25', 'Husleje november', 10, 'bank', 16000),
    P('2025-11-26', '37.25', 'Skattekontoen', 90, 'bank', 0, 273.84),
    P('2025-11-26', '38.25', 'Skattekontoen, ejendomsskat', 90, 'bank', 0, 23499),
    P('2025-12-01', '39.25', 'Husleje december', 10, 'bank', 16000),
    P('2025-12-30', '40.25', 'DLR Kredit, låneydelse', 120, 'bank', 0, 15101.2),
    P('2025-12-30', '41.25', 'Gebyr MidSpar', 170, 'bank', 0, 500),
  ];
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
  s.andenGaeld = [{ id: 'depositum', tekst: 'Depositum fra fremlejer, Polarvej 64 (hensat på deponeringskonto)', primo: 20000 }];
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
