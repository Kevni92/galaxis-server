# Session-Application

Der Session-Use-Case prüft lokale Zugangsdaten, erstellt Bearer-Sessions und
übersetzt nur bestätigte Identitäten in den Transport. Klartexttokens bleiben
auf die Erstellungsausgabe begrenzt; Sessionablauf und Widerruf werden über
injizierte Ports und eine konfigurierbare Lebensdauer gesteuert.

| Datei                      | Verantwortung                           | Fachliche Quelle                                                                                                  |
| -------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`service.ts`](service.ts) | Anmeldung, Prüfung, Ablauf und Widerruf | [`docs/contracts/rest-api/galaxis-rest-v1.yaml`](../../../docs/contracts/rest-api/galaxis-rest-v1.yaml)           |
| [`ports.ts`](ports.ts)     | Session-, Token- und Rate-Limit-Ports   | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
