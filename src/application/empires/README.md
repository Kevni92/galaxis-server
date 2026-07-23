# Reichs-Anwendungsfälle

| Datei                  | Verantwortung                                       | Fachliche Quelle                                                                                                              |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [`ports.ts`](ports.ts) | Lesezugriff auf Reiche gemäß Controllerberechtigung | [`docs/docs/03-empires/controller-und-reichsuebernahme.md`](../../../docs/docs/03-empires/controller-und-reichsuebernahme.md) |

Die Reichserstellung selbst läuft atomar mit der Kampagne über den
[`CampaignRepository`](../campaigns/ports.ts). Dieser Port stellt nur das
controllergefilterte Lesen bereit; Befehlsrecht (`canControl`) bleibt vom
Leserecht (`canRead`) getrennt.
