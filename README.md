# Polarvej Regnskab

Regnskabsprogram til **Andelsboligforeningen Polarvej I** (og andre mindre andelsboligforeninger). Du indtaster årets posteringer og stamoplysninger, og programmet genererer en komplet årsrapport efter reglerne for andelsboligforeninger i Danmark (2026), med en kontrolside der bekræfter, at regnskabet balancerer og afstemningerne er korrekte. Regnskabet kan downloades som **Excel-projektmappe med rigtige formler** eller udskrives/gemmes som **PDF**.

Programmet er en ren webapplikation (HTML/JavaScript) uden server. Det kan køres direkte fra GitHub Pages eller ved at åbne `index.html` via en lokal webserver. Alle data gemmes i browseren og kan gemmes/åbnes som `.json`-fil.

## Funktioner

* **Bankimport**: Bankens CSV-eksport (fx Middelfart Sparekasse: `dato;tekst;beløb;valuta;modpart`) læses direkte ind i kasserapporten. Posteringerne konteres automatisk efter redigerbare konteringsregler (tekst indeholder, retning, beløb) og tidligere posteringer; dubletter og posteringer uden for regnskabsåret springes over. Linjer uden regel markeres, så kontoen vælges før import.
* **Indtastning**: stamdata, kasserapport (dato, bilag, tekst, konto, likvid konto, indsat/hævet), kontoplan, primotal, ejendom, andele, lån, anden gæld, tilgodehavender, reguleringer, budget, nøgleoplysninger og alle tekster.
* **Årsrapport** med forside, bestyrelsespåtegning, bilagskontrollørernes erklæring, anvendt regnskabspraksis, resultatopgørelse (med budget og evt. sidste år), resultatdisponering, balance, noter til resultatopgørelse og balance, pantsætninger, eventualforpligtelser, beregning af andelsværdi og nøgleoplysninger (bek. nr. 336/2025, bilag 1).
* **Sammenhæng i tallene som i et regneark**: Slå "Vis formler" til, så hver beregnet celle viser sin formel. Klik på et tal for at spore det hele vejen tilbage til posteringerne. Blå tal er indtastede værdier.
* **Kontrolside**: balance primo/ultimo, kontering af alle posteringer, pengestrømsafstemning, bankafstemning pr. konto, resultatdisponering, egenkapitalbevægelse, lån mod årsopgørelse, andelsværdiens lovlighed, nøgleoplysninger, stamdata og budget. Se [docs/kontroller.md](docs/kontroller.md).
* **Excel-eksport**: Én projektmappe med et ark pr. side i årsrapporten plus *Kasserapport*, *Kontoplan*, *Grunddata*, *Beregninger* og *Kontrol*. Alle tal i rapportarkene er formler (SUMIF over kasserapporten, referencer til grunddata), så rettelser i Excel slår igennem overalt, og kontrolarket viser OK/FEJL med formler.
* **PDF**: "Udskriv / PDF" åbner browserens udskrift med A4-sideopsætning og sideskift; vælg "Gem som PDF".
* **Betalingsplan for lån**: Kreditforeningens betalingsplan (terminer med rente/bidrag og afdrag) indsættes ved at kopiere tabellen fra låneafregningen eller årsopgørelsen. Programmet opgør derefter renter, afdrag, kortfristet del, restgæld primo/ultimo og restløbetid automatisk for hvert regnskabsår og afstemmer de bogførte ydelser mod planen. DLR-lånets fulde plan (2017–2037) er indlagt i eksempeldataene.
* **Flere regnskabsår**: Programmet rummer alle årene (fx 2025 og 2026) og har en årsvælger i topbjælken. "+ Nyt år" opretter næste år med dette års ultimotal som primotal, sidste års resultat i sammenligningskolonnen og nøgletallene forskudt. Koblingen er levende: rettes 2025, følger 2026's primotal med. Koblingen kan afbrydes, hvis primotal skal indtastes manuelt.

## Kom i gang

