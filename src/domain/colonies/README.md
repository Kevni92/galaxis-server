# Koloniedomäne

| Datei                    | Verantwortung                                                                        | Fachliche Quelle                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [`colony.ts`](colony.ts) | Heimatplanet, aktive Heimatkolonie, neutraler Startzustand und Konsistenzinvarianten | [`docs/docs/04-planets/planeten-und-kolonien.md`](../../../docs/docs/04-planets/planeten-und-kolonien.md) |

Die Heimatkolonie startet als etablierte (`etabliert`), neutrale (`neutral`)
Kolonie ohne Bauaufträge oder Schiffe. `assertHomeColonyConsistency` sichert, dass
der Heimatplanet dem Reich gehört, im Heimatsystem liegt und genau die Kolonie
trägt, die dasselbe Reich und System nennt. Die Domäne kennt weder Persistenz noch
HTTP; Kategorie und Größe des Planeten stammen aus der Galaxiedomäne.
