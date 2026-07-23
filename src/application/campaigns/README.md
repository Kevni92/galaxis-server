# Kampagnen-Anwendungsfälle

Der Create-Anwendungsfall validiert vor der Persistenz die deterministische
Startgalaxie über den Generatorport und legt in derselben Transaktion das
Startreich mit Controllerzuordnung sowie Heimatplanet und aktive Heimatkolonie an.
Das Reichswissen nennt genau das besessene Heimatsystem und den Heimatplaneten.

| Datei                      | Verantwortung                                                       | Fachliche Quelle                                                                                    |
| -------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`service.ts`](service.ts) | Create/List/Get, Startreich, Heimatkolonie, Idempotenz und Zugriff  | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../../docs/contracts/rest-api/galaxis-rest-v1.md) |
| [`ports.ts`](ports.ts)     | Atomarer Persistenzport für Kampagne, Teilnehmer, Reich und Kolonie | [`docs/docs/11-campaign/kampagnenstruktur.md`](../../../docs/docs/11-campaign/kampagnenstruktur.md) |

Der Service kennt weder HTTP noch SQL. Balancingversion und Hash kommen über
den injizierten Loader; Zeit und IDs kommen über deterministisch ersetzbare Ports.
