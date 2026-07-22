# Application health

`readiness.ts` defines the application-level readiness port. The composition
root injects the concrete probe so HTTP transport does not know how external
dependencies are checked. The default A0 probe is dependency-free; the
PostgreSQL adapter is introduced by Issue #4.

Source: [REST contract](../../../docs/contracts/rest-api/galaxis-rest-v1.md).
