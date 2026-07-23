# Agent-Anweisungen

1. Vor jeder Aufgabe `docs/AGENTS.md`, `docs/WORKFLOW.md`, `docs/AGENT-COMMUNICATION.md`, `docs/TESTING.md` und `docs/SOURCE-CODE.md` lesen und befolgen. Fehlt `docs/`, muss zuerst das Submodule initialisiert werden.
2. Nach dem Lesen des Issues und seiner Quellen, aber vor der ersten inhaltlichen Änderung, unter `## Aufgabenverständnis` in ungefähr 80 bis 120 Wörtern kurz Ziel, erwartetes Ergebnis, Grenzen und wichtige Abhängigkeiten beschreiben.
3. Nach Abschluss oder Abbruch einen kurzen strukturierten `## Abschlussbericht` gemäß `docs/AGENT-COMMUNICATION.md` ausgeben. Er enthält Status, umgesetzte Ergebnisse, technische Umsetzung, tatsächlich ausgeführte Tests, offene Risiken und das begründet empfohlene nächste Issue. Das nächste Issue wird in zwei bis drei kurzen Sätzen beschrieben und mit der Frage angeboten, ob damit fortgefahren werden soll.
4. Dieses Repository enthält den serverautoritativen Galaxis-Server und seine REST-Schnittstelle.
5. REST-Verträge unter `docs/contracts/rest-api/` sind verbindlich.
6. Simulation, Zeit und Zufall müssen deterministisch und isoliert testbar bleiben.
7. Betroffene lokale `README.md`-Dateien lesen und bei Strukturänderungen aktualisieren. Module klein und klar abgegrenzt halten.
8. Fachlich relevanten Quellcode gemäß `docs/SOURCE-CODE.md` knapp mit den maßgeblichen Dokumenten verknüpfen.
9. Tests gemäß `docs/TESTING.md` risikobasiert und möglichst schnell ausführen.

## Branch- und PR-Regeln

10. Neue Feature- und Reparaturbranches werden immer direkt vom aktuell gefetchteten `origin/main` erstellt.
11. Jeder Pull Request verwendet ausschließlich `main` als Base-Branch.
12. Feature-Branches dürfen nicht ineinander gemergt oder als gestapelte Pull Requests veröffentlicht werden.
13. Mit dem nächsten Issue wird erst begonnen, nachdem der Pull Request des vorherigen Issues in `main` gemergt wurde.
14. Das Erstellen eines Pull Requests ist ein verpflichtender Abschluss-Schritt jeder Issue-Umsetzung. Nach erfolgreicher Prüfung muss der Agent die Änderungen bewusst committen, den Issue-Branch pushen, einen Pull Request mit `main` als Base erstellen und die PR-Nummer sowie den Link im Abschlussbericht nennen.
15. Eine Umsetzung darf nicht als abgeschlossen gemeldet werden, solange nur lokale Änderungen, ein lokaler Commit oder ein Push ohne Pull Request vorliegt. Ein Push ohne Pull Request ist nur zulässig, wenn der Nutzer dies für eine ausdrücklich benannte Dokumentations- oder Wartungsänderung anordnet.
