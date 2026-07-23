# Kampagnenpersistenz

| Datei                            | Verantwortung                                                        | Fachliche Quelle                                                                                    |
| -------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`repository.ts`](repository.ts) | Atomare Kampagnenerstellung, Idempotenz und accountgefiltertes Lesen | [`docs/docs/11-campaign/kampagnenstruktur.md`](../../../docs/docs/11-campaign/kampagnenstruktur.md) |

Der Adapter verwendet die Tabellen aus [`migrations/004-create-campaigns.sql`](../../../migrations/004-create-campaigns.sql) und implementiert den Port aus [`src/application/campaigns/ports.ts`](../../application/campaigns/ports.ts).
