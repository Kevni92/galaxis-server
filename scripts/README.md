# Werkzeugscripte

Technische Prüf- und Entwicklungswerkzeuge liegen außerhalb von `src/` und
dürfen Node.js-I/O verwenden. Sie definieren keine Serverfachlogik.

| Datei                                                   | Zweck                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`check-architecture.mjs`](check-architecture.mjs)      | Prüft Domaincode auf verbotene technische Imports sowie direkten Zeit-/Zufallszugriff     |
| [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs) | Prüft Importzyklen und Schicht-/Paketgrenzen, sobald `dependency-cruiser` installiert ist |

Die ausführbaren Einstiegspunkte sind im Root-`package.json` als pnpm-Skripte
definiert. Datenbankmigrationen werden über `pnpm db:migrate` angewendet und
mit `pnpm db:migrate:check` geprüft; die Implementierung liegt wegen ihrer
Produktionsabhängigkeiten unter `src/infrastructure/database`.
