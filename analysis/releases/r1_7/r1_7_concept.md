
# ⚽ Amateur Football Analyzer – Analyse & UI Konzept (BA Dokument)

## 1. Zielsetzung

Ziel ist es, eine Fußball-Analyse-App für Amateurspieler zu entwickeln, die:

* Spiel- und Trainingsdaten verständlich darstellt
* Leistungsentwicklung sichtbar macht
* Belastungsdimensionen trennt analysiert
* Vergleichsmöglichkeiten bietet (Halbzeit, letzte Sessions, Bestwerte)
* Raum- und Zeitdimension kombiniert (Heatmap + Timeline)

Die App soll sowohl schnelle Übersicht als auch tiefe Analyse ermöglichen.

---

# 2. Belastungsdimensionen (Konzeptionelle Grundlage)

Die Analyse basiert auf vier Belastungsdimensionen:

## 2.1 Volume (Umfang)

* Distance
* Duration
* Running Density (m/min)

## 2.2 Speed / High-Speed

* Maximum speed
* High-intensity time
* High-intensity runs
* of which sprint phases
* High-speed distance
* of which sprint phase distance

## 2.3 Mechanical Load

* Accelerations
* Decelerations
* Direction Changes

## 2.4 Internal Load

* Heart Rate (min/avg/max)
* HR Zones
* TRIMP (Edwards)
* TRIMP/min
* HR Recovery 60s

Diese Dimensionen sind keine Navigationselemente, sondern strukturieren Inhalte innerhalb der Views.

---

# 3. Seitenstruktur (Session Detail)

## 3.1 Header (bleibt konstant)

Enthält:

* Session-Datum
* Spiel / Training
* Gegner (optional)
* Kern-KPIs (siehe KPI-Definition unten)

---

## 3.2 Tabs / Hauptbereiche

1. Overview (Aggregiert)
2. Timeline (Zeitverlauf)
3. Peak Demand (Rolling Analyse)
4. Segments (Block / Halbzeitvergleich)
5. Heatmap (Raumdarstellung)

---

# 4. Overview (Aggregierte Analyse)

## Ziel

Schnelle Einordnung der Session in allen 4 Dimensionen.

## Struktur (Mobile: Accordion / Desktop: Sections)

### 4.1 Volume

* Distance
* Duration
* Running Density

### 4.2 Speed

* Maximum speed
* High-intensity time
* High-intensity runs
* of which sprint phases
* High-speed distance
* of which sprint phase distance

### 4.3 Mechanical

* Accelerations
* Decelerations
* Direction Changes

### 4.4 Internal

* HR min/avg/max
* HR Zones (gestapelte Progressbar)
* TRIMP
* TRIMP/min
* HR Recovery 60s

---

# 5. KPI Card Definition (pro Metrik)

Jede KPI wird als Card dargestellt mit folgender Struktur:

## KPI Card Struktur

* Primary Value (groß)
* Einheit (kleiner)
* Label (z. B. „High-Speed Distance“)
* Optional: Vergleichswert (Ø letzte 5 Sessions)
* Optional: Bestwert (Saison)
* Info-Icon mit Definition
* Action:

  * „Zur Timeline“
  * „Peak Analyse anzeigen“

## Beispiel: Distance Card

Primary: 5.56 km
Secondary: 5,562 m
Comparison: Ø letzte 5 = 5.32 km
Best: 5.88 km

Actions:

* „Peak anzeigen“
* „Im Verlauf anzeigen“

---

# 6. Timeline Analyse

## Ziel

Synchronisierte Zeitdarstellung aller Belastungsdimensionen.

## Struktur

Charts untereinander mit gemeinsamer X-Achse (Zeit):

1. m/min (Volume)
2. Speed + HSR Events
3. Accel/Decel Events
4. HR

## Steuerung

* Mode:

  * Instant
  * Rolling
* Rolling Window:

  * 1 min
  * 2 min
  * 5 min

