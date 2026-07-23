# Runtime-Ports

`random.ts` exportiert zusätzlich eine Factory für benannte, isolierte
Simulationsströme.

Diese Ports halten Zeit, Simulationszufall, kryptografischen Zufall und IDs von
technischen Adaptern getrennt. Sie verwenden ausschließlich TypeScript- und
Standardtypen, damit Domain- und Applicationtests ohne Node-I/O laufen können.

| Datei                    | Verantwortung                                  | Fachliche Quelle                                                                   |
| ------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`clock.ts`](clock.ts)   | Wall- und Kampagnenzeit als injizierbare Ports | [`zeitmodell.md`](../../../docs/docs/01-gameplay/zeitmodell.md)                    |
| [`random.ts`](random.ts) | Simulations- und Kryptozufallsports            | [`0003`](../../../docs/decisions/0003-mvp-simulations-und-schnittstellenmodell.md) |
| [`ids.ts`](ids.ts)       | undurchsichtiger Ressourcen-ID-Port            | [`0005`](../../../docs/decisions/0005-a0-server-technologiestack.md)               |
