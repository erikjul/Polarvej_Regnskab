// boligafgift.js – betalt boligafgift pr. andel, måned for måned, på tværs af regnskabsår.
// Betalinger fyldes kronologisk på de forfaldne måneder (ældste først), så efter- og forudbetalinger håndteres.
export const STANDARD_ANDELSHAVERE = [
  { id: 'a23', adresse: 'Polarvej 23', navn: 'Jan Iversen (fra 2022; før: Jørgen Pedersen)', afgift: 2000, moenstre: 'Polarvej 23; Jan Iversen; Jørgen Pedersen', fra: '2021-01', primoSaldo: 0, areal: 100 },
  { id: 'a31', adresse: 'Polarvej 31', navn: 'Mette Agerskov (fra okt. 2024; før: Jonna Frandsen)', afgift: 2000, moenstre: 'Polarvej 31; Jonna Frands; Mette Agerskov; Advis', fra: '2021-01', primoSaldo: 0, areal: 100 },
  { id: 'a37', adresse: 'Polarvej 37', navn: 'Tina Qualmann', afgift: 2000, moenstre: 'Polarvej 37; Tina Qualmann', fra: '2021-01', primoSaldo: 0, areal: 100 },
  { id: 'a43', adresse: 'Polarvej 43', navn: 'Jette Bruun (fra juni 2022; før: Ahmad Ziad Hussein)', afgift: 2000, moenstre: 'Polarvej 43; Jette Bruun; Ahmad', fra: '2021-01', primoSaldo: 0, areal: 100 },
  { id: 'a49', adresse: 'Polarvej 49', navn: 'Anni Karna Bak (fra juli 2023; før: John Visti Bak)', afgift: 2000, moenstre: 'Polarvej 49', fra: '2021-01', primoSaldo: 0, areal: 100 },
  { id: 'a55', adresse: 'Polarvej 55', navn: 'Heidi Jensen', afgift: 2000, moenstre: 'Polarvej 55; Heidi; nr 55', fra: '2021-01', primoSaldo: 0, areal: 100 },
  { id: 'a62', adresse: 'Polarvej 62', navn: 'Muhanad Al Mubare / Amal Mehdi', afgift: 2000, moenstre: 'Polarvej 62; MUBARE; Mehdi', fra: '2021-01', primoSaldo: 0, areal: 100 },
  { id: 'a64', adresse: 'Polarvej 64', navn: 'Lone Møller / Erik Jul Nielsen', afgift: 2000, moenstre: 'Polarvej 64', fra: '2021-01', primoSaldo: 0, areal: 100 },
];

const mdr = (ym) => { const [y, m] = String(ym).split('-').map(Number); return y * 12 + (m - 1); };
const ymAf = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
export const MAANEDER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Alle boligafgiftsposteringer i samlingen (konti knyttet til note 1 boligafgift)
export function boligafgiftPosteringer(samling) {
  const ud = [];
  for (const [aar, st] of Object.entries(samling.regnskaber)) {
    const konti = new Set((st.kontoplan || []).filter(k => k.linje === 'n1.boligafgift').map(k => Number(k.nr)));
    (st.posteringer || []).forEach(p => { if (konti.has(Number(p.konto))) ud.push({ aar: Number(aar), dato: p.dato, tekst: p.tekst, beloeb: (Number(p.ind) || 0) - (Number(p.ud) || 0), bilag: p.bilag }); });
  }
  return ud.sort((a, b) => String(a.dato).localeCompare(String(b.dato)));
}

export function matchAndel(post, andele) {
  const t = String(post.tekst || '').toLowerCase();
  for (const a of andele) {
    const ms = String(a.moenstre || '').split(';').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (ms.some(m => t.includes(m))) return a;
  }
  return null;
}

// Beregner oversigt: pr. andel en række pr. måned med forfald, betalt og saldo, samt uafstemte posteringer.
// tilMaaned: 'ÅÅÅÅ-MM' – sidste måned der regnes som forfalden (default: seneste posteringsmåned i samlingen)
export function boligafgiftOversigt(samling, andele, tilMaaned) {
  const poster = boligafgiftPosteringer(samling);
  const slut = tilMaaned ? mdr(tilMaaned) : (poster.length ? mdr(poster[poster.length - 1].dato.slice(0, 7)) : mdr(`${samling.aktivAar}-12`));
  const perAndel = new Map(andele.map(a => [a.id, []]));
  const uafstemt = [];
  poster.forEach(p => { const a = matchAndel(p, andele); if (a) perAndel.get(a.id).push(p); else uafstemt.push(p); });
  const resultat = andele.map(a => {
    const afgift = Number(a.afgift) || 0;
    const start = mdr(a.fra || `${Math.min(...Object.keys(samling.regnskaber).map(Number))}-01`);
    const betalinger = perAndel.get(a.id);
    let saldo = Number(a.primoSaldo) || 0; // positiv = forudbetalt
    const maaneder = [];
    let bi = 0;
    for (let m = start; m <= slut; m++) {
      const ym = ymAf(m);
      saldo -= afgift; // forfald
      let betalt = 0; const bet = [];
      while (bi < betalinger.length && mdr(betalinger[bi].dato.slice(0, 7)) <= m) { betalt += betalinger[bi].beloeb; bet.push(betalinger[bi]); bi++; }
      saldo += betalt;
      maaneder.push({ ym, aar: Math.floor(m / 12), md: m % 12, forfald: afgift, betalt, saldo: Math.round(saldo * 100) / 100, status: saldo >= -0.005 ? 'ok' : (saldo > -afgift + 0.005 ? 'delvis' : 'mangler'), betalinger: bet });
    }
    // betalinger efter slutmåneden (forudbetalinger)
    let efter = 0; while (bi < betalinger.length) { efter += betalinger[bi].beloeb; bi++; }
    saldo += efter;
    const forfaldIalt = afgift * (slut - start + 1);
    const betaltIalt = betalinger.reduce((s, p) => s + p.beloeb, 0);
    return { andel: a, maaneder, saldo: Math.round(saldo * 100) / 100, forfaldIalt, betaltIalt, antalBetalinger: betalinger.length };
  });
  return { andele: resultat, uafstemt, slut: ymAf(slut), start: resultat.length ? ymAf(Math.min(...resultat.map(r => mdr(r.maaneder[0]?.ym || ymAf(slut))))) : ymAf(slut) };
}
