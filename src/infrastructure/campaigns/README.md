# Kampagnenpersistenz

| Datei                              | Verantwortung                                                                                        | Fachliche Quelle                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`repository.ts`](repository.ts)   | Atomare Kampagnen-, Startreich- und Heimatkolonieerstellung, Idempotenz und accountgefiltertes Lesen | [`docs/docs/11-campaign/kampagnenstruktur.md`](../../../docs/docs/11-campaign/kampagnenstruktur.md)                       |
| [`state-store.ts`](state-store.ts) | Atomare Zustandsversion (Compare-and-Swap) und vollständiger A1-Schnappschuss-Reload                 | [`docs/decisions/0004-versionierte-balancing-schicht.md`](../../../docs/decisions/0004-versionierte-balancing-schicht.md) |

Der Adapter verwendet die Tabellen aus [`migrations/004-create-campaigns.sql`](../../../migrations/004-create-campaigns.sql), [`migrations/005-create-empires.sql`](../../../migrations/005-create-empires.sql), [`migrations/006-create-home-colonies.sql`](../../../migrations/006-create-home-colonies.sql) und [`migrations/007-create-start-population.sql`](../../../migrations/007-create-start-population.sql) und implementiert die Ports aus [`src/application/campaigns/ports.ts`](../../application/campaigns/ports.ts) und [`state-store.ts`](../../application/campaigns/state-store.ts). Das Lesen der Reiche liegt in [`src/infrastructure/empires/`](../empires/README.md), das Nachladen der Heimatkolonie in [`src/infrastructure/colonies/`](../colonies/README.md).

`KyselyCampaignStateStore.applyStateChange` erhöht `state_version` per bedingtem
`UPDATE ... WHERE state_version = <erwartet>` in einer Transaktion; ohne Treffer meldet
er `conflict` oder `not_found`. `loadSnapshot` rekonstruiert das vollständige
A1-Aggregat, sodass ein Neustart denselben sichtbaren Zustand liefert.
