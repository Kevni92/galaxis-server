# Integrationstests

`session-registration.test.ts` prüft die Sessionrouten, Bearer-Prüfung,
Identitätsweitergabe und Abmeldung über `Fastify.inject()`.

`rest-core.test.ts` prüft den Fastify-HTTP-Adapter isoliert mit
`Fastify.inject()`.

`database.test.ts` prüft Pool, Migrationen und Transaktionsgrenzen gegen
PostgreSQL in einem Testcontainers-Container. Der Test wird nur übersprungen,
wenn Docker in der lokalen Umgebung nicht verfügbar ist; CI soll Docker
bereitstellen.