1. Åbn programmet (GitHub Pages) eller start en lokal server i mappen, fx `python3 -m http.server 8000`, og åbn `http://localhost:8000/`.
2. Programmet starter med eksempeldata for Polarvej I, regnskabsåret 2025. Ret tallene, så kontrolsiden bliver grøn (eller klik **Nyt** for et tomt regnskab / **Åbn fil** for et gemt).
3. Gennemgå fanerne 1–7, se **Regnskab** og **Kontrolside**, og eksportér med **Excel** eller **Udskriv / PDF**.
4. Klik **+ Nyt år** for at oprette 2026 ovenpå 2025 og begynd at taste 2026-posteringer. Skift mellem årene i årsvælgeren; regnskab, kontrolside og eksport gælder altid det valgte år.
5. Gem løbende med **Gem fil** (`.json` med alle regnskabsår).

Fanen **Hjælp** i programmet beskriver arbejdsgangen. Regelgrundlaget er beskrevet i [docs/regelgrundlag.md](docs/regelgrundlag.md).

## Sådan er tallene forbundet

```
Kasserapport (posteringer)  ──konto──▶  Notelinjer (KONTO(nr) = indsat − hævet)
                                          │
Reguleringer (periodiseringer) ──────────▶│
                                          ▼
                              Noter 1–7 ──▶ Resultatopgørelse ──▶ Årets resultat
                                                                   │
Lån: ydelser − renter (årsopgørelse) = afdrag ─────────────────────▶ Resultatdisponering
Primotal + bevægelser ──▶ Balance (aktiver = passiver) ◀───────────── Egenkapital
Balance + vurdering + kursværdi ──▶ Beregning af andelsværdi ──▶ Nøgleoplysninger (K1–K3 m.fl.)
```

Motoren (`js/engine.js`) bygger et netværk af ca. 300 "celler" med formler i et lille formelsprog (`js/expr.js`). Samme formler evalueres i browseren, vises som tekst i rapporten og oversættes til Excel-formler ved eksport.

## Mappestruktur

```
index.html            – programmet
css/app.css           – skærm- og udskriftslayout (A4)
js/expr.js            – formelsprog (parser, evaluering, Excel- og tekstoversættelse)
js/model.js           – datamodel, regnskabslinjer, standardkontoplan, standardtekster
js/engine.js          – regnskabsmotor (alle beregninger)
js/report.js          – årsrapportens sider og noter
js/controls.js        – kontrolsiden (afstemninger)
js/excel.js           – Excel-eksport med formler (ExcelJS)
js/ui.js, js/app.js   – brugerflade
js/eksempel.js        – eksempeldata (Polarvej I, 2025)
js/samling.js         – flere regnskabsår med koblede primotal
js/betalingsplan.js   – betalingsplan for lån (parser, årssummer, restløbetid)
js/data-dlr-betalingsplan.js – DLR-lånets terminer 2017–2037 (fra låneafregningen)
js/data-historik.js   – konterede bankposteringer 2021–2025 (genereres af scripts/byg-historik.mjs)
scripts/              – byggescript til historikken
js/import.js          – bankimport (CSV-parser, konteringsregler, dubletkontrol)
js/storage.js         – autosave og filer
lib/exceljs.min.js    – ExcelJS 4.4.0 (MIT)
data/                 – bankens CSV-eksporter 2021–2025 og eksempeldata som JSON
docs/                 – regelgrundlag og kontrolbeskrivelse
tests/                – motortests (node --test tests/*.test.mjs)
```

## Test

```
node --test tests/*.test.mjs
```

Testene kontrollerer formelsproget, at eksempeldataene giver samme resultatopgørelse som årsrapporten for 2025, at balancen altid balancerer, når primobalancen gør, og at kontrolsiden opdager fejl.

## Eksempeldata: Polarvej I 2021–2025

