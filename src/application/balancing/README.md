# Balancing-Ports

Die Application-Schicht kennt nur die validierte, unveränderliche Konfiguration
und den Node-freien Loader-Port.

| Datei                            | Verantwortung                                           | Fachliche Quelle                                                         |
| -------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`loader.ts`](loader.ts)         | Datenmodell und `BalancingLoader`-Port                  | [`0004`](../../../docs/decisions/0004-versionierte-balancing-schicht.md) |
| [`parameters.ts`](parameters.ts) | Erforderliche numerische Parameter mit Einheitenprüfung | [`data-format.md`](../../../docs/balancing/data-format.md)               |
