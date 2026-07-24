# Contract-Tests

Die Contract-Suite prueft A0 und A1 gegen die beiden freigegebenen OpenAPI-v1-
Quellen unter `docs/contracts/rest-api/galaxis-rest-v1.yaml` und
`docs/contracts/rest-api/galaxis-rest-v1-a1.yaml`.

## Ausfuehrung

```text
pnpm test:contract
```

Die Suite validiert beide OpenAPI-Strukturen, interne Referenzen und Beispiele,
prueft eindeutige Operationen sowie vollstaendige Pfadparameter, vergleicht die
TypeBox-Route-Schemas mit den Vertragspflichtfeldern und fuehrt die A0- sowie
A1-Ablaufe ueber den echten Fastify-Adapter aus. Fuer diese Ablaeufe wird eine isolierte PostgreSQL-16-Testcontainer-
Instanz migriert; wenn Docker lokal nicht verfuegbar ist, werden nur die
datenbankabhaengigen Tests uebersprungen.

Response-Validierung prueft die im Vertrag definierten Felder und Constraints.
Fuer A1 werden die vertraglich verbotenen zusaetzlichen Response-Felder strikt
abgewiesen; A0 bleibt gemaess seiner additiven v1-Regel erweiterbar.
