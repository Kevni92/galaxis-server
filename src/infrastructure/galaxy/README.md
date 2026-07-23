# Galaxiegenerator

| Datei                          | Verantwortung                                                           | Fachliche Quelle                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`generator.ts`](generator.ts) | Erzeugt, validiert und hasht die minimale deterministische Startgalaxie | [`galaxiestruktur-und-generierung.md`](../../../docs/docs/02-galaxy/galaxiestruktur-und-generierung.md) |

Der Adapter verwendet keinen HTTP- oder Datenbankzugriff. Der Simulationszufall wird als benannter Stream erzeugt; der Hash wird ausschließlich für Reproduzierbarkeit und Testberichte berechnet.
