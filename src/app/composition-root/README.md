# Composition Root

Beim Start lädt der Composition Root die validierte A0-Balancingkonfiguration
vor dem HTTP-Listener und protokolliert Version, Katalogversion und Hash.
Wenn `GALAXIS_DATABASE_URL` gesetzt ist, werden PostgreSQL-Readiness und
Pool-Shutdown in denselben Lifecycle eingebunden.

Der Composition Root erstellt konkrete Adapter, injiziert Ports und steuert
den Anwendungs-Lifecycle. Er enthält keine Fachlogik und wird von keinem
inneren Modul importiert.

| Datei/Modul      | Verantwortung                                                                  | Fachliche Quelle                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `application.ts` | Verdrahtet Konfiguration, Server, Datenbank, Readiness und Shutdown-Ressourcen | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
| `server.ts`      | Erzeugt Fastify, Korrelation, technische Grenzen und Health-Transport          | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
| `main.ts`        | Lädt Konfiguration und verarbeitet SIGINT/SIGTERM                              | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
