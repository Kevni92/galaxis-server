# Bevölkerungs- und Grundversorgungs-Persistenz

| Datei                            | Verantwortung                                                                                 | Fachliche Quelle                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`repository.ts`](repository.ts) | Lädt die persistierte Startbaseline (Bevölkerungsgruppe und essentieller Bestand) unverändert | [`docs/docs/05-population/bevoelkerung-und-arbeit.md`](../../../docs/docs/05-population/bevoelkerung-und-arbeit.md) |

Das Einfügen von Bevölkerungsgruppe und essentiellem Bestand erfolgt in derselben
Transaktion wie Kampagne, Reich und Heimatkolonie (siehe
[`campaigns/repository.ts`](../campaigns/repository.ts)); ein Fehler hinterlässt keine
halbfertige Kampagne. Dieser Adapter liest nur, sodass `findHomeColonyBaseline` den
Startzustand nach Reload identisch zurückgibt. Erhaltungs- und Einheitenregeln werden
zusätzlich in der Datenbank per `CHECK`-Bedingung abgesichert.
