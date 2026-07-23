# Kampagnenpersistenz

| Datei                            | Verantwortung                                                                                        | Fachliche Quelle                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`repository.ts`](repository.ts) | Atomare Kampagnen-, Startreich- und Heimatkolonieerstellung, Idempotenz und accountgefiltertes Lesen | [`docs/docs/11-campaign/kampagnenstruktur.md`](../../../docs/docs/11-campaign/kampagnenstruktur.md) |

Der Adapter verwendet die Tabellen aus [`migrations/004-create-campaigns.sql`](../../../migrations/004-create-campaigns.sql), [`migrations/005-create-empires.sql`](../../../migrations/005-create-empires.sql) und [`migrations/006-create-home-colonies.sql`](../../../migrations/006-create-home-colonies.sql) und implementiert den Port aus [`src/application/campaigns/ports.ts`](../../application/campaigns/ports.ts). Das Lesen der Reiche liegt in [`src/infrastructure/empires/`](../empires/README.md), das Nachladen der Heimatkolonie in [`src/infrastructure/colonies/`](../colonies/README.md).
