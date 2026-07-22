# Produktionsmodule

Issue #6 ergänzt das Accountmodell, den Registrierungs-Use-Case und die
zugehörigen HTTP- und Infrastrukturadapter.

Die Balancing-Ports und -Adapter sind unter
[`application/balancing`](application/balancing/README.md) und
[`infrastructure/balancing`](infrastructure/balancing/README.md) dokumentiert.

Die Runtime-Ports und ihre technischen Adapter sind unter
[`application/runtime`](application/runtime/README.md) und
[`infrastructure/runtime`](infrastructure/runtime/README.md) dokumentiert.

`src/` enthält ausschließlich serverseitigen TypeScript-Produktionscode. Die
Abhängigkeitsrichtung verläuft von Transport über Application zur Domain;
Infrastrukturadapter implementieren Ports und werden im Composition Root
verdrahtet.

| Bereich                | Verantwortung                                                     | Navigation                                    |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| `app/composition-root` | Zusammensetzen der konkreten Anwendung                            | [`README.md`](app/composition-root/README.md) |
| `domain`               | Fachliche Modelle und Invarianten, ohne technische Abhängigkeiten | [`README.md`](domain/README.md)               |
| `application`          | Anwendungsfälle und Ports                                         | [`README.md`](application/README.md)          |
| `infrastructure`       | Technische Adapter                                                | [`README.md`](infrastructure/README.md)       |
| `transport/http`       | HTTP-/JSON-Adapter                                                | [`README.md`](transport/http/README.md)       |

Fachlich relevante Quelldateien verlinken ihre maßgeblichen Dokumente gemäß
[`docs/SOURCE-CODE.md`](../docs/SOURCE-CODE.md). Issue #1 legt nur die Grenzen
fest und fügt keine produktive Fachlogik hinzu.
