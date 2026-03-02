# 📄 Fachliche Definition – Rolling Window & Peak Demand Analyse

## 1. Zielsetzung

Die Peak-Demand-Analyse dient dazu, die **maximalen Belastungsanforderungen innerhalb einer Session** zu identifizieren.
Sie beantwortet die Frage:

> Wie hoch war die intensivste Phase des Spiels in einem definierten Zeitfenster?

Die Analyse basiert auf einer **Rolling Window (Gleitfenster) Berechnung**.

---

# 2. Rolling Window – Fachliche Definition

## 2.1 Grundprinzip

Ein Rolling Window ist ein **gleitendes Zeitfenster fester Länge**, das über die gesamte Session verschoben wird.

Beispiel bei 5 Minuten:

* Fenster 1: 00:00 – 05:00
* Fenster 2: 00:01 – 05:01
* Fenster 3: 00:02 – 05:02
* ...
* bis Session-Ende

Das Fenster wird kontinuierlich verschoben (kein Block-Intervall).

---

## 2.2 Abgrenzung zu Block-Intervallen

Block-Analyse (nicht Rolling):

* 00:00 – 05:00
* 05:00 – 10:00
* 10:00 – 15:00

Rolling:

* Fenster verschiebt sich kontinuierlich
* Peak kann z. B. bei 03:17 – 08:17 liegen
* Keine künstliche Segmentierung

Rolling ist fachlich korrekt für Peak-Demand-Analyse.

---

# 3. Peak Demand – Fachliche Definition

## 3.1 Definition

Ein Peak ist:

> Der höchste berechnete Wert eines Rolling Windows innerhalb einer Session.

Formal:

Peak(metric, window) =
max( RollingValue(metric, window, t) )
für alle t innerhalb der Session

---

# 4. Berechnungslogik pro Metriktyp

Je nach Metriktyp unterscheidet sich die Rolling-Berechnung.

---

## 4.1 Rolling Sum (Summenmetriken)

Anzuwenden für:

* Distance
* High-Speed Distance
* Sprint Distance
* TRIMP (falls rolling genutzt)
* High-Intensity Time

Berechnung:

RollingSum(t) =
Summe aller Werte im Zeitfenster [t - window, t]

Peak = Maximum aller RollingSum(t)

---

## 4.2 Rolling Count (Ereignismetriken)

Anzuwenden für:

* Accelerations
* Decelerations
* High-Intensity Runs
* Sprint Count
* Direction Changes

Berechnung:

RollingCount(t) =
Anzahl Events im Zeitfenster [t - window, t]

Peak = Maximum aller RollingCount(t)

---

## 4.3 Rolling Average (Dichte-/Intensitätsmetriken)

Anzuwenden für:

* TRIMP/min
* Heart Rate (falls rolling dargestellt)
* Running Density (optional)

Berechnung:

RollingAverage(t) =
Durchschnittswert der Metrik im Zeitfenster [t - window, t]

Peak = Maximum aller RollingAverage(t)

---

# 5. Unterstützte Fenstergrößen

Rolling Window unterstützt:

* 1 Minute
* 2 Minuten
* 5 Minuten

Default: 5 Minuten

---

# 6. Zeitauflösung

Rolling-Fenster werden:

* Über die vorhandene Zeitauflösung der Session berechnet
* Basierend auf der bestehenden Aggregationslogik (Backend)
* Nicht blockbasiert
* Keine Downsampling-Neuberechnung im Frontend

---

# 7. Interpretation der Peak-Werte

Peak-Werte repräsentieren:

* Die intensivste Phase des Spiels
* Nicht zwingend eine Halbzeit
* Nicht zwingend einen Block
* Nicht zwingend die Phase mit maximalem Wert einer anderen Dimension

Peaks verschiedener Metriken können zu unterschiedlichen Zeitpunkten auftreten.

Dies ist fachlich korrekt und gewünscht.

---

# 8. Interaktion in der UI

* Auswahl des Rolling-Fensters (1/2/5 Minuten)
* Anzeige der Peak-Werte pro Metrik
* Klick auf Peak → Navigation zur Timeline
* Markierung des zugehörigen Zeitfensters in der Timeline

---

# 9. Nicht-Ziel von R1.7

* Keine neue mathematische Definition von TRIMP
* Keine neue Event-Erkennung
* Keine neue Schwellenwertdefinition
* Kein positionsspezifischer Vergleich

R1.7 nutzt bestehende Berechnungslogik.

---

# 10. Beispiel (Distance 5-Minuten Rolling)

Wenn im Zeitfenster 12:37–17:37
die größte zurückgelegte Distanz 812 m beträgt,

dann:

Peak 5-min Distance = 812 m

---

# 11. Performance-Anforderung

Rolling- und Peak-Werte:

* Werden serverseitig berechnet oder voraggregiert
* Nicht clientseitig O(n²) berechnet
* Ziel: Rendering < 300 ms nach Tab-Wechsel

---

# 12. Zusammenfassung

Rolling Window = gleitendes Zeitfenster
Peak = maximaler Rolling-Wert innerhalb der Session

Peak Demand Analyse dient der Identifikation maximaler Belastungsanforderungen in definierten Zeitfenstern.
