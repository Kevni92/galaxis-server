# Galaxis Server

Serverautoritativer Galaxis-Server. Dieses Repository enthält die spätere
TypeScript-/Node.js-Implementierung; die fachliche Quelle bleibt das
eingebundene [`galaxis-docs`](docs/README.md)-Submodule.

## Status: A0 / GAL-BAL-DATA-001

Issue #7 ergänzt gehashte Bearer-Sessions mit Ablauf, Widerruf und den drei
Auth-Endpunkten für Anmeldung, Prüfung und Abmeldung.

Issue #6 ergänzt lokale Accountregistrierung mit Argon2id, PostgreSQL-Persistenz
und `POST /api/v1/auth/accounts` gemäß REST-Vertrag.

Issue #9 ergänzt die versionierte A0-Balancing-Baseline mit strikter
Validierung, tief unveränderlicher Konfiguration und kanonischem SHA-256-Hash.

Issue #8 ergänzt injizierbare, deterministische Zeit-, Zufalls- und ID-Ports;
Authentifizierungszufall bleibt davon getrennt.

Issue #5 ergänzt den Fastify-REST-Kern mit TypeBox-Laufzeitvalidierung,
Korrelations-ID, sicheren Fehlerantworten sowie konfigurierbaren HTTP-Grenzen.

Issue #3 ergänzt die baubare Basis um strikt validierte Runtime-Konfiguration,
strukturiertes Pino-Logging, technische Health-Endpunkte und einen kontrollierten
Shutdown-Lifecycle. Es gibt weiterhin keine Datenbanktabellen,
Authentifizierung, Kampagnen oder Gameplaylogik.

## Verbindlicher Stack

- Node.js 24 LTS, mit `.node-version` und `package.json#engines` zu pinnen
- TypeScript im Strict-Modus und ECMAScript Modules
- pnpm über Corepack mit verbindlichem `pnpm-lock.yaml`
- Fastify und TypeBox an der HTTP-/Schema-Grenze, Pino für strukturiertes Logging
- PostgreSQL mit `pg`, Kysely und versionierten SQL-Migrationen
- Argon2id über `argon2`; Node.js `crypto` ausschließlich für kryptografische Ports
- Vitest, Fastify `inject()` und Testcontainers
- ESLint, Prettier und `dependency-cruiser` für statische Qualitäts- und Architekturprüfungen

Die installierbaren Abhängigkeiten und Versionen sind in
[`package.json`](package.json) und [`pnpm-lock.yaml`](pnpm-lock.yaml) festgelegt.
Der Entrypoint startet eine kleine Fastify-Anwendung. Fachliche und produktive
HTTP-Module folgen in späteren A0-Issues.

## Frischer Checkout

Die folgenden Befehle gelten für PowerShell unter Windows sowie Bash/Zsh unter
Linux und macOS:

```bash
git clone --recurse-submodules https://github.com/Kevni92/galaxis-server.git
cd galaxis-server
git submodule update --init --recursive
corepack enable
corepack install
node --version       # v24.18.0
pnpm --version       # 11.4.0
pnpm install --frozen-lockfile
pnpm check
```

Docker Desktop beziehungsweise Docker Engine wird für die lokale
PostgreSQL-Instanz benötigt und kann mit `docker compose version` geprüft
werden. Start und Migration erfolgen über:

```powershell
docker compose up -d postgres
pnpm db:migrate
pnpm db:migrate:check
```

Lokaler Start und Produktionsbuild. `GALAXIS_PORT` und `GALAXIS_LOG_LEVEL`
sind Pflichtwerte; weitere Werte stehen in [`.env.example`](.env.example):

```powershell
$env:GALAXIS_PORT="3000"
$env:GALAXIS_LOG_LEVEL="info"
pnpm dev
```

```bash
GALAXIS_PORT=3000 GALAXIS_LOG_LEVEL=info pnpm dev
pnpm build
pnpm start
```

