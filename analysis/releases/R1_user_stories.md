# R1 – User Stories (Fußballspezifische GPS-Aufbereitung & Kernmetriken)

## Zielbild R1
Aufbauend auf dem MVP wird die GPS-Verarbeitung fußballspezifisch verbessert: Bewegungen mit Richtungswechseln, Sprints und Stop-and-Go sollen realitätsnäher erkannt werden als bei klassischen Laufalgorithmen.

---

## Story R1-01: Konfigurierbare GPS-Glättung für Fußballbewegungen
**Als** Nutzer  
**möchte ich** eine fußballspezifische GPS-Glättung anwenden  
**damit** kurzzeitige, relevante Bewegungswechsel nicht „weggeglättet“ werden.

### Acceptance Criteria
- [ ] Das System bietet mindestens ein fußballspezifisches Glättungsverfahren (z. B. adaptiver Filter) zusätzlich zu einer Basis-Glättung.
- [ ] Kurzfristige Richtungswechsel und Beschleunigungen bleiben im Vergleich zur Basis-Glättung erkennbar.
- [ ] Unplausible GPS-Ausreißer (Sprünge) werden reduziert, ohne echte Sprints systematisch zu entfernen.
- [ ] Die gewählte Glättungslogik und Parameter sind pro Analyselauf nachvollziehbar gespeichert.

---

## Story R1-02: Vergleich „roh vs. geglättet“
**Als** Nutzer  
**möchte ich** Rohdaten und geglättete Daten vergleichen  
**damit** ich die Wirkung der Glättung verstehen und Vertrauen aufbauen kann.

### Acceptance Criteria
- [ ] In der Session-Detailansicht gibt es eine umschaltbare Darstellung „Rohdaten / Geglättet“.
- [ ] Eine Kennzahl zeigt die Datenveränderung (z. B. Anteil korrigierter Punkte, mittlere Abweichung).
- [ ] Bei Sessions ohne GPS ist die Funktion deaktiviert und sauber erklärt.
- [ ] Die Performance bleibt bei typischen Amateur-Sessiongrößen im nutzbaren Bereich.

---

## Story R1-03: Fußball-Kernmetriken (v1)
**Als** Nutzer  
**möchte ich** fußballrelevante Bewegungsmetriken sehen  
**damit** ich mein Belastungsprofil besser einschätzen kann.

### Acceptance Criteria
- [ ] Berechnung von mindestens: zurückgelegte Distanz, Sprintdistanz, Anzahl Sprints, Maximalgeschwindigkeit, Hochintensitätszeit.
- [ ] Schwellen (z. B. Sprint-Tempo) sind initial sinnvoll vorbelegt und dokumentiert.
- [ ] Metriken werden nur berechnet, wenn die erforderliche Datenqualität erreicht ist.
- [ ] Bei zu geringer Qualität wird statt einer Zahl ein verständlicher Hinweis ausgegeben.

---

## Story R1-04: GPS-/Nicht-GPS-Fallbacklogik in Metriken
**Als** Nutzer ohne GPS-Uhr  
**möchte ich** trotzdem sinnvolle Auswertungen erhalten  
**damit** die App auch ohne Standortdaten nützlich bleibt.

### Acceptance Criteria
- [ ] Bei fehlendem GPS werden verfügbare Metriken (z. B. Dauer, HF-basierte Zonenzeit, HF-Belastung) weiterhin berechnet.
- [ ] Nicht berechenbare GPS-Metriken werden klar als „nicht verfügbar“ markiert.
- [ ] Die Oberfläche unterscheidet transparent zwischen „nicht gemessen“ und „Messung unbrauchbar“.
- [ ] Keine fehlerhaften Nullwerte, die als echte Messwerte missverstanden werden könnten.

---

## Story R1-05: Upload-Pipeline für weitere Dateitypen vorbereiten
**Als** Produktteam  
**möchte ich** den Upload-Flow intern formatoffen strukturieren  
**damit** später weitere Dateitypen ergänzt werden können, ohne den TCX-Flow zu brechen.

### Acceptance Criteria
- [ ] Der Upload- und Parsing-Flow verwendet eine klare Adapter-/Strategie-Schnittstelle je Dateityp.
- [ ] TCX bleibt der einzig freigeschaltete Dateityp in der UI.
- [ ] Nicht unterstützte Dateiendungen werden klar abgelehnt, aber technisch als „potenziell zukünftige Formate“ sauber behandelbar geloggt.
- [ ] Mapping ins kanonische Activity-Modell ist für TCX dokumentiert.

---

## Story R1-06: Metrik-Erklärung direkt in der UI
**Als** Nutzer  
**möchte ich** zu jeder Metrik eine kurze Erklärung sehen  
**damit** ich weiß, wofür die Metrik gedacht ist und wie ich sie interpretieren soll.

### Acceptance Criteria
- [ ] Jede angezeigte Metrik besitzt ein Info-Element (z. B. Tooltip/Info-Icon mit Kurztext).
- [ ] Die Erklärung enthält mindestens: Zweck der Metrik, vereinfachte Interpretation, Einheit.
- [ ] Bei quality-gated Metriken wird erklärt, wann der Wert nicht verfügbar ist.
- [ ] Die Texte sind in konsistenter, nutzerverständlicher Sprache formuliert.
