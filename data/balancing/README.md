# Balancing-Daten

`manifest.json` ist der versionierte Datenstand für den Loader. Er enthält die
gemeinsame Version, Katalogversion, registrierten Einheiten, Quellen und die
produktiven Parameter. Vollständige B1-Kataloge (Güter, Gebäude, Technologien)
entstehen in den dafür vorgesehenen Alpha-Issues.

| Datei                            | Verantwortung                                             | Fachliche Quelle                                        |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| [`manifest.json`](manifest.json) | Version, Katalogversion, Einheiten, Quellen und Parameter | [`data-format.md`](../../docs/balancing/data-format.md) |

## Startbaseline (GAL-POP-START-001)

Die Startwerte der Heimatkolonie stammen ausschließlich aus diesen Parametern:

| Parameter                             | Einheit               | Bedeutung                                                     |
| ------------------------------------- | --------------------- | ------------------------------------------------------------- |
| `start_population_total`              | `population_units`    | Aggregierte Startbevölkerung                                  |
| `start_population_employable_share`   | `basis_points`        | Erwerbsfähiger Anteil der Gesamtbevölkerung                   |
| `start_employment_share`              | `basis_points`        | Beschäftigter Anteil der erwerbsfähigen Bevölkerung           |
| `essential_reserve_target_days`       | `campaign_days`       | Startreserve essentieller Grundversorgung in Versorgungstagen |
| `essential_daily_consumption_per_pop` | `quantity_milliunits` | Essentieller Tagesbedarf je Populationseinheit                |

Der essentielle Startbestand ergibt sich deterministisch als
`Bevölkerung × Tagesbedarf × Reservetage`. Die Werte konkretisieren die
dokumentierten Zielkorridore (mind. 7 Versorgungstage, Beschäftigung 90–98 %) und
verändern keine Fachregel.
