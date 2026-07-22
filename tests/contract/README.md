# Contract-Tests

Die Contract-Suite prueft die A0-Endpunkte gegen die freigegebene OpenAPI-v1-
Quelle unter `docs/contracts/rest-api/galaxis-rest-v1.yaml`.

## Ausfuehrung

```text
pnpm test:contract
```

Die Suite validiert die OpenAPI-Struktur und Referenzen, vergleicht die
relevanten TypeBox-Route-Schemas mit den Vertragspflichtfeldern und fuehrt
Registrierung, Login, Sessionabfrage und Logout ueber den echten Fastify-
Adapter aus. Fuer diese Ablaeufe wird eine isolierte PostgreSQL-16-Testcontainer-
Instanz migriert; wenn Docker lokal nicht verfuegbar ist, werden nur die
datenbankabhaengigen Tests uebersprungen.

Response-Validierung prueft die im Vertrag definierten Felder und Constraints.
Zusaetzliche Response-Felder bleiben gemaess der v1-Regel zulaessig.
