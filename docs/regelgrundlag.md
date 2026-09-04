# Regelgrundlag for årsregnskabet (andelsboligforeninger, 2026)

Programmet opstiller årsrapporten efter de regler, der gælder for danske andelsboligforeninger i 2026. Nedenfor er de enkelte krav og hvordan programmet opfylder dem.

## Love og bekendtgørelser

| Regel | Indhold | Hvor i programmet |
|---|---|---|
| **Andelsboligforeningsloven § 6, stk. 2** | Årsregnskabet udarbejdes efter årsregnskabslovens regler for regnskabsklasse A. | Opstilling af resultatopgørelse, balance og noter (fanen *Regnskab*). |
| **Årsregnskabsloven, klasse A** | Retvisende billede, anvendt regnskabspraksis, resultatopgørelse, balance, noter, ledelsespåtegning. | Sider: Bestyrelsespåtegning, Anvendt regnskabspraksis, Resultatopgørelse, Balance, Noter. |
| **Andelsboligforeningsloven § 5** | Maksimal andelsværdi. Ejendommen kan værdiansættes efter stk. 2: litra a (anskaffelsespris), b (valuarvurdering, gyldig i 42 måneder), c (offentlig ejendomsvurdering) eller d (nettoprisindekseret offentlig vurdering). Stk. 3: fastholdt vurdering fra før 1. juli 2020. Prioritetsgæld fratrækkes til kursværdi. | Fanen *Primo & lån*: vurderingsprincip, vurdering, kursværdi. Noten *Beregning af andelsværdi*. Kontrolsiden advarer, hvis den vedtagne andelsværdi overstiger den beregnede maksimale værdi. |
| **Andelsboligforeningsloven § 6 (note om andelsværdi)** | Bestyrelsen skal i en note oplyse andelsværdien på balancedagen beregnet efter § 5 samt evt. vedtægtsbestemmelser om prisen. | Noten *Beregning af andelsværdi* med sammenligning til senest vedtagne værdi. |
| **Bekendtgørelse nr. 336 af 20. marts 2025** (om oplysningspligt ved salg af andelsboliger m.v. samt om bestyrelsens pligt til at fremlægge skema over centrale nøgleoplysninger; i kraft 1. juli 2025, afløser bek. nr. 2 af 6. januar 2015) | § 3: Nøgleoplysningerne i bilag 1 felt B1–B6, C1–C3, D1–D2, E1–E2, F1–F4, G1–G3, H1–H3, J, K1–K3, M1–M3 og R skal optages som noter til årsregnskabet. Nøgletal P (friværdi) er udgået. Ny mulighed for at angive nettoprisindekseret offentlig vurdering. Det tidligere bilag 4 (nøgleoplysninger til generalforsamlingen) er bortfaldet. | Fanen *Nøgleoplysninger* og noten *Nøgleoplysninger*. De beregnede felter (F2–F4, H1–H3, J, K1–K3, M1–M3, R for året) udregnes automatisk med formler. P kan medtages frivilligt. |
| **Erhvervsstyrelsens regnskabsvejledning for andelsboligforeninger (december 2021) og modelregnskab** | Anbefalet opstilling: resultatopgørelse med budgetkolonne, resultatdisponering (herunder betalte prioritetsafdrag), balance med egenkapital før og efter generalforsamlingsbestemte reserver, kortfristet del af prioritetsgæld, noter for hver post, pantsætninger og eventualforpligtelser. | Hele rapportopstillingen følger modelregnskabet og foreningens hidtidige årsrapport. |

## Bemærkninger til de nye felter i bilag 1

Bekendtgørelse nr. 336/2025 nummererer felterne C1–C3, E1–E2 og M1–M3. Programmet håndterer:

* **C1/C2**: fordelingstal ved andelsværdi og boligafgift (afkrydsning).
* **C3 og E2**: frie felter, hvor feltets ordlyd og svar indtastes, så teksten kan følge den til enhver tid gældende udgave af bilag 1.
* **M1/M2/M3**: vedligeholdelse løbende, genopretning/renovering og i alt (kr. pr. m² for tre år).

Ordlyden af C3 og E2 bør kontrolleres mod den aktuelle udgave af bilag 1 på retsinformation.dk (BEK nr. 336 af 20/03/2025), da programmet ikke kan hente bekendtgørelsen automatisk.

## Regnskabsprincipper i motoren

* **Kasseprincip med periodiseringer**: Alle ind- og udbetalinger indtastes i kasserapporten og konteres. Ikke-likvide posteringer (skyldige/forudbetalte beløb) indtastes som *reguleringer* med modpost i balancen.
* **Låneydelser** bogføres med det fulde beløb på lånets ydelseskonto. Renter og bidrag tages fra kreditforeningens betalingsplan (eller indtastes manuelt fra årsopgørelsen); afdraget beregnes som ydelser − renter. Restgæld ultimo = restgæld primo − afdrag. Kortfristet del = næste års afdrag iflg. betalingsplanen. Bogførte ydelser afstemmes mod planens terminer for året.
* **Resultatdisponering**: Årets resultat fordeles til generalforsamlingsbestemte reserver, betalte prioritetsafdrag (overføres til overført resultat) og restandel.
* **Ejendom**: kostpris + opskrivninger (dagsværdi). Opskrivninger føres direkte på egenkapitalen.
* **Balance**: Aktiver = passiver følger automatisk af, at primobalancen balancerer, og at alle posteringer er konteret. Kontrolsiden viser, hvor en eventuel difference stammer fra.

## Kilder

* Erhvervsstyrelsen: Regnskabsvejledning for andelsboligforeninger (december 2021) – https://erhvervsstyrelsen.dk/vejledning-regnskabsvejledning-andelsboligforeninger
* Erhvervsstyrelsen: Modelregnskab for andelsboligforeninger – https://erhvervsstyrelsen.dk/sites/default/files/2019-04/Modelregnskab_Andelsbolig.pdf
* BEK nr. 336 af 20/03/2025 – https://www.retsinformation.dk/eli/lta/2025/336
* Andelsboligforeningsloven § 5 og § 6 – https://danskelove.dk/andelsboligloven/5 og https://danskelove.dk/andelsboligloven/6
* ABF: Nøgleoplysningsskemaer ændres den 1. juli 2025 – https://www.abf-rep.dk/nyheder/nyheder/2025/nogleoplysning/
