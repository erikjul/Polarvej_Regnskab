# Kontrolsiden – hvad kontrolleres

Kontrolsiden viser en grøn banner, når regnskabet balancerer og alle afstemninger stemmer. Hver kontrol viser de to tal, der sammenlignes, differencen og – ved klik på et tal – hele beregningskæden.

| Kontrol | Regel | Status ved afvigelse |
|---|---|---|
| Balancen balancerer (ultimo) | Aktiver i alt = passiver i alt | Fejl |
| Primobalancen balancerer | Sidste års aktiver = sidste års passiver (de indtastede primotal) | Fejl. Hvis differencen er den samme primo og ultimo, ligger fejlen i primotallene. |
| Alle posteringer er konteret | Hver postering har en konto, kontoen findes i kontoplanen, og kontoen er knyttet til en regnskabslinje/balancepost; likvid konto findes | Fejl |
| Posteringernes kvalitet | Dato inden for regnskabsåret, ét beløb pr. postering, ingen negative beløb, entydige bilagsnumre | Advarsel |
| Pengestrømsafstemning | Ændring i likvide beholdninger = årets resultat (korrigeret for reguleringer) − afdrag + bevægelser på balancekonti | Fejl |
| Overførsler mellem likvide konti | Summen af posteringer på overførselskontoen er 0 | Fejl |
| Bankafstemning pr. likvid konto | Primo + indbetalinger − udbetalinger = saldo iflg. kontoudtog | Fejl (info hvis kontoudtogssaldo ikke er indtastet) |
| Resultatdisponering | Summen af disponeringen = årets resultat | Fejl |
| Resultatopgørelsen | Indtægter + omkostninger + finansielle poster = årets resultat | Fejl |
| Egenkapitalbevægelse | Egenkapital ultimo = primo + årets resultat + årets opskrivning + nye indskud | Fejl |
| Lån – årsopgørelse | Beregnet afdrag og restgæld ultimo = kreditforeningens årsopgørelse (hvis indtastet) | Fejl |
| Lån – sandsynlighed | Ydelser bogført, renter ≤ ydelser, kortfristet del ≤ restgæld, kursværdi tæt på restgæld, kursværdi indtastet | Advarsel |
| Reguleringer | Gyldig resultatlinje og balancepost | Fejl |
| Andelsværdi | Fordelingstal og vurdering udfyldt, vedtaget værdi ≤ beregnet maksimum (andelsboliglovens § 5), antal andele = antal andelsboliger, valuarvurderingens dato | Advarsel |
| Nøgleoplysninger | Arealer, december-boligafgift, tidligere års nøgletal, stiftelses-/opførelsesår | Advarsel |
| Stamdata og underskrifter | Navn, CVR, bestyrelse, bilagskontrollører, dirigent, datoer | Advarsel |
| Budget | Budget indtastet; advarer hvis budgettet ikke dækker afdragene | Advarsel/info |

I Excel-eksporten findes de samme afstemninger på arket *Kontrol* som formler, så status opdateres, hvis tal rettes i projektmappen.
