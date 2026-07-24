# Tests

Tests bleiben deterministisch und risikobasiert. Unit-Tests benoetigen keine
echte Datenbank und keinen laufenden Webserver; Integrations- und
Contract-Tests verwenden ihre jeweils dokumentierte technische Umgebung.

| Bereich       | Zweck                                                                        | Einstieg                             |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| `unit`        | Konfiguration, Logging, Health, Shutdown und Applicationlogik                | [`README.md`](unit/README.md)        |
| `integration` | REST-Adapter und PostgreSQL-Adapter                                          | [`README.md`](integration/README.md) |
| `contract`    | OpenAPI-Struktur, TypeBox-Abgleich und A0-/A1-REST-Abläufe gegen den Vertrag | [`README.md`](contract/README.md)    |
| `fixtures`    | kontrollierte Testdaten, feste Seeds und gemeinsame Testpfade                | [`README.md`](fixtures/README.md)    |

Die Teststufen folgen [`docs/TESTING.md`](../docs/TESTING.md).
