# Kolonie-Persistenz

| Datei                            | Verantwortung                                                     | Fachliche Quelle                                                                                          |
| -------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`repository.ts`](repository.ts) | Lädt die persistierte Heimatkolonie samt Heimatplanet unverändert | [`docs/docs/04-planets/planeten-und-kolonien.md`](../../../docs/docs/04-planets/planeten-und-kolonien.md) |

Das Einfügen von Planet und Kolonie erfolgt in derselben Transaktion wie Kampagne
und Reich (siehe [`campaigns/repository.ts`](../campaigns/repository.ts)); ein
Fehler hinterlässt keine halbfertige Kampagne. Dieser Adapter liest nur, sodass
`findHomeColonyForEmpire` den Startzustand nach Reload identisch zurückgibt.
