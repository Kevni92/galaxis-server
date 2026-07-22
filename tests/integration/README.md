# Integrationstests

`rest-core.test.ts` prüft den Fastify-HTTP-Adapter isoliert mit
`Fastify.inject()`.

Integrationstests prüfen später das Zusammenspiel von Servermodulen,
PostgreSQL, Persistenz und Migrationen. Testcontainers ist dafür der
festgelegte Adapter, sofern Docker verfügbar ist.
