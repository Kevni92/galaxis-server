# A1-Referenzszenario

| Datei                      | Verantwortung                                                                          | Fachliche Quelle                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`a1-demo.ts`](a1-demo.ts) | Deterministischer A1-Demoablauf über HTTP und fachlicher Hash der sichtbaren Startlage | [`docs/balancing/scenarios/s01-startreich.md`](../../docs/balancing/scenarios/s01-startreich.md) |

`runA1Scenario` treibt den vollständigen A1-Ablauf über einen injizierbaren
HTTP-Zugriff (`HttpInvoke`): Registrierung, Anmeldung, Kampagne mit festem Seed,
bekannte Galaxie, Heimatsystem, Kolonien, Bevölkerung und Grundversorgung. Opake,
zufällige Ressourcen-IDs werden auf stabile Platzhalter normalisiert und
Navigationslinks entfernt, sodass der fachliche Hash nur von der deterministischen
Startlage abhängt. Ein Fehler nennt reproduzierbar Schritt und Seed
(`A1ScenarioError`).

Der Ablauf wird sowohl vom Integrationstest
([`tests/integration/scenario-a1.test.ts`](../../tests/integration/scenario-a1.test.ts))
als auch vom CLI ([`scripts/scenario-a1.ts`](../../scripts/scenario-a1.ts),
`pnpm scenario:a1 [seed]`) verwendet.
