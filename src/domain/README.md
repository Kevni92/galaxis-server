# Domain

[`sessions/session.ts`](sessions/session.ts) beschreibt den technikneutralen
Sessionzustand ohne Token- oder Datenbankimplementierung.

[`campaigns/campaign.ts`](campaigns/campaign.ts) beschreibt die Kampagnenmetadaten
und Erstellungsinvarianten. Startreich, Galaxie und Kolonie werden in folgenden
A1-Issues ergänzt.

Die lokale Accountregistrierung verwendet [`accounts/account.ts`](accounts/account.ts)
für ein normalisiertes, technikfreies Accountmodell.

Die Domain kapselt später Fachmodelle, Invarianten und deterministische
Berechnungen. Sie kennt weder Transport, Persistenz, Konfiguration noch
Node.js-APIs. Zeit, IDs und Simulationszufall werden über Ports injiziert.

| Datei/Modul             | Verantwortung                             | Fachliche Quelle                                                                                               |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `errors.ts`             | Fachliche Fehlercodes ohne HTTP-Details   | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../docs/contracts/rest-api/galaxis-rest-v1.md)               |
| `campaigns/campaign.ts` | Kampagnenidentität und Create-Invarianten | [`docs/docs/11-campaign/kampagnenstruktur.md`](../../docs/docs/11-campaign/kampagnenstruktur.md)               |
| spätere Domainmodule    | Fachliche Wahrheit und Invarianten        | [`docs/decisions/0005-a0-server-technologiestack.md`](../../docs/decisions/0005-a0-server-technologiestack.md) |

Gameplay- und Kampagnenregeln gehören nicht zu Issue #1.
