# Balancing-Adapter

Dieser Bereich validiert und lädt die unveränderliche A0-Baseline aus
[`data/balancing/manifest.json`](../../../data/balancing/manifest.json).

| Datei                                    | Verantwortung                              | Fachliche Quelle                                                         |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| [`schema.ts`](schema.ts)                 | TypeBox-Schema und semantische Validierung | [`data-format.md`](../../../docs/balancing/data-format.md)               |
| [`canonical-hash.ts`](canonical-hash.ts) | Rekursive Kanonisierung und SHA-256        | [`0004`](../../../docs/decisions/0004-versionierte-balancing-schicht.md) |
| [`loader.ts`](loader.ts)                 | Dateisystem- und In-Memory-Loader          | [`0005`](../../../docs/decisions/0005-a0-server-technologiestack.md)     |
