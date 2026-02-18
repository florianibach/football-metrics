## Dev Request 
```
Hallo, bitte setze die Story R1-01 um und halte dich dabei an die DOD. 
Setze die Story im Anschluss auf done. 
Bitte stelle sicher, dass sowohl in Branch als auch PullRequest Name die Story ersichtlich ist.
Bitte füge eine aussagekräftige Message in den Pull Request hinzu
```

## QA Response (wenn CI grün ist)
```
Kannst du mit der QA Brille drauf schauen, ob die DOD erfüllt ist und alle ACs automatisiert getestet sind?
```

## Dev Request (strikt: fehlende Dependencies automatisch installieren)
```
Bitte setze die Story <STORY-ID> um und halte dich an die DoD.

Wichtig für Build/Test/Lint:
1) Wenn ein Tool oder eine Dependency fehlt (z. B. dotnet, node, npm, python package, test runner),
   darfst du NICHT final mit "fehlgeschlagen" abbrechen.
2) Installiere fehlende Dependencies automatisch (bevorzugt projektkonforme Setup-/Bootstrap-Skripte).
3) Führe den ursprünglich fehlgeschlagenen Command danach erneut aus.
4) Nur wenn Installation ODER Re-Run fehlschlägt, markiere den Check als Fehler.
5) Dokumentiere im Ergebnis immer:
   - was gefehlt hat,
   - wie es installiert wurde,
   - Ergebnis des Re-Runs.

Ein erstes "command not found" zählt nur als Zwischenstatus, nicht als finales Testergebnis.
```
