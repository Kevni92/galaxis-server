# Bevölkerungs- und Grundversorgungs-Anwendungsfälle

| Datei                                    | Verantwortung                                                                                       | Fachliche Quelle                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`start-baseline.ts`](start-baseline.ts) | Liest die versionierten Startwerte und baut die Startbaseline genau einer Heimatkolonie             | [`docs/docs/05-population/bevoelkerung-und-arbeit.md`](../../../docs/docs/05-population/bevoelkerung-und-arbeit.md) |
| [`ports.ts`](ports.ts)                   | Lesezugriff auf die persistierte Startbaseline (Bevölkerung und essentieller Bestand) eines Reiches | [`docs/docs/06-economy/wirtschaft-und-versorgung.md`](../../../docs/docs/06-economy/wirtschaft-und-versorgung.md)   |
| [`service.ts`](service.ts)               | Entscheidungsrelevante Bevölkerungs- und Wirtschaftszusammenfassungen mit Lesezugriffsprüfung       | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../../docs/contracts/rest-api/galaxis-rest-v1.md)                 |

Die Startbaseline wird bei der Kampagnenerstellung atomar mit Kampagne, Reich und
Heimatkolonie über den [`CampaignRepository`](../campaigns/ports.ts) angelegt. Alle
Startwerte stammen ausschließlich aus versionierten Balancingdaten. Der
`PopulationService` prüft jeden Zugriff zuerst gegen den Lesezugriff des Reiches
([`EmpireRepository`](../empires/ports.ts)); Befehlsrecht bleibt getrennt. Es findet
bewusst keine Wachstums-, Verbrauchs- oder Migrationssimulation statt (A5/A6).
