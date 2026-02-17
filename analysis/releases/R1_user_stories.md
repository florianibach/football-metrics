# R1 – User Stories (Fußballspezifische GPS-Aufbereitung & Kernmetriken)

## Zielbild R1
Aufbauend auf dem MVP wird die GPS-Verarbeitung fußballspezifisch verbessert: Bewegungen mit Richtungswechseln, Sprints und Stop-and-Go sollen realitätsnäher erkannt werden als bei klassischen Laufalgorithmen.

---

## Story R1-01: Konfigurierbare GPS-Glättung für Fußballbewegungen
**Als** Nutzer  
**möchte ich** eine fußballspezifische GPS-Glättung anwenden  
**damit** kurzzeitige, relevante Bewegungswechsel nicht „weggeglättet“ werden.

### Acceptance Criteria
- [x] Das System bietet mindestens ein fußballspezifisches Glättungsverfahren (z. B. adaptiver Filter) zusätzlich zu einer Basis-Glättung.
- [x] Kurzfristige Richtungswechsel und Beschleunigungen bleiben im Vergleich zur Basis-Glättung erkennbar.
- [x] Unplausible GPS-Ausreißer (Sprünge) werden reduziert, ohne echte Sprints systematisch zu entfernen.
- [x] Die gewählte Glättungslogik und Parameter sind pro Analyselauf nachvollziehbar gespeichert.

---

## Story R1-02: Vergleich „roh vs. geglättet“
**Als** Nutzer  
**möchte ich** Rohdaten und geglättete Daten vergleichen  
**damit** ich die Wirkung der Glättung verstehen und Vertrauen aufbauen kann.

### Acceptance Criteria
- [x] In der Session-Detailansicht gibt es eine umschaltbare Darstellung „Rohdaten / Geglättet“.
- [x] Eine Kennzahl zeigt die Datenveränderung (z. B. Anteil korrigierter Punkte, mittlere Abweichung).
- [x] Bei Sessions ohne GPS ist die Funktion deaktiviert und sauber erklärt.
- [x] Die Performance bleibt bei typischen Amateur-Sessiongrößen im nutzbaren Bereich.

---

## Story R1-03: Fußball-Kernmetriken (v1)
**Als** Nutzer  
**möchte ich** fußballrelevante Bewegungsmetriken sehen  
**damit** ich mein Belastungsprofil besser einschätzen kann.

### Acceptance Criteria
- [x] Berechnung von mindestens: zurückgelegte Distanz, Sprintdistanz, Anzahl Sprints, Maximalgeschwindigkeit, Hochintensitätszeit.
- [x] Schwellen (z. B. Sprint-Tempo) sind initial sinnvoll vorbelegt und dokumentiert.
- [x] Metriken werden nur berechnet, wenn die erforderliche Datenqualität erreicht ist.
- [x] Bei zu geringer Qualität wird statt einer Zahl ein verständlicher Hinweis ausgegeben.
- [x] Zusätzlich sind erweiterte Fußball-Metriken verfügbar (u. a. High-Speed-Distanz, **Anzahl hochintensive Läufe**, Laufdichte, Beschleunigungen/Abbremsungen, HF-Zonenzeit, TRIMP, HF-Erholung).

---

## Story R1-04: GPS-/Nicht-GPS-Fallbacklogik in Metriken
**Als** Nutzer ohne GPS-Uhr  
**möchte ich** trotzdem sinnvolle Auswertungen erhalten  
**damit** die App auch ohne Standortdaten nützlich bleibt.

### Acceptance Criteria
- [x] Bei fehlendem GPS werden verfügbare Metriken (z. B. Dauer, HF-basierte Zonenzeit, HF-Belastung) weiterhin berechnet.
- [x] Nicht berechenbare GPS-Metriken werden klar als „nicht verfügbar“ markiert.
- [x] Die Oberfläche unterscheidet transparent zwischen „nicht gemessen“ und „Messung unbrauchbar“.
- [x] Keine fehlerhaften Nullwerte, die als echte Messwerte missverstanden werden könnten.

---

## Story R1-05: Upload-Pipeline für weitere Dateitypen vorbereiten
**Status:** Done ✅  
**Als** Produktteam  
**möchte ich** den Upload-Flow intern formatoffen strukturieren  
**damit** später weitere Dateitypen ergänzt werden können, ohne den TCX-Flow zu brechen.

### Acceptance Criteria
- [x] Der Upload- und Parsing-Flow verwendet eine klare Adapter-/Strategie-Schnittstelle je Dateityp.
- [x] TCX bleibt der einzig freigeschaltete Dateityp in der UI.
- [x] Nicht unterstützte Dateiendungen werden klar abgelehnt, aber technisch als „potenziell zukünftige Formate“ sauber behandelbar geloggt.
- [x] Mapping ins kanonische Activity-Modell ist für TCX dokumentiert.

---

## Story R1-06: Metrik-Erklärung direkt in der UI
**Status:** Done ✅  
**Als** Nutzer  
**möchte ich** zu jeder Metrik eine kurze Erklärung sehen  
**damit** ich weiß, wofür die Metrik gedacht ist und wie ich sie interpretieren soll.

### Acceptance Criteria
- [x] Jede angezeigte Metrik besitzt ein Info-Element (z. B. Tooltip/Info-Icon mit Kurztext).
- [x] Die Erklärung enthält mindestens: Zweck der Metrik, vereinfachte Interpretation, Einheit.
- [x] Bei quality-gated Metriken wird erklärt, wann der Wert nicht verfügbar ist.
- [x] Die Texte sind in konsistenter, nutzerverständlicher Sprache formuliert.

---

## Story R1-07: Glättungsfilter pro Session auswählbar
**Status:** Done ✅  
**Als** Nutzer  
**möchte ich** den Glättungsfilter je Session auswählen  
**damit** ich je nach Datenlage zwischen Rohdaten und unterschiedlichen Filterverfahren vergleichen kann.

### Acceptance Criteria
- [x] In der Session-Detailansicht kann der Nutzer zwischen mindestens **Raw**, **AdaptiveMedian**, **Savitzky-Golay** und **Butterworth** umschalten.
- [x] Die Auswahl wirkt sich direkt auf die angezeigten Metriken/Visualisierungen der gewählten Session aus.
- [x] Die pro Session verwendete Filterauswahl wird nachvollziehbar gespeichert und im Analyseprotokoll angezeigt.
- [x] Für Sessions ohne GPS ist die Filterauswahl deaktiviert und nutzerverständlich begründet.

---

## Story R1-08: Filter-Erklärung und empfohlener Standard in der UI
**Status:** Done ✅  
**Als** Nutzer  
**möchte ich** eine kurze Erklärung zu jedem Filter sowie eine Produktempfehlung sehen  
**damit** ich ohne Expertenwissen eine sinnvolle Auswahl treffen kann.

### Acceptance Criteria
- [x] Für jeden angebotenen Filter gibt es eine Kurzbeschreibung (Zweck, Stärken, Grenzen, typische Nutzung).
- [x] Die UI markiert klar, welcher Filter vom Produktteam aktuell empfohlen wird.
- [x] Bei Filterwechsel wird erklärt, dass sich Kennzahlen durch das Verfahren ändern können.
- [x] Erklärtexte sind konsistent lokalisiert (DE/EN) und in Session-Details gut erreichbar.

---

## Release-Vorschlag (Filter-Themen)
- **R1:** Session-bezogene Filterauswahl + Erklärung/Empfehlung (`R1-07`, `R1-08`).
- **R1.5:** Profilweiter Default-Filter erst nach verfügbarem Profilbereich (siehe neue Story `R1.5-08`).