Der Server lauscht standardmäßig auf `127.0.0.1:3000`. `GET /health/live`
prüft nur, ob der Prozess HTTP-Anfragen bedient. `GET /health/ready` verwendet
eine injizierte Readiness-Prüfung und liefert bis zur Einführung des
PostgreSQL-Adapters in Issue #4 eine dependency-freie Bereitschaft.

## Modulstruktur und Abhängigkeiten

```text
transport/http ──▶ application ──▶ domain

infrastructure ──▶ Ports aus application/domain
app/composition-root ──▶ verdrahtet alle Module und den Lifecycle
```

| Bereich                    | Verantwortung                                                          | Darf abhängen von                                      |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/domain`               | Fachmodelle, Invarianten und später deterministische Berechnungen      | ausschließlich Domaintypen und injizierte Ports        |
| `src/application`          | Anwendungsfälle, Orchestrierung und Transaktionsgrenzen                | `domain`, Ports                                        |
| `src/infrastructure`       | technische Adapter für Konfiguration, Logging, Datenbank und Balancing | `application`-/`domain`-Ports, technische Bibliotheken |
| `src/transport/http`       | HTTP-/JSON-Validierung und Übersetzung                                 | `application`, TypeBox, Fastify                        |
| `src/app/composition-root` | Komposition, Abhängigkeiten und Lifecycle                              | alle konkreten Adapter und Application-Einstiegspunkte |

`domain` bleibt von Fastify, TypeBox, Kysely, `pg`, `process.env`, Node-I/O
sowie direktem Zugriff auf Systemzeit und Zufall getrennt. Verboten sind
insbesondere `Date.now()`, `new Date()`, `Math.random()` und
`crypto.randomUUID()` im Domaincode. Zeit, IDs und Simulationszufall werden
später über Ports injiziert; kryptografischer Zufall bleibt davon getrennt.

Die Regeln sind in [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs) und
[`scripts/check-architecture.mjs`](scripts/check-architecture.mjs) festgelegt.
Die TypeScript-Compilergrenzen stehen in [`tsconfig.json`](tsconfig.json) und
[`tsconfig.build.json`](tsconfig.build.json).

## Repository-Navigation

Die Migrationen `001` bis `003` bilden Metadaten, Accounts und Bearer-Sessions;
die Auth-Routen sind unter `src/transport/http/` navigierbar.

- [`src/`](src/README.md) – Produktionsmodule und ihre Abhängigkeiten
  - [`app/composition-root`](src/app/composition-root/README.md)
  - [`domain`](src/domain/README.md)
  - [`application`](src/application/README.md)
  - [`infrastructure`](src/infrastructure/README.md)
  - [`transport/http`](src/transport/http/README.md)
- [`tests/`](tests/README.md) – Unit-, Integrations-, Contract- und Fixture-Struktur
- [`migrations/`](migrations/README.md) – reserviert für spätere versionierte SQL-Migrationen
- [`scripts/`](scripts/README.md) – technische Prüf- und Werkzeugskripte

## Maßgebliche Quellen

- [Decision 0005 – A0-Servertechnologiestack und Architekturgrenzen](docs/decisions/0005-a0-server-technologiestack.md)
- [Implementierungsroadmap](docs/roadmap/IMPLEMENTATION-ROADMAP.md)
- [Codex-A0-Runbook](docs/roadmap/CODEX-A0.md)
- [Verbindlicher Arbeitsworkflow](docs/WORKFLOW.md)
- [Teststrategie](docs/TESTING.md)
- [Quellcodedokumentation](docs/SOURCE-CODE.md)
- [REST-Vertrag](docs/contracts/rest-api/galaxis-rest-v1.md)

## Lokale Prüfstruktur

Die folgenden pnpm-Ziele sind im Root-Manifest definiert:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:contract
pnpm build
pnpm architecture:check
```

`test:contract` akzeptiert bis zur Einführung der jeweiligen Module bewusst
leere Testbereiche. `test:integration` enthält PostgreSQL-Tests und überspringt
den Container nur, wenn Docker nicht verfügbar ist. `architecture:check` führt sowohl
die direkte Boundary-Prüfung als auch `dependency-cruiser` aus.
