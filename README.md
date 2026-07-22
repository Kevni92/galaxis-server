# Galaxis Server

Serverautoritativer Galaxis-Server. Dieses Repository enthält die spätere
TypeScript-/Node.js-Implementierung; die fachliche Quelle bleibt das
eingebundene [`galaxis-docs`](docs/README.md)-Submodule.

## Status: A0 / GAL-PLATFORM-STACK-001

Issue #1 legt den Technologiestack, die Modulstruktur und die automatisiert
prüfbaren Importgrenzen fest. Diese Änderung enthält absichtlich keine
HTTP-Routen, Datenbanktabellen, Authentifizierung, Kampagnen oder
Gameplaylogik.

## Verbindlicher Stack

- Node.js 24 LTS, mit `.node-version` und `package.json#engines` zu pinnen
- TypeScript im Strict-Modus und ECMAScript Modules
- pnpm über Corepack mit verbindlichem `pnpm-lock.yaml`
- Fastify und TypeBox an der HTTP-/Schema-Grenze, Pino für strukturiertes Logging
- PostgreSQL mit `pg`, Kysely und versionierten SQL-Migrationen
- Argon2id über `argon2`; Node.js `crypto` ausschließlich für kryptografische Ports
- Vitest, Fastify `inject()` und Testcontainers
- ESLint, Prettier und `dependency-cruiser` für statische Qualitäts- und Architekturprüfungen

Die konkrete Repositorybasis mit installierbaren Abhängigkeiten, Entrypoint,
Migration-Runner und CI folgt in den dafür vorgesehenen A0-Issues. Dieser
Bootstrap dokumentiert und prüft bereits die Grenzen, an die diese Module
später angeschlossen werden.

## Modulstruktur und Abhängigkeiten

```text
transport/http ──▶ application ──▶ domain

infrastructure ──▶ Ports aus application/domain
app/composition-root ──▶ verdrahtet alle Module und den Lifecycle
```

| Bereich | Verantwortung | Darf abhängen von |
|---|---|---|
| `src/domain` | Fachmodelle, Invarianten und später deterministische Berechnungen | ausschließlich Domaintypen und injizierte Ports |
| `src/application` | Anwendungsfälle, Orchestrierung und Transaktionsgrenzen | `domain`, Ports |
| `src/infrastructure` | technische Adapter für Konfiguration, Logging, Datenbank und Balancing | `application`-/`domain`-Ports, technische Bibliotheken |
| `src/transport/http` | HTTP-/JSON-Validierung und Übersetzung | `application`, TypeBox, Fastify |
| `src/app/composition-root` | Komposition, Abhängigkeiten und Lifecycle | alle konkreten Adapter und Application-Einstiegspunkte |

`domain` bleibt von Fastify, TypeBox, Kysely, `pg`, `process.env`,
Node-I/O sowie direktem Zugriff auf Systemzeit und Zufall getrennt. Verboten
sind insbesondere `Date.now()`, `new Date()`, `Math.random()` und
`crypto.randomUUID()` im Domaincode. Zeit, IDs und Simulationszufall werden
später über Ports injiziert; kryptografischer Zufall bleibt davon getrennt.

Die Regeln sind in [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs) und
[`scripts/check-architecture.mjs`](scripts/check-architecture.mjs) festgelegt.
Die TypeScript-Compilergrenzen stehen in [`tsconfig.json`](tsconfig.json) und
[`tsconfig.build.json`](tsconfig.build.json).

## Repository-Navigation

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

## Lokale Prüfstruktur

Nach dem Repository-Basis-Issue werden die folgenden pnpm-Ziele verbindlich
ausgeführt:

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

Issue #1 führt davon die unabhängige Architekturprüfung bereits ohne
Produktionsabhängigkeiten aus. Datenbank-, HTTP-, Contract- und
End-to-End-Prüfungen gehören nicht zu diesem Issue, weil die dafür nötigen
Module noch bewusst nicht implementiert sind.
