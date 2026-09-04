# Vurdering af regnskabets robusthed (supplerende beretning, sidste side i årsrapporten)

Siden er markeret som supplerende beretning efter årsregnskabslovens § 14: den er tydeligt adskilt fra årsregnskabet og omfattes ikke af bilagskontrollørernes erklæring.

Siden genereres automatisk af `js/vurdering.js` ud fra regnskabets tal og deles i tre kategorier:

* **Styrker** (grøn)
* **Punkter andelshaverne bør være opmærksomme på** (gul)
* **Advarselstegn om regnskabets robusthed** (rød)

Øverst står en samlet konklusion: *Robust* (ingen røde, højst tre gule), *Robust med opmærksomhedspunkter* (ingen røde, flere gule) eller *Advarselstegn* (mindst ét rødt punkt).

## Punkter og grænseværdier

Grænseværdierne står i `GRAENSER` i `js/vurdering.js` og er inspireret af ABF's og Erhvervsstyrelsens nøgletal for andelsboligforeninger.

| Punkt | Grøn | Gul | Rød |
|---|---|---|---|
| Afstemning | Alle kontroller på kontrolsiden er OK | | Mindst én kontrol fejler |
| Belåning (gæld i % af ejendommens regnskabsmæssige værdi) | ≤ 50 % | 50–80 % | > 80 % |
| Gæld pr. m² (nøgletal K2: gæld − omsætningsaktiver pr. m² andelsbolig) | ≤ 5.000 kr. | 5.000–15.000 kr. | > 15.000 kr. |
| Likviditet (frie likvide beholdninger i måneders drifts-, finans- og afdragsudgifter; deponeret depositum regnes ikke med) | ≥ 6 mdr. | 3–6 mdr. | < 3 mdr. |
| Dækker boligafgiften drift og afdrag? | Rest efter afdrag ≥ 0 | Resultat ≥ 0, men rest efter afdrag < 0 | Underskud |
| Låneydelser i % af boligafgiften | ≤ 40 % | 40–60 % | > 60 % |
| Lånevilkår | Betalingsplan indlæst (fast ydelse, kendt restløbetid) | Ingen betalingsplan (vilkår fremgår ikke) | |
| Vedligeholdelse og henlæggelser | Gennemsnit ≥ 50 kr. pr. m² de sidste tre år, eller henlæggelser > 0 | Under 50 kr. pr. m² og ingen henlæggelser | |
| Andelsværdi | Vedtaget ≤ maksimum med ≥ 5 % buffer | Buffer < 5 % | Vedtaget > lovligt maksimum (ABL § 5) |
| Vurderingsgrundlag | Offentlig vurdering ≤ 4 år gammel | Offentlig vurdering > 4 år gammel, eller valuarvurdering | |
| Restancer på boligafgift pr. 31/12 | Ingen | Restancer ≤ 3 måneders afgift | Restancer > 3 måneders afgift |
| Foreningens størrelse | > 12 andele | ≤ 12 andele (sårbar over for enkeltrestancer) | |
| Hæftelse (E1) | Begrænset til indskud | Personlig hæftelse | |
| Offentligt tilskud (G1) | | Tilbagebetalingspligt ved opløsning | |
| Budget næste år | Rest efter afdrag ≥ 0 | Rest efter afdrag < 0 | Underskud |

Siden er en hjælp til andelshaverne og erstatter ikke bestyrelsens eller en revisors vurdering. Teksten øverst på siden gør opmærksom på det.

## Polarvej I, 2025

Resultatet for 2025 er *Robust med opmærksomhedspunkter*: 10 styrker (afstemt regnskab, belåning 5,8 %, 414 kr. gæld pr. m², 12 måneders likviditet, boligafgiften dækker drift og afdrag, låneydelser 32 % af boligafgiften, fastforrentet lån med afdrag, ingen restancer, begrænset hæftelse, budget hænger sammen), 5 opmærksomhedspunkter (lav vedligeholdelse uden henlæggelser i en 42 år gammel ejendom, kun 1,6 % buffer i andelsværdien, ejendomsvurdering fra 2017, kun 8 andele, tilbagebetalingspligtig ydelsesstøtte) og ingen advarselstegn.
