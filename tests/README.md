# Tests

Tests bleiben deterministisch und risikobasiert. Unit-Tests benötigen keine
echte Datenbank und keinen laufenden Webserver; Integrations- und
Contract-Tests werden erst mit den jeweiligen technischen Modulen ergänzt.

| Bereich       | Zweck                                                                         | Einstieg                             |
| ------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| `unit`        | Konfiguration, Logging, Health, Shutdown und spätere Domain-/Applicationlogik | [`README.md`](unit/README.md)        |
| `integration` | echtes Zusammenspiel, später einschließlich PostgreSQL                        | [`README.md`](integration/README.md) |
| `contract`    | Prüfung gegen freigegebene REST-Verträge                                      | [`README.md`](contract/README.md)    |
| `fixtures`    | kontrollierte Testdaten und feste Seeds                                       | [`README.md`](fixtures/README.md)    |

Die Teststufen folgen [`docs/TESTING.md`](../docs/TESTING.md).
