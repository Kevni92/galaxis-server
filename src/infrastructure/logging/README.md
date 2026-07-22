# Logging-Adapter

Dieser Bereich kapselt Pino, ISO-Zeitstempel, Komponentenfelder,
Request-Korrelation und Redaction. Geheimnisse werden weder geloggt noch in
Fehlerantworten aufgenommen.

| Datei/Modul | Verantwortung                                         | Fachliche Quelle                                                                                    |
| ----------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `logger.ts` | Pino-Erzeugung und redigierte Konfigurationsmetadaten | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../../docs/contracts/rest-api/galaxis-rest-v1.md) |
