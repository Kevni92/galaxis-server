# Reichspersistenz

| Datei                            | Verantwortung                                         | Fachliche Quelle                                                                                |
| -------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`repository.ts`](repository.ts) | Controllergefiltertes Lesen von Reichen und Zuordnung | [`docs/docs/03-empires/reichsverwaltung.md`](../../../docs/docs/03-empires/reichsverwaltung.md) |

Die Reichszeilen entstehen atomar mit der Kampagne im
[`KyselyCampaignRepository`](../campaigns/repository.ts). Dieser Adapter liest
Reiche über die Tabellen aus
[`migrations/005-create-empires.sql`](../../../migrations/005-create-empires.sql)
und implementiert den Port aus
[`src/application/empires/ports.ts`](../../application/empires/ports.ts).
