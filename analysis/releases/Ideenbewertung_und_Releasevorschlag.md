# Ideenbewertung & Release-Vorschlag

## Kontext
Bewertung der drei neuen Produktideen:
1. **Polymorphes Datenmodell für Datenpunkte/Quellen** (TCX heute, später ggf. weitere Dateitypen und erst deutlich später API-Integrationen).
2. **Einheiten als Training/Spiel markieren** inkl. Spielkontext (Ergebnis, Gegner-Logo etc.).
3. **Position im Profil hinterlegen** und positionsspezifische Auswertung je Einheit (inkl. Positionswechsel je Spiel/Session).

---

## 1) Polymorphes Datenmodell für Datenquellen

### Bewertung
**Nutzen:** sehr hoch  
**Aufwand:** mittel  
**Risiko:** mittel (frühe Architekturentscheidung)

Diese Entscheidung ist strategisch sinnvoll und sollte **früh** getroffen werden. Wenn das Datenmodell nur auf TCX optimiert wird, entstehen später hohe Migrationskosten bei neuen Dateitypen oder Integrationen.

### Empfehlung
- **Jetzt (R1) die Grundlage legen**, aber Integrationen bewusst zurückstellen.
- Domänenmodell trennen in:
  - `SourceConnection` (vorbereitet, heute nur Upload-Quelle aktiv),
  - `Activity` (anbieterneutral),
  - `RawPayload`/`SourceEvent` (originale Quelldaten),
  - `DerivedMetrics` (berechnete Metriken).
- Upload-/Parsing-Pipeline auf Adapterprinzip ausrichten (aktuell nur TCX freigeschaltet, weitere Dateitypen später zuschaltbar).

### Definition-of-Done (DoD)-Erweiterung
Für Stories mit Datenimport sollte DoD enthalten:
- Quelle oder Dateityp ist als eigener Adapter implementiert (klare Schnittstelle).
- Mapping auf kanonisches Activity-Modell dokumentiert.
- Qualitätsstatus je Feld (vorhanden/geschätzt/nicht verfügbar).
- Idempotenter Import/Upload + Dublettenschutz nachweisbar.

---

## 2) Einheiten als Training/Spiel markieren (inkl. Ergebnis/Logo)

### Bewertung
**Nutzen:** hoch  
**Aufwand:** niedrig bis mittel  
**Risiko:** niedrig

Sehr guter Hebel für interpretierbare Analysen. Metriken sind deutlich wertvoller, wenn klar ist, ob die Einheit ein Spiel, Teamtraining, Reha oder Individualtraining war.

### Empfehlung
- **Früh in R1.5 einführen** als manuelle Klassifikation (Pflichtfeld bei Abschluss oder nachträglich editierbar).
- Grundschema für Kontextfelder:
  - `sessionType` (Spiel, Training, Reha, Athletik, Sonstiges),
  - `result` (z. B. 2:1),
  - `opponent` (optional),
  - `competitionType` (Liga, Pokal, Testspiel),
  - `opponentLogoUrl` (optional).
- In R2 Auswertungen und Vergleiche aktiv auf diesen Kontext aufbauen.

---

## 3) Position im Profil + positionsspezifische Auswertung

### Bewertung
**Nutzen:** hoch  
**Aufwand:** mittel  
**Risiko:** mittel (falsche Normwerte ohne gute Baseline)

Position ist zentral für faire Vergleiche. Ein Außenverteidiger und Innenverteidiger haben unterschiedliche Lastprofile; ohne Positionskontext sind Aussagen oft irreführend.

### Empfehlung
- **R1.5:** Position im Profil erfassen (Primär-/Sekundärposition).
- **R2:** positionsspezifische Benchmarks/Insights.
- **Wichtig:** Pro Session muss eine **tatsächlich gespielte Position** die Profilposition übersteuern können (manueller Override).
- **Nicht zu früh überautomatisieren**: zunächst transparente, einfache Regeln statt Blackbox-Scoring.

---

## Konsolidierter Release-Vorschlag

## R1 (Architektur-Fundament)
- Anbieterneutrales Activity-Domänenmodell + Dateityp-/Source-Adapter-Schnittstelle.
- TCX als erster aktiver Adapter; weitere Dateitypen technisch vorbereiten, aber noch nicht freischalten.
- DoD-Erweiterung für Import-Qualität, Mapping und Idempotenz.

## R1.5 (Kontext zuerst)
- Einheitstypen: Training/Spiel/Reha etc. inkl. editierbarer Kontextfelder.
- Positionsangabe im Profil (Primär-/Sekundärposition).
- Basisfilter in der Analyse: Vergleich nach Einheitstyp.

## R2 (Mehrwert aus Kontext)
- Positionsspezifische Insight-Kacheln pro Einheit und im Verlauf.
- Session-Override für gespielte Position und Nutzung in Vergleichen.
- Erweiterte Vergleichsansichten (Spiel vs. Training, Position vs. eigene Baseline).

## R3 (Marktreife + Integrationen)
- Erste echte API-Integration (z. B. Garmin **oder** Polar).
- Import-Automation, Retry-Flows und Quell-spezifisches Monitoring.
- Danach schrittweise weitere Integrationen (z. B. Apple Health), jeweils mit klarer Datenqualitätslogik.

---

## Priorisierte Reihenfolge (kurz)
1. **Datenmodell polymorph machen (R1)**, um spätere Erweiterungen nicht teuer zu machen.
2. **Session-Kontext (Training/Spiel) in R1.5**, weil schneller und sichtbarer Produktnutzen.
3. **Position + Session-Override in R1.5/R2**, damit positionsabhängige Analysen fachlich korrekt sind.
4. **Integrationen erst ab R3**, wenn Kernprodukt und Analysequalität marktreif stabil sind.

## Entscheidungsempfehlung
Wenn nur ein Thema sofort gestartet werden kann: **Thema 1 (polymorphes Datenmodell)** zuerst.  
Wenn parallel ein „sichtbarer“ Nutzerwert gewünscht ist: Thema 2 direkt danach in **R1.5** einplanen.