Programmet starter med foreningens egne tal. Alle posteringer på forretningskontoen i Middelfart Sparekasse for 2021–2025 er importeret fra bankens CSV-eksporter (`data/bank-eksport-ÅÅÅÅ.csv`) og konteret af `scripts/byg-historik.mjs` efter konteringsreglerne (resultatet ligger i `js/data-historik.js`). Bankens saldo pr. 31/12 er regnet baglæns fra den kendte saldo ultimo 2024 (208.611,97 kr.), og bankafstemningen stemmer for alle fem år:

| År | Saldo 31/12 | Boligafgift | DLR-ydelser | Bemærkning |
|---|---|---|---|---|
| 2020 | 212.736,17 | | | udledt |
| 2021 | 200.997,98 | 172.000 | 62.161,19 | 20.000 kr. fremlejedepositum modtaget 22.11.2021 |
| 2022 | 191.734,10 | 190.000 | 61.769,76 | to andelsoverdragelser (Polarvej 62 og 43), depositum flyttet til deponeringskonto 19.04.2022 |
| 2023 | 183.659,50 | 192.000 | 61.372,42 | |
| 2024 | 208.611,97 | 196.000 | 60.969,09 | andelsoverdragelse Polarvej 31 |
| 2025 | 212.846,55 | 190.000 | 60.559,68 | |

DLR-ydelserne stemmer krone for krone med betalingsplanen i alle årene. Andelsoverdragelser bogføres som gennemløb på konto 85 (mellemregning under anden gæld): købesummen ind, provenuet til sælger ud. Restbeløbene (24.000 kr. i 2022 og 6.400 kr. i 2024) er ikke afklaret endnu og afventer årsrapporterne for 2022–2024, ligesom egenkapitalen primo 2021. Indtil da er 2025's primotal taget fra årsrapporten for 2024 (koblingen fra 2024 er slået fra), og 2021–2024 viser en balancedifference.

### Fund i årsrapporten for 2025

1. **Bankafstemning**: Rapportens kasserapport gav 214.946,55 kr. ultimo mod bankens 212.846,55 kr. Differencen på 2.100 kr. er Totalalgeservice 5.500 kr. (rapporten: 5.400) og 95 boligafgiftsindbetalinger à 2.000 kr. (190.000 kr., rapporten: 192.000). Én andelshaver mangler én måned.
2. **Primobalancen (31/12 2024) balancerer ikke**: Balancen for 2024 viser gæld i alt 628.734,34 kr., mens posterne giver 646.548,55 kr., og lånenoten viser en restgæld på 627.230,91 kr. Differencen på 18.496,57 kr. er i 2025-rapporten udlignet med en uforklaret post på −19.504,80 kr. i overført resultat.
3. **Prioritetslånet**: Ifølge DLR's betalingsplan er 2025-tallene: ydelser 60.559,68 kr. = renter og bidrag 14.641,58 kr. + afdrag 45.918,10 kr.; restgæld 627.230,91 kr. primo og 581.312,81 kr. ultimo; afdrag i 2026 (kortfristet del) 46.610,76 kr. Rapporten brugte 2024-tallene for renter (15.733,35 kr.) og afdrag (60.969,09 kr.). Lånet er et obligationslån, ikke et kontantlån, med restløbetid 11,75 år pr. 31/12 2025.
4. **Vedligeholdelse**: Algebehandling og tagarbejde (10.350 kr.) vises som vedligeholdelse (note 4, nøgletal M1) i stedet for diverse omkostninger.

**Fremlejedepositum**: Depositummet på 20.000 kr. for fremlejen af Polarvej 64 står på en særskilt deponeringskonto (modtaget 22.11.2021, overført 19.04.2022). Det indgår som likvid beholdning (aktiv) og som anden gæld (passiv). Når fremlejen ophører, bogføres tilbagebetalingen på konto 80 med deponeringskontoen som likvid konto.

## Licens

Programmet er skrevet til Andelsboligforeningen Polarvej I. ExcelJS er MIT-licenseret (se `lib/LICENSE-exceljs.txt`).
