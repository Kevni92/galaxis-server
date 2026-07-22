# Application

Die Application-Schicht orchestriert Anwendungsfälle, Ports und
Transaktionsgrenzen. Sie übersetzt keine HTTP-Details und enthält kein SQL.

| Datei/Modul           | Verantwortung                               | Fachliche Quelle                                                                                               |
| --------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `health/readiness.ts` | Readiness-Port für notwendige Infrastruktur | [`docs/decisions/0005-a0-server-technologiestack.md`](../../docs/decisions/0005-a0-server-technologiestack.md) |
