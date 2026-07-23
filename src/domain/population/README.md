# Bevölkerungs- und Grundversorgungsdomäne

| Datei                                    | Verantwortung                                                                                       | Fachliche Quelle                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`start-baseline.ts`](start-baseline.ts) | Aggregierte Startbevölkerungsgruppe, essentieller Startbestand, Ableitung und Erhaltungsinvarianten | [`docs/docs/05-population/bevoelkerung-und-arbeit.md`](../../../docs/docs/05-population/bevoelkerung-und-arbeit.md) |

Genau eine neutrale Bevölkerungsgruppe je Heimatkolonie führt Gesamtbevölkerung,
erwerbsfähigen und beschäftigten Anteil als geschachtelte, mengenerhaltende Teilmengen
ohne Doppelzählung. Der essentielle Startbestand deckt die dokumentierte Mindestreserve
(`Bevölkerung × Tagesbedarf × Reservetage`) und ist im Startzustand nicht reserviert.

Alle Startwerte werden deterministisch aus versionierten Balancingdaten abgeleitet
(`start_population_total`, `start_population_employable_share`, `start_employment_share`,
`essential_reserve_target_days`, `essential_daily_consumption_per_pop`). Teilmengen werden
abgerundet, damit Rundung niemals Bevölkerung erzeugt. Die Domäne kennt weder Persistenz
noch HTTP und führt bewusst keine Wachstums-, Verbrauchs- oder Migrationssimulation (A5/A6).
