# Composition Root

Der Composition Root erstellt später die konkreten Adapter, injiziert Ports
und steuert den Anwendungs-Lifecycle. Er enthält keine Fachlogik und wird von
keinem inneren Modul importiert.

| Datei/Modul | Verantwortung | Fachliche Quelle |
|---|---|---|
| späterer `createApp`-Einstiegspunkt | Abhängigkeiten und Lifecycle verdrahten | [`docs/decisions/0005-a0-server-technologiestack.md`](../../../docs/decisions/0005-a0-server-technologiestack.md) |
