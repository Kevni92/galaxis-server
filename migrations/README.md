# Datenbankmigrationen

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

Die Architekturentscheidung steht in
[`docs/decisions/0005-a0-server-technologiestack.md`](../docs/decisions/0005-a0-server-technologiestack.md).
