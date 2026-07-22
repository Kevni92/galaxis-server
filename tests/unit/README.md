# Unit-Tests

`sessions.test.ts` und `session-token.test.ts` prüfen Ablauf, Widerruf,
Dummy-Hashing und opake Token deterministisch mit Fakes.

`balancing.test.ts` prüft Schema, Referenzen, Unveränderlichkeit, Golden-Hash
und den Dateisystem-Loader für die A0-Baseline.

`runtime.test.ts` prüft deterministische Zeit-, Zufalls- und ID-Provider;
`architecture-boundaries.test.ts` verifiziert zusätzlich direkte
Systemzugriffe in der Domain-Fixture.

Unit-Tests prüfen später isolierte Domain- und Applicationlogik mit
injizierten Zeit-, ID- und Zufallsports. `smoke.test.ts` prüft aktuell nur den
leeren Fastify-Bootstrap; `architecture-boundaries.test.ts` verifiziert die
Architektur-Fixture.
