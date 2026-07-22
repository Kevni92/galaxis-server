# Accountadapter

Die Adapter implementieren die Account-Ports der Application-Schicht. Argon2id
bleibt auf diesen technischen Adapter begrenzt; das Repository schreibt nur
normalisierte Kennungen und den Hash in PostgreSQL.

| Datei                                      | Verantwortung                                     | Fachliche Quelle                                                                                                  |
| ------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`password-hasher.ts`](password-hasher.ts) | zentral konfigurierbares Argon2id-Passworthashing | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
| [`repository.ts`](repository.ts)           | Kysely-Insert mit sicherer Duplikatbehandlung     | [`docs/contracts/rest-api/galaxis-rest-v1.yaml`](../../../docs/contracts/rest-api/galaxis-rest-v1.yaml)           |
