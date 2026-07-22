# Domain

Die Domain kapselt später Fachmodelle, Invarianten und deterministische
Berechnungen. Sie kennt weder Transport, Persistenz, Konfiguration noch
Node.js-APIs. Zeit, IDs und Simulationszufall werden über Ports injiziert.

| Datei/Modul | Verantwortung | Fachliche Quelle |
|---|---|---|
| spätere Domainmodule | Fachliche Wahrheit und Invarianten | [`docs/decisions/0005-a0-server-technologiestack.md`](../../docs/decisions/0005-a0-server-technologiestack.md) |

Gameplay- und Kampagnenregeln gehören nicht zu Issue #1.
