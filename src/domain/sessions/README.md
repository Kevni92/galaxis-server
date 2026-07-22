# Session-Domain

Das Sessionmodell hält stabile IDs, Accountbezug, Tokenhash und Zeitpunkte.
Es kennt weder Bearer-Parsing noch Kryptografie, PostgreSQL oder Fastify.

| Datei                      | Verantwortung                                       | Fachliche Quelle                                                                                        |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`session.ts`](session.ts) | Sessionzustand für Application- und Persistenzports | [`docs/contracts/rest-api/galaxis-rest-v1.yaml`](../../../docs/contracts/rest-api/galaxis-rest-v1.yaml) |
