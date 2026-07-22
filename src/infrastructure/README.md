# Infrastructure

Token- und Sessionpersistenz liegen unter [`sessions/`](sessions/README.md).

Accountadapter und Argon2id liegen unter [`accounts/`](accounts/README.md).

Die Runtime-Adapter unter [`runtime/`](runtime/README.md) sind die einzige
Stelle für Systemzeit und Node-Kryptografie.

Infrastrukturadapter kapseln technische Bibliotheken und externe Systeme.
Sie implementieren Ports aus Application oder Domain und definieren keine
neuen Spielregeln.

| Bereich     | Verantwortung                                          | Navigation                         |
| ----------- | ------------------------------------------------------ | ---------------------------------- |
| `balancing` | versionierte Validierung und kanonischer Hash          | [`README.md`](balancing/README.md) |
| `config`    | validierte Laufzeitkonfiguration                       | [`README.md`](config/README.md)    |
| `database`  | PostgreSQL-Pool, Kysely und transaktionale Migrationen | [`README.md`](database/README.md)  |
| `logging`   | Pino-Adapter                                           | [`README.md`](logging/README.md)   |
| `runtime`   | Produktions- und Fake-Adapter für Zeit, Zufall und IDs | [`README.md`](runtime/README.md)   |
