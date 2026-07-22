# Infrastructure

Die Runtime-Adapter unter [`runtime/`](runtime/README.md) sind die einzige
Stelle für Systemzeit und Node-Kryptografie.

Infrastrukturadapter kapseln technische Bibliotheken und externe Systeme.
Sie implementieren Ports aus Application oder Domain und definieren keine
neuen Spielregeln.

| Bereich     | Verantwortung                                  | Navigation                         |
| ----------- | ---------------------------------------------- | ---------------------------------- |
| `balancing` | später versionierte, validierte Balancingdaten | [`README.md`](balancing/README.md) |
| `config`    | später validierte Laufzeitkonfiguration        | [`README.md`](config/README.md)    |
| `database`  | später PostgreSQL, Kysely und Migrationen      | [`README.md`](database/README.md)  |
| `logging`   | später Pino-Adapter                            | [`README.md`](logging/README.md)   |
