# Konfigurationsadapter

Dieser Bereich kapselt TypeBox-Schemas und den einzigen Zugriff auf
`process.env`. Konfiguration wird einmalig geladen, validiert und danach als
unveränderliches Objekt weitergereicht. Datenbank-URLs werden niemals in
Log-Metadaten übernommen.

| Datei/Modul | Verantwortung                                                           | Fachliche Quelle                                                                                                  |
| ----------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `config.ts` | Environment-Mapping, TypeBox-Validierung und redigierbare Konfiguration | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
