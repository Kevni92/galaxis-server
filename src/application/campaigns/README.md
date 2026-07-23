# Kampagnen-Anwendungsfälle

Der Create-Anwendungsfall validiert vor der Persistenz die deterministische
Startgalaxie über den Generatorport und legt in derselben Transaktion das
Startreich mit Controllerzuordnung an.

| Datei                      | Verantwortung                                              | Fachliche Quelle                                                                                    |
| -------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`service.ts`](service.ts) | Create/List/Get, Startreich, Idempotenz und Accountzugriff | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../../docs/contracts/rest-api/galaxis-rest-v1.md) |
| [`ports.ts`](ports.ts)     | Atomarer Persistenzport für Kampagne, Teilnehmer und Reich | [`docs/docs/11-campaign/kampagnenstruktur.md`](../../../docs/docs/11-campaign/kampagnenstruktur.md) |

Der Service kennt weder HTTP noch SQL. Balancingversion und Hash kommen über
den injizierten Loader; Zeit und IDs kommen über deterministisch ersetzbare Ports.
