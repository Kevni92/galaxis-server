# Unit-Tests

`runtime.test.ts` prüft deterministische Zeit-, Zufalls- und ID-Provider;
`architecture-boundaries.test.ts` verifiziert zusätzlich direkte
Systemzugriffe in der Domain-Fixture.

Unit-Tests prüfen später isolierte Domain- und Applicationlogik mit
injizierten Zeit-, ID- und Zufallsports. `smoke.test.ts` prüft aktuell nur den
leeren Fastify-Bootstrap; `architecture-boundaries.test.ts` verifiziert die
Architektur-Fixture.
