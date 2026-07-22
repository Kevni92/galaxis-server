# HTTP-Transport

Der HTTP-Adapter validiert Requests und Responses mit TypeBox und Fastify,
ruft Application-Use-Cases auf und übersetzt Ergebnisse bzw. Fehler. Er
enthält keine Fachlogik und importiert keine Infrastrukturadapter.

| Datei/Modul        | Verantwortung                                                    | Fachliche Quelle                                                                                        |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `health-routes.ts` | Liveness-/Readiness-Antworten und HTTP-Statusübersetzung         | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../../docs/contracts/rest-api/galaxis-rest-v1.md)     |
| `error-handler.ts` | Korrelation, UTF-8-/Requestprüfung und sichere Fehlerübersetzung | [`docs/contracts/rest-api/galaxis-rest-v1.yaml`](../../../docs/contracts/rest-api/galaxis-rest-v1.yaml) |

Die Instanz verwendet den TypeBox-Type-Provider. Transportfehler verwenden die
gemeinsame Fehlerform aus dem REST-Vertrag; unerwartete Ausnahmen werden mit
`INTERNAL_ERROR` und ohne interne Details beantwortet.
