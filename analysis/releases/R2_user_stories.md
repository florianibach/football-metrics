# R2 – User Stories (Kontexttiefe, positionsbezogene Insights, operative Reife)

## Zielbild R2
R2 bringt die Lösung von einer starken Analyse-App zu einer fachlich deutlich präziseren Plattform: Sessions werden besser kontextualisiert (Spiel/Training), Positionen werden auswertbar und Auswertungen werden alltagstauglich vergleichbar – weiterhin im Fokus auf Single-User-Reife vor breiten Integrationen.

---

## Story R2-01: Positions-/Zonenbasierte Bewegungsanalyse
**Als** Nutzer  
**möchte ich** Bewegungen in Spielfeldzonen analysieren  
**damit** ich mein Laufverhalten kontextbezogen bewerten kann.

### Acceptance Criteria
- [ ] System kann GPS-Punkte auf definierte Spielfeldzonen mappen (z. B. Defensiv-, Mittel-, Offensivzone).
- [ ] Kennzahlen je Zone (Zeit, Distanz, Intensität) sind verfügbar.
- [ ] Zonen-Definition ist konfigurierbar (mindestens Standardfeld + anpassbare Grenzen).
- [ ] Bei fehlender GPS-Qualität werden Zonenmetriken zuverlässig unterdrückt und erklärt.

---

## Story R2-02: Runden/Laps gesondert analysieren
**Als** Nutzer  
**möchte ich** in der Uhr gesetzte Runden separat auswerten  
**damit** ich z. B. Abschlussspiel-Phasen gezielt vergleichen kann.

### Acceptance Criteria
- [ ] Das System erkennt in TCX vorhandene Runden/Laps und ordnet Messpunkte korrekt zu.
- [ ] Pro Runde werden Kernmetriken (mindestens Distanz, Dauer, Intensität) separat berechnet.
- [ ] Runden sind einzeln anwählbar und mit Session-Gesamtwerten vergleichbar.
- [ ] Wenn keine Runden vorhanden sind, wird dies klar kommuniziert und die Gesamtanalyse bleibt nutzbar.

---

## Story R2-03: Spielkontext in Analysen einbeziehen
**Als** Nutzer  
**möchte ich** Spiel- und Trainingskontext in Auswertungen filtern und vergleichen  
**damit** ich Kennzahlen nicht aus falschem Kontext interpretiere.

### Acceptance Criteria
- [ ] Vergleichsansichten können nach Session-Typ (Spiel, Training, Reha etc.) gefiltert werden.
- [ ] Für Spiel-Sessions sind Kontextfelder (z. B. Ergebnis, Wettbewerb, Gegner) in der Analyse sichtbar.
- [ ] Metrikvergleiche können „Spiel vs. Training“ direkt gegenüberstellen.
- [ ] Fehlende Kontextangaben werden transparent angezeigt und nicht still als „Training“ angenommen.

---

## Story R2-04: Positionsspezifische Auswertung inkl. Positionswechsel je Einheit
**Als** Nutzer  
**möchte ich** meine Position pro Einheit bei Bedarf überschreiben können  
**damit** Auswertungen auch dann stimmen, wenn ich abweichend von meiner Primärposition gespielt habe.

### Acceptance Criteria
- [ ] Im Profil hinterlegte Primär-/Sekundärposition bleibt als Standard erhalten.
- [ ] Pro Session kann die tatsächlich gespielte Position manuell gesetzt oder geändert werden.
- [ ] Auswertungen kennzeichnen klar, ob Profilposition oder Session-Override verwendet wurde.
- [ ] Positionsvergleiche nutzen standardmäßig die Session-Position, falls gesetzt.

---

## Story R2-05: Persönliches Trend-Dashboard
**Als** Nutzer  
**möchte ich** meine Belastungstrends sehen  
**damit** ich Training und Regeneration besser planen kann.

### Acceptance Criteria
- [ ] Dashboard zeigt mindestens 7-/28-Tage-Trends für interne und externe Metriken.
- [ ] Auffällige Lastspitzen werden markiert (z. B. Schwellwert oder Trendbruch).
- [ ] Filter nach Zeitraum und Metriktyp sind verfügbar.
- [ ] Kennzahlen sind mit Datenqualitätsindikator versehen.

---

## Story R2-06: Export & Berichtswesen
**Als** Nutzer  
**möchte ich** Analyseergebnisse exportieren  
**damit** ich sie teilen oder extern dokumentieren kann.

### Acceptance Criteria
- [ ] Export mindestens als CSV und PDF für Kernmetriken möglich.
- [ ] Export enthält Metadaten: Datenquelle, Qualitätsstatus, verwendete Schwellen/Algorithmen.
- [ ] Exportierte Berichte sind verständlich strukturiert und datumsbezogen versioniert.
- [ ] Datenschutzkonforme Maskierung/Filterung sensibler Daten ist berücksichtigt.

---

## Story R2-07: Operative Stabilität & Monitoring
**Status:** Done ✅

> Hinweis: Der Status wurde **explizit** auf Done gesetzt (inkl. QA-Check). Er ergibt sich nicht implizit nur dadurch, dass einzelne BAR-Tasks umgesetzt wurden.

**Als** Produktteam  
**möchte ich** die Plattform stabil betreiben und Probleme früh erkennen  
**damit** Nutzer zuverlässig analysieren können.

### Acceptance Criteria
- [ ] Technisches Monitoring für Upload, Parsing, Metrikberechnung und Fehlerquote ist eingerichtet.
- [ ] Kritische Fehler lösen automatische Alerts aus.
- [ ] Antwortzeiten und Verarbeitungszeiten haben definierte Zielwerte (SLOs).
- [ ] Es existiert ein dokumentierter Incident- und Recovery-Prozess.
