# Datenbankadapter

Issue #7 ergänzt die Sessiontabelle in `003-create-sessions.sql`.

Die Accounttabelle und ihr Kysely-Repository gehören zu Issue #6;
die zugehörige Migration ist `002-create-accounts.sql`.

Dieser Bereich kapselt PostgreSQL, `pg`, Kysely und den Migrationszugriff.
Datenbanktypen dürfen nicht in Domain- oder Applicationobjekte durchsickern.

| Datei/Modul     | Verantwortung                                                | Fachliche Quelle                                                                                                  |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `database.ts`   | Pool, Kysely-Dialect, Readiness und geordneter Shutdown      | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
| `migrations.ts` | Dateiprüfung, transaktionale Anwendung und Integritätschecks | [`docs/TESTING.md`](../../../docs/TESTING.md)                                                                     |
| `readiness.ts`  | Application-Readinessprobe für PostgreSQL                    | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
| `migrate.ts`    | CLI für `pnpm db:migrate` und `pnpm db:migrate:check`        | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
