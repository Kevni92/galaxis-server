# Application

Der Generatorport für die deterministische Startgalaxie liegt unter
[`galaxy/`](galaxy/README.md).

[`sessions/service.ts`](sessions/service.ts) orchestriert Anmeldung, Sessionprüfung
und Widerruf über getrennte Persistenz-, Token-, Zeit- und Rate-Limit-Ports.

[`campaigns/service.ts`](campaigns/service.ts) erstellt idempotente
Singleplayer-Kampagnen samt Startreich und Controllerzuordnung und liest nur
Kampagnen des authentifizierten Accounts.

Der controllergefilterte Lesezugriff auf Reiche liegt unter
[`empires/`](empires/README.md).

Die lokale Registrierung liegt in [`accounts/registration.ts`](accounts/registration.ts)
und verwendet die injizierbaren Ports aus [`accounts/ports.ts`](accounts/ports.ts).

Der Balancing-Port liegt unter [`balancing/`](balancing/README.md) und liefert
eine validierte, tief unveränderliche Konfiguration ohne Node-I/O-Typen.

Die injizierbaren Runtime-Ports liegen unter [`runtime/`](runtime/README.md)
und trennen Wall-/Kampagnenzeit, Simulationszufall, Kryptozufall und IDs.

Die Application-Schicht orchestriert Anwendungsfälle, Ports und
Transaktionsgrenzen. Sie übersetzt keine HTTP-Details und enthält kein SQL.

| Datei/Modul           | Verantwortung                                      | Fachliche Quelle                                                                                               |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `errors.ts`           | Fehlercodes und Metadaten für zentrale Übersetzung | [`docs/contracts/rest-api/galaxis-rest-v1.md`](../../docs/contracts/rest-api/galaxis-rest-v1.md)               |
| `health/readiness.ts` | Readiness-Port für notwendige Infrastruktur        | [`docs/decisions/0005-a0-server-technologiestack.md`](../../docs/decisions/0005-a0-server-technologiestack.md) |
