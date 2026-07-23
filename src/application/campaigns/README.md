# Kampagnen-Anwendungsfälle

| Datei                      | Verantwortung                                  | Fachliche Quelle                                                                                    |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`service.ts`](service.ts) | Create/List/Get, Idempotenz und Accountzugriff | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../../docs/contracts/rest-api/galaxis-rest-v1.md) |
| [`ports.ts`](ports.ts)     | Persistenzport für Kampagnen und Teilnehmer    | [`docs/docs/11-campaign/kampagnenstruktur.md`](../../../docs/docs/11-campaign/kampagnenstruktur.md) |

Der Service kennt weder HTTP noch SQL. Balancingversion und Hash kommen über
den injizierten Loader; Zeit und IDs kommen über deterministisch ersetzbare Ports.
