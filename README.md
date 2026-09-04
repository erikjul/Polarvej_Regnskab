# Polarvej Regnskab

Regnskabsprogram til **Andelsboligforeningen Polarvej I** (og andre mindre andelsboligforeninger). Du indtaster årets posteringer og stamoplysninger, og programmet genererer en komplet årsrapport efter reglerne for andelsboligforeninger i Danmark (2026), med en kontrolside der bekræfter, at regnskabet balancerer og afstemningerne er korrekte. Regnskabet kan downloades som **Excel-projektmappe med rigtige formler** eller udskrives/gemmes som **PDF**.

Programmet er en ren webapplikation (HTML/JavaScript) uden server. Det kan køres direkte fra GitHub Pages eller ved at åbne `index.html` via en lokal webserver. Alle data gemmes i browseren og kan gemmes/åbnes som `.json`-fil.

## Funktioner

* **Indtastning**: stamdata, kasserapport (dato, bilag, tekst, konto, likvid konto, indsat/hævet), kontoplan, primotal, ejendom, andele, lån, anden gæld, tilgodehavender, reguleringer, budget, nøgleoplysninger og alle tekster.
* **Årsrapport** med forside, bestyrelsespåtegning, bilagskontrollørernes erklæring, anvendt regnskabspraksis, resultatopgørelse (med budget og evt. sidste år), resultatdisponering, balance, noter til resultatopgørelse og balance, pantsætninger, eventualforpligtelser, beregning af andelsværdi og nøgleoplysninger (bek. nr. 336/2025, bilag 1).
* **Sammenhæng i tallene som i et regneark**: Slå "Vis formler" til, så hver beregnet celle viser sin formel. Klik på et tal for at spore det hele vejen tilbage til posteringerne. Blå tal er indtastede værdier.
* **Kontrolside**: balance primo/ultimo, kontering af alle posteringer, pengestrømsafstemning, bankafstemning pr. konto, resultatdisponering, egenkapitalbevægelse, lån mod årsopgørelse, andelsværdiens lovlighed, nøgleoplysninger, stamdata og budget. Se [docs/kontroller.md](docs/kontroller.md).
* **Excel-eksport**: Én projektmappe med et ark pr. side i årsrapporten plus *Kasserapport*, *Kontoplan*, *Grunddata*, *Beregninger* og *Kontrol*. Alle tal i rapportarkene er formler (SUMIF over kasserapporten, referencer til grunddata), så rettelser i Excel slår igennem overalt, og kontrolarket viser OK/FEJL med formler.
* **PDF**: "Udskriv / PDF" åbner browserens udskrift med A4-sideopsætning og sideskift; vælg "Gem som PDF".
* **Næste år**: Ét klik opretter næste års regnskab med dette års ultimotal som primotal, sidste års tal i sammenligningskolonnen og nøgletallene forskudt.

## Kom i gang

1. Åbn programmet (GitHub Pages) eller start en lokal server i mappen, fx `python3 -m http.server 8000`, og åbn `http://localhost:8000/`.
2. Programmet starter med eksempeldata for Polarvej I, regnskabsåret 2025. Klik **Nyt** for et tomt regnskab eller **Åbn fil** for et gemt.
3. Gennemgå fanerne 1–7, se **Regnskab** og **Kontrolside**, og eksportér med **Excel** eller **Udskriv / PDF**.
4. Gem løbende med **Gem fil** (`.json`).

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
js/storage.js         – autosave og filer
lib/exceljs.min.js    – ExcelJS 4.4.0 (MIT)
data/                 – eksempeldata som JSON
docs/                 – regelgrundlag og kontrolbeskrivelse
tests/                – motortests (node --test tests/*.test.mjs)
```

## Test

```
node --test tests/*.test.mjs
```

Testene kontrollerer formelsproget, at eksempeldataene giver samme resultatopgørelse som årsrapporten for 2025, at balancen altid balancerer, når primobalancen gør, og at kontrolsiden opdager fejl.

## Eksempeldata og fund i årsrapporten for 2025

Eksempeldataene er foreningens egne tal for 2025. Resultatopgørelsen svarer krone for krone til den udarbejdede årsrapport (indtægter 218.777,08, omkostninger −151.882,82, årets resultat 51.160,91). Kontrolsiden viser samtidig tre reelle uoverensstemmelser i grundlaget for 2025-rapporten:

1. **Bankafstemning**: kasserapporten giver en ultimosaldo på 214.946,55 kr., men forretningskontoen er angivet til 212.846,55 kr. – en difference på 2.100,00 kr. (en postering mangler eller er forkert).
2. **Primobalancen (31/12 2024) balancerer ikke**: Balancen for 2024 viser gæld i alt 628.734,34 kr., mens posterne (langfristet 581.312,81 + kortfristet 45.235,74 + anden gæld 20.000,00) giver 646.548,55 kr., og lånenoten viser en restgæld på 627.230,91 kr. Differencen på 18.496,57 kr. er i 2025-rapporten udlignet med en uforklaret post på −19.504,80 kr. i overført resultat.
3. **Prioritetsafdrag**: 2025-rapporten angiver betalte afdrag 60.969,09 kr. (det er 2024-ydelserne), mens de faktiske ydelser i 2025 er 60.559,68 kr., hvoraf renter og bidrag udgør 15.733,35 kr. og afdrag dermed 44.826,33 kr. Restgælden ultimo 2025 i rapporten (581.312,81 kr.) er lig 2024-tallet.

Når primotallene rettes (så sidste års balance balancerer) og bankafstemningen går op, bliver kontrolsiden grøn.

## Licens

Programmet er skrevet til Andelsboligforeningen Polarvej I. ExcelJS er MIT-licenseret (se `lib/LICENSE-exceljs.txt`).
