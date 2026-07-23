# A1-Zustandsabfragen

| Datei                      | Verantwortung                                                                                 | Fachliche Quelle                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`service.ts`](service.ts) | Gefilterte Lesezustände: Kampagnenübersicht, bekannte Galaxie, Systemdetail, Kolonieübersicht | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../../docs/contracts/rest-api/galaxis-rest-v1.md) |

Der `StateQueryService` komponiert bestehende Repositories
([`CampaignRepository`](../campaigns/ports.ts), [`EmpireRepository`](../empires/ports.ts),
[`ColonyRepository`](../colonies/ports.ts)) und den [`GalaxyGenerator`](../galaxy/ports.ts).
Jede Antwort ist nach Session, Kampagnenzugriff und Reichswissen gefiltert.

Die Galaxie wird deterministisch aus dem Kampagnenseed rekonstruiert; in A1 gibt es
keine Galaxiepersistenz. Nur Systeme aus `knownSystemIds` werden ausgegeben,
Verbindungen nur bei zwei bekannten Endpunkten. Ein unbekanntes oder nicht
existierendes System ist ununterscheidbar (`RESOURCE_NOT_FOUND`), damit kein
Informationsleck entsteht. `stateVersion` bildet die Grundlage für den schwachen
ETag der Lese-Endpunkte.
