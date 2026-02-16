# R2 – User Stories (Skalierung, Insights, operative Reife)

## Zielbild R2
R2 bringt die Lösung von einer starken Analyse-App hin zu einer operativ reifen Plattform: tiefere Insights, bessere Datenintegration und produktionsnahe Stabilität für den einzelnen Nutzer.

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

## Story R2-02: Automatischer Datenimport (statt nur manuell)
**Als** Nutzer  
**möchte ich** Dateien automatisch aus unterstützten Quellen importieren  
**damit** ich weniger manuellen Aufwand beim Datenfluss habe.

### Acceptance Criteria
- [ ] Mindestens eine Importquelle zusätzlich zum manuellen Upload ist angebunden.
- [ ] Importjobs laufen idempotent (keine Dubletten bei erneutem Abruf).
- [ ] Fehlerhafte Imports werden protokolliert und in der UI mit Retry-Möglichkeit angezeigt.
- [ ] Manuelle Uploads bleiben weiterhin verfügbar.

---

## Story R2-03: Persönliches Trend-Dashboard
**Als** Nutzer  
**möchte ich** meine Belastungstrends sehen  
**damit** ich Training und Regeneration besser planen kann.

### Acceptance Criteria
- [ ] Dashboard zeigt mindestens 7-/28-Tage-Trends für interne und externe Metriken.
- [ ] Auffällige Lastspitzen werden markiert (z. B. Schwellwert oder Trendbruch).
- [ ] Filter nach Zeitraum und Metriktyp sind verfügbar.
- [ ] Kennzahlen sind mit Datenqualitätsindikator versehen.

---

## Story R2-04: Export & Berichtswesen
**Als** Nutzer  
**möchte ich** Analyseergebnisse exportieren  
**damit** ich sie teilen oder extern dokumentieren kann.

### Acceptance Criteria
- [ ] Export mindestens als CSV und PDF für Kernmetriken möglich.
- [ ] Export enthält Metadaten: Datenquelle, Qualitätsstatus, verwendete Schwellen/Algorithmen.
- [ ] Exportierte Berichte sind verständlich strukturiert und datumsbezogen versioniert.
- [ ] Datenschutzkonforme Maskierung/Filterung sensibler Daten ist berücksichtigt.

---

## Story R2-05: Operative Stabilität & Monitoring
**Als** Produktteam  
**möchte ich** die Plattform stabil betreiben und Probleme früh erkennen  
**damit** Nutzer zuverlässig analysieren können.

### Acceptance Criteria
- [ ] Technisches Monitoring für Upload, Parsing, Metrikberechnung und Fehlerquote ist eingerichtet.
- [ ] Kritische Fehler lösen automatische Alerts aus.
- [ ] Antwortzeiten und Verarbeitungszeiten haben definierte Zielwerte (SLOs).
- [ ] Es existiert ein dokumentierter Incident- und Recovery-Prozess.
