# Kolonie-Anwendungsfälle

| Datei                  | Verantwortung                                                | Fachliche Quelle                                                                                          |
| ---------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [`ports.ts`](ports.ts) | Lesezugriff auf die persistierte Heimatkolonie eines Reiches | [`docs/docs/04-planets/planeten-und-kolonien.md`](../../../docs/docs/04-planets/planeten-und-kolonien.md) |

Die Heimatkolonie wird atomar mit Kampagne und Reich über den
[`CampaignRepository`](../campaigns/ports.ts) angelegt. Dieser Port stellt nur das
Nachladen der aktiven Heimatkolonie samt Heimatplanet bereit, damit ein Reload
denselben Startzustand ergibt.