Peaks werden visuell markiert.

---

# 7. Peak Demand Analyse

## Definition

Peak = höchster Wert innerhalb eines gleitenden Fensters (Rolling Window).

Fenstergrößen:

* 1 min
* 2 min
* 5 min

Standard = 5 min

---

## Darstellung

### Window Selector:
Dropdown
◉ 5 min
○ 2 min
○ 1 min

---

## Struktur nach Dimension

### 7.1 Volume

| Metric   | Peak | Ø letzte 5 | Best Saison |
| -------- | ---- | ---------- | ----------- |
| Distance |      |            |             |

---

### 7.2 Speed

| Metric              | Peak | Ø letzte 5 | Best |
| ------------------- | ---- | ---------- | ---- |
| High-Speed Distance |      |            |      |

---

### 7.3 Mechanical

| Metric        | Peak | Ø | Best |
| ------------- | ---- | - | ---- |
| Accelerations |      |   |      |

---

### 7.4 Internal

| Metric    | Peak | Ø | Best |
| --------- | ---- | - | ---- |
| TRIMP/min |      |   |      |

---

## Interaktion

* Klick auf Peak → springt in Timeline
* Peak-Zeitfenster wird markiert

---

# 8. Segments Analyse

## Ziel

Leistungsabfall oder Unterschiede analysieren.

## Segmenttypen

* Entire Session
* Custom Segments (manuell definierbar)

---

## Darstellung

| Metric | HZ1 | HZ2 | Δ |
| ------ | --- | --- | - |

Optional:

* Prozentuale Differenz
* Ampelfarbe

---

# 9. Heatmap

## Ziel

Räumliche Analyse ergänzen.

Funktionen:

* Gesamte Session
* Segmentfilter
* Filter:

  * All Movement
  * High-Speed only
  * Accels only

Heatmap ist orthogonal zur Zeitachse.
Hint: we will keep the maps as they are at the moment - but we add a accel/deccel map, with at least 3 points for display reasons
---

# 10. Rolling vs Block (fachliche Definition)

## Rolling Window

* Gleitendes Fenster
* Findet echte Peaks
* Geeignet für:

  * Peak Demand
  * Trainingssteuerung

## Block Analyse

* Feste Intervalle
* Geeignet für:

  * Ermüdungsanalyse
  * Halbzeitvergleich

---

# 11. Vergleichslogik

Unterstützte Vergleiche:

* Ø letzte 3–5 Sessions
* Saison-Bestwert
* Segmentvergleich
* Optional: Gegnervergleich (Zukunft)

---

# 12. Dimension Score (Next Step Konzept)

## Ziel

Belastungsdimensionen bewerten.

Für jede Dimension wird ein relativer Score berechnet:

Beispiel:

Volume Score =
(5-min Peak Distance / Ø letzte 5 Spiele 5-min Peak Distance) × 100

Interpretation:

* < 90% → unterdurchschnittlich
* 90–105% → normal
* > 105% → hohe Belastung

---

## Dimension Score Darstellung

Overview → kleine Score-Badges pro Dimension:

Volume: 102%
Speed: 95%
Mechanical: 110%
Internal: 98%

Optional mit Ampelfarbe.

---

# 13. MVP Priorisierung

Phase 1:

* Overview
* Timeline (Instant)
* Peak 5 min
* Halbzeitvergleich

Phase 2:

* Rolling 1/2 min
* Ø letzte 5 Sessions
* Heatmap Segmentfilter

Phase 3:

* Dimension Score
* Bestwerte
* Trendanalyse

---

# 14. Zusammenfassung

Die App kombiniert:

* Aggregierte Analyse (Overview)
* Zeitbasierte Analyse (Timeline)
* Intensitätsanalyse (Peak Demand)
* Strukturvergleich (Segments)
* Raumdarstellung (Heatmap)

Die 4 Belastungsdimensionen strukturieren alle Inhalte logisch, sind aber keine separate Navigation.
