# Sessionadapter

Die technischen Sessionadapter erzeugen opake Zufallstokens, hashen sie mit
SHA-256 und persistieren nur den Hash sowie Ablauf- und Widerrufszustände.

| Datei                                      | Verantwortung                            | Fachliche Quelle                                                                                                  |
| ------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`token-generator.ts`](token-generator.ts) | kryptografisches Token und SHA-256-Hash  | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
| [`repository.ts`](repository.ts)           | Kysely-Lookup, `lastUsedAt` und Widerruf | [`docs/contracts/rest-api/galaxis-rest-v1.yaml`](../../../docs/contracts/rest-api/galaxis-rest-v1.yaml)           |
