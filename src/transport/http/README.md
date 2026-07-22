# HTTP-Transport

Der HTTP-Adapter validiert Requests und Responses mit TypeBox und Fastify,
ruft Application-Use-Cases auf und übersetzt Ergebnisse bzw. Fehler. Er
enthält keine Fachlogik und importiert keine Infrastrukturadapter.

| Datei/Modul        | Verantwortung                                            | Fachliche Quelle                                                                                    |
| ------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `health-routes.ts` | Liveness-/Readiness-Antworten und HTTP-Statusübersetzung | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../../docs/contracts/rest-api/galaxis-rest-v1.md) |
