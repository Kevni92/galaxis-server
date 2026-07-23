# Kampagnendomäne

| Datei                        | Verantwortung                                                            | Fachliche Quelle                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [`campaign.ts`](campaign.ts) | Kampagnenidentität, Status und Erstellungsinvarianten                    | [`docs/docs/11-campaign/kampagnenstruktur.md`](../../../docs/docs/11-campaign/kampagnenstruktur.md)                       |
| [`state.ts`](state.ts)       | Optimistic-Concurrency-Übergang und Balancing-Ladevalidierung des Kopfes | [`docs/decisions/0004-versionierte-balancing-schicht.md`](../../../docs/decisions/0004-versionierte-balancing-schicht.md) |

`nextStateVersion` erhöht die Version genau um eins und nur bei passender
Ausgangsversion; sonst liegt ein `StateVersionConflictError` vor.
`validateCampaignLoad` prüft eine geladene Kampagne gegen die aktuell geladene
Balancingidentität, damit eine laufende Kampagne nicht stillschweigend auf neue
Werte wechselt. Die Domäne enthält keine Persistenz-, HTTP-, Node.js- oder
Systemzeitabhängigkeit.
