# Vedtægterne og regnskabet

Fanen **Aktuelle vedtægter** viser vedtægterne (PDF i `arkiv/vedtaegter.pdf`), de regnskabsrelevante bestemmelser (`arkiv/vedtaegter.json`) og et automatisk vedtægtstjek af det valgte regnskabsår (`js/vedtaegter.js`).

## Vedtægtstjekket

| Paragraf | Kontrol | Status ved afvigelse |
|---|---|---|
| § 30, stk. 1 | Regnskabsår = kalenderår; hele bestyrelsen underskriver | – |
| § 26 / § 28 | Mindst 3 bestyrelsesmedlemmer; formand og kasserer i påtegningen | Fejl / advarsel |
| § 31, stk. 1 | Bilagskontrollører angivet og ikke medlem af bestyrelsen | Fejl |
| § 21, stk. 2 | Ordinær generalforsamling senest 30. april | Fejl |
| § 22, stk. 1 og § 31, stk. 2 | Årsrapport underskrevet mindst 14 dage før generalforsamlingen (udsendes med indkaldelsen) | Advarsel |
| § 4, stk. 1 | Indskud 85.800 kr. pr. andel | Advarsel |
| § 6, stk. 1 og § 8, stk. 2 | Fordelingstal = indskud (C1/C2) | Fejl |
| § 14, stk. 1, litra a / § 30, stk. 2 | Vedtaget andelsværdi ≤ beregnet maksimum; forslag som note | Fejl |
| § 30, stk. 3 | Henlæggelse til fonden hvert år; ved 0 kr. skal generalforsamlingens begrundelse fremgå | Advarsel (begrundet) / fejl (ubegrundet) |
| § 11, stk. 2, litra h | 20.000 kr. depositum pr. fremlejet bolig på lukket konto | Advarsel |
| § 29, stk. 3 | Kontantbeholdning under 5.000 kr. | Advarsel |
| § 29, stk. 5 | Forsikringssum for bestyrelsesansvar/besvigelse oplyst i note | Fejl |
| § 5, stk. 2 | Hæftelse (E1) – bestyrelsen bekræfter kreditors forbehold | Info |
| § 8, stk. 4 | Boligafgift betalt forud; restancer | Advarsel |

Resultatet indgår i den supplerende beretning (vurderingssiden): fejl giver et advarselstegn, bemærkninger et opmærksomhedspunkt.

## Ændringer i regnskabet som følge af vedtægterne

* **Henlæggelser (§ 30, stk. 3)**: Regnskabspraksis beskriver fonden. Noten om reserve til vedligeholdelse viser generalforsamlingens beslutning og begrundelse (tekstfeltet "Henlæggelser til vedligeholdelse" under Tekster). Budgettet har en linje til næste års henlæggelse. Reserver holdes uden for andelsværdien.
* **Forbedringer (§ 10 og § 14)**: Regnskabspraksis og andelsværdinoten forklarer, at andelshavernes egne forbedringer ikke indgår i balancen eller andelsværdien, og hvordan de værdiansættes ved overdragelse (anskaffelsespris med fradrag efter ABF's forbedringskatalog og værdiforringelseskurver, eget arbejde til svendeløn, opgørelse af fraflytter, voldgift ved uenighed).
* **Forsikringer (§ 29, stk. 5)**: Ny note "Forsikringer" med forsikringssummer, indtastet under Stamdata.
* **Fremleje (§ 11)**: Antal fremlejede boliger under Stamdata; depositum afstemmes mod 20.000 kr. pr. bolig.

## Polarvej I, 2025

Vedtægtstjekket for 2025 viser én fejl og to bemærkninger: forsikringssummen for bestyrelsesansvars- og besvigelsesforsikring er ikke oplyst (skal indtastes eller det skal oplyses, at forsikringen ikke er tegnet); årsrapporten var underskrevet 7 dage før generalforsamlingen (kravet er 14 dage med indkaldelsen); og henlæggelsen er 0 kr. med begrundelse i § 9 (andelshaverne vedligeholder selv).
