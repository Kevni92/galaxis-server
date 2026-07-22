# HTTP-Transport

Der HTTP-Adapter validiert später Requests und Responses mit TypeBox und
Fastify, ruft Application-Use-Cases auf und übersetzt Ergebnisse bzw. Fehler.
Er enthält keine Fachlogik und importiert keine Infrastrukturadapter.

| Datei/Modul                | Verantwortung          | Fachliche Quelle                                                                                                  |
| -------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| spätere Router und Handler | HTTP-/JSON-Übersetzung | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
