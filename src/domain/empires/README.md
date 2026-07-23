# Reichsdomäne

| Datei                    | Verantwortung                                                            | Fachliche Quelle                                                                                |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`empire.ts`](empire.ts) | Reichsidentität, Status, leerer Wissenscontainer und Controllerzuordnung | [`docs/docs/03-empires/reichsverwaltung.md`](../../../docs/docs/03-empires/reichsverwaltung.md) |

Die Domäne enthält keine Persistenz-, HTTP- oder Node.js-Abhängigkeit. Controller
und Reich sind getrennte Begriffe; Lesen und Befehlen sind getrennte Rechte. Ein
Controllerwechsel ist niemals implizit (siehe
[`docs/docs/03-empires/controller-und-reichsuebernahme.md`](../../../docs/docs/03-empires/controller-und-reichsuebernahme.md)).
