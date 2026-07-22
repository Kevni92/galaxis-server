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
