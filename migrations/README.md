# Datenbankmigrationen

`005-create-empires.sql` legt das Startreich, seinen leeren Wissenscontainer und
die getrennte Controllerzuordnung (Lese- und Befehlsrecht) an.

`004-create-campaigns.sql` legt Kampagnenmetadaten, Besitzerzuordnung,
Idempotenzschlüssel und Teilnehmerberechtigung atomar an.

`003-create-sessions.sql` legt Session-ID, Accountbezug, Tokenhash, Ablauf,
`last_used_at` und Widerrufszeitpunkt an.

`002-create-accounts.sql` legt die lokale Accounttabelle mit stabilem,
öffentlichem Identifier und gespeichertem Argon2id-Hash an.

Versionierte PostgreSQL-SQL-Dateien werden durch `pnpm db:migrate` in einer
gemeinsamen Transaktion angewendet. `schema_migrations` speichert Version,
Namen und SHA-256-Prüfsumme; geänderte oder entfernte bereits angewendete
Migrationen werden abgelehnt. `pnpm db:migrate:check` prüft, ob alle Dateien
angewendet und unverändert sind.

| Datei                              | Verantwortung                                |
| ---------------------------------- | -------------------------------------------- |
| `001-create-schema-migrations.sql` | A0-Migrationsmetadaten ohne Gameplaytabellen |
| `004-create-campaigns.sql`         | A1-Kampagnen und Teilnehmerzuordnung         |
| `005-create-empires.sql`           | A1-Startreich und Controllerzuordnung        |

Die Architekturentscheidung steht in
[`docs/decisions/0005-a0-server-technologiestack.md`](../docs/decisions/0005-a0-server-technologiestack.md).
