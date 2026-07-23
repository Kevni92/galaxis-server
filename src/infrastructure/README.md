# Infrastructure

Der deterministische Galaxiegenerator liegt unter
[`galaxy/`](galaxy/README.md) und verwendet den injizierten
Simulationszufall sowie einen technischen SHA-256-Hash.

Token- und Sessionpersistenz liegen unter [`sessions/`](sessions/README.md).

Kampagnenpersistenz liegt unter [`campaigns/`](campaigns/README.md) und schreibt
Kampagne, Besitzerteilnehmer, Startreich, Controllerzuordnung sowie Heimatplanet
und aktive Heimatkolonie in einer Transaktion.

Reichspersistenz und controllergefiltertes Lesen liegen unter
[`empires/`](empires/README.md).

Kolonie- und Planetenpersistenz mit Nachladen der Heimatkolonie liegen unter
[`colonies/`](colonies/README.md).

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
