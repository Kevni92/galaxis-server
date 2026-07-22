# Testfixtures

Fixtures enthalten kleine, reproduzierbare Testdaten und feste Seeds. Sie sind
keine fachliche Quelle und duerfen keine nicht dokumentierten Regeln einfuehren.

`migrations.ts` stellt den Pfad zum freigegebenen Migrationsverzeichnis fuer
Tests bereit, damit Contract- und Datenbanktests dieselbe Migrationsquelle
verwenden.
