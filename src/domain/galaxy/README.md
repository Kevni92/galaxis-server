# Galaxie-Domäne

| Datei                    | Verantwortung                                                                                    | Fachliche Quelle                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| [`galaxy.ts`](galaxy.ts) | Generierungsprofile, statische Galaxieobjekte, autoritative lokale XY-Positionen und Invarianten | [`galaxiestruktur-und-generierung.md`](../../../docs/docs/02-galaxy/galaxiestruktur-und-generierung.md) |

Die Domäne kennt weder HTTP noch Persistenz oder technische Zufallsquellen. Der Generator erhält seinen Zufallsstrom über einen injizierten Port.
