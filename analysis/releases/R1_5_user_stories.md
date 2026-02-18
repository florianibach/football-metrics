# R1.5 – User Stories (Nutzbarkeit, Vergleichbarkeit, datengetriebene Iteration)

## Zielbild R1.5
R1.5 stabilisiert und verbessert die Nutzung im Alltag: bessere Vergleichsansichten, erste Personalisierung und klare Qualitätstransparenz, um die Analysen über mehrere Sessions hinweg bewertbar zu machen.

---

## Story R1.5-01: Sessions vergleichen
**Als** Nutzer
**möchte ich** zwei oder mehr Sessions vergleichen  
**damit** ich Trainingsfortschritte und Belastungsunterschiede erkennen kann.

### Acceptance Criteria
- [x] Nutzer kann mindestens 2 Sessions auswählen und nebeneinander vergleichen.
- [x] Vergleich enthält Kernmetriken aus R1 inkl. Qualitätsstatus je Session.
- [x] Unterschiede werden visuell hervorgehoben (z. B. +/− Prozent oder absolute Delta-Werte).
- [x] Bei unterschiedlicher Datenqualität wird ein Warnhinweis angezeigt, um Fehlinterpretation zu vermeiden.

---

## Story R1.5-02: Metriken über 1-, 2- und 5-Minuten-Intervalle aggregieren
**Als** Nutzer
**möchte ich** Metriken in 1-, 2- und 5-Minuten-Fenstern sehen  
**damit** ich erkenne, wie sich Intensität und Belastung über den Spielverlauf verändern.

### Acceptance Criteria
- [x] Die Session-Analyse bietet umschaltbare Aggregation für 1, 2 und 5 Minuten.
- [x] Für jedes Fenster werden mindestens interne und externe Kernmetriken zeitlich aggregiert dargestellt.
- [x] Die Aggregation arbeitet auf Zeitbasis robust auch bei leicht unregelmäßigen Trackpunkt-Abständen.
- [x] Fehlende Datenbereiche werden sichtbar markiert und nicht still interpoliert.

---

## Story R1.5-03: Session-Typ und Spielkontext erfassen
**Als** Nutzer
**möchte ich** eine Einheit als Training, Spiel oder Reha markieren und bei Spielen Kontextdaten pflegen  
**damit** die Analyse fachlich korrekt eingeordnet ist.

### Acceptance Criteria
- [x] Jede Session kann mindestens als „Training“, „Spiel“, „Reha“, „Athletik“ oder „Sonstiges“ klassifiziert werden.
- [x] Für Spiel-Sessions sind Kontextfelder wie Ergebnis, Wettbewerb, Gegnername und optional Gegner-Logo erfassbar.
- [x] Kontextdaten sind nachträglich editierbar.
- [x] Session-Listen und Detailseiten zeigen den Session-Typ klar sichtbar an.

---

## Story R1.5-04: Position im Profil hinterlegen
**Als** Nutzer
**möchte ich** meine Primär- und Sekundärposition im Profil speichern  
**damit** spätere positionsspezifische Auswertungen auf einer sauberen Basis starten.

### Acceptance Criteria
- [x] Profil erlaubt die Angabe einer Primärposition.
- [x] Optional kann eine Sekundärposition gepflegt werden.
- [x] Ungültige oder unvollständige Positionsangaben werden sauber validiert.
- [x] Die aktuell hinterlegte Position ist in den Profileinstellungen klar sichtbar.

---

## Story R1.5-05: Individuelle Metrik-Schwellen konfigurieren
**Als** Nutzer
**möchte ich** Schwellenwerte (z. B. Sprinttempo, HF-Zonen) konfigurieren  
**damit** die Auswertung zu meinem Leistungsstand passt.

### Acceptance Criteria
- [x] Einstellbare Schwellen sind in einem persönlichen Profilbereich änderbar.
- [x] Änderungen gelten mindestens für neue Analysen und sind nachvollziehbar versioniert.
- [x] Das System validiert Eingaben (z. B. realistische Wertebereiche).
- [x] Die aktuell verwendeten Schwellen sind in der Session-Ansicht sichtbar.

---

## Story R1.5-06: Interne und externe Metriken in der UI trennen
**Als** Nutzer
**möchte ich** interne und externe Metriken getrennt dargestellt sehen  
**damit** ich Belastungssignale besser einordnen kann.

### Acceptance Criteria
- [x] Die UI unterscheidet klar zwischen „internen“ Metriken (z. B. HF-basiert) und „externen“ Metriken (z. B. Distanz/Geschwindigkeit).
- [x] Jede Metrik ist genau einer Kategorie zugeordnet.
- [x] In beiden Kategorien wird erklärt, was die Kategorie bedeutet.
- [x] Filter oder Tabs erlauben die fokussierte Ansicht je Kategorie.

---

## Story R1.5-07: Qualitäts- und Verarbeitungstransparenz erweitern
**Als** Nutzer
**möchte ich** verstehen, wie Analyseergebnisse zustande kommen  
**damit** ich den Kennzahlen besser vertraue.

### Acceptance Criteria
- [ ] Für jede Session ist ein Kurzprotokoll verfügbar (Importstatus, erkannte Datenlücken, angewandte Glättung, Metrikvoraussetzungen).
- [ ] Kritische Verarbeitungsschritte sind zeitlich protokolliert.
- [ ] Fehlgeschlagene Berechnungen enthalten einen klaren Grund und Handlungsempfehlung.
- [ ] Das Protokoll ist exportier- oder kopierbar (für Nachvollziehbarkeit und Support).

---

## Story R1.5-08: Bevorzugten Glättungsfilter im Profil hinterlegen
**Als** Nutzer
**möchte ich** meinen Standard-Glättungsfilter im Profil konfigurieren  
**damit** neue Sessions automatisch mit meiner bevorzugten Voreinstellung starten.

### Acceptance Criteria
- [x] Im Profil kann ein Default-Filter (Raw, AdaptiveMedian, Savitzky-Golay, Butterworth) gesetzt werden.
- [x] Der Profil-Default wird bei neuen Session-Analysen automatisch vorausgewählt.
- [x] Pro Session kann der Nutzer den Profil-Default weiterhin manuell überschreiben.
- [x] In der Session ist transparent erkennbar, ob der aktive Filter aus dem Profil-Default stammt oder manuell geändert wurde.

---

## Story R1.5-09: Session mit aktuellem Profil neu berechnen
**Als** Nutzer
**möchte ich** eine bereits analysierte Session mit meinen aktuell gültigen Profileinstellungen neu berechnen
**damit** ich nach Profiländerungen direkt vergleichbare und aktuelle Kennzahlen erhalte.

### Acceptance Criteria
- [ ] In der Session-Ansicht gibt es eine klare Aktion „Mit aktuellem Profil neu berechnen“.
- [ ] Die Rekalkulation verwendet die aktuell aktiven Profileinstellungen (z. B. Schwellen, Filter-Default, Einheitenpräferenzen).
- [ ] Das System dokumentiert, mit welchem Profilstand (Version/Timestamp) die alte und neue Berechnung erfolgt ist.
- [ ] Historische Ergebnisse bleiben nachvollziehbar (keine stille Überschreibung ohne Hinweis).

---

## Story R1.5-10: Adaptive vs. fixe Schwellen im Profil konfigurieren
**Als** Nutzer
**möchte ich** je Schwellenwert zwischen fixem Wert und adaptivem Wert wählen können
**damit** ich je nach Metrik entweder stabile Zielwerte oder automatisch gelernte Grenzwerte nutzen kann.

### Acceptance Criteria
- [ ] Für relevante Schwellen kann im Profil pro Feld der Modus „Fix“ oder „Adaptiv“ ausgewählt werden.
- [ ] Der adaptive Modus berechnet den Schwellenwert als Maximum über alle Sessions des Nutzers (mit transparenter Datenbasis).
- [ ] Der aktuell wirksame Wert (inkl. Quelle: fix/adaptiv) wird in Profil und Session nachvollziehbar angezeigt.
- [ ] Validierung und Hinweise verhindern widersprüchliche Konfigurationen.

---

## Story R1.5-11: Standardlogik für High-Intensity und physiologische Grenzwerte
**Als** Nutzer
**möchte ich** sinnvolle Default-Regeln für zentrale Schwellen erhalten
**damit** ich ohne manuelle Feinkonfiguration mit fachlich konsistenten Auswertungen starten kann.

### Acceptance Criteria
- [ ] Der High-Intensity-Speed-Threshold wird als prozentualer Anteil der Max Speed definiert.
- [ ] Max Speed ist standardmäßig auf „Adaptiv“ konfiguriert (Maximum über alle Sessions).
- [ ] Max Heartrate ist standardmäßig auf „Adaptiv“ konfiguriert (Maximum über alle Sessions).
- [ ] Acceleration- und Deceleration-Thresholds sind als fixe Werte konfigurierbar, aber nicht adaptiv erforderlich.
- [ ] In der UI wird pro Schwelle klar erklärt, warum der jeweilige Default gewählt wurde.

---

## Story R1.5-12: Bevorzugte Geschwindigkeitseinheit im Profil festlegen
**Als** Nutzer
**möchte ich** im Profil meine bevorzugte Geschwindigkeitseinheit auswählen (km/h, m/s, min/km)
**damit** alle Auswertungen in einer für mich intuitiven Darstellung erscheinen.

### Acceptance Criteria
- [ ] Das Profil bietet die Auswahl zwischen km/h, m/s und min/km als Standard-Einheit.
- [ ] Neue Session-Analysen übernehmen die Profil-Standard-Einheit automatisch.
- [ ] In Session-Ansichten kann die Einheit bei Bedarf temporär überschrieben werden, ohne den Profil-Default zu verlieren.
- [ ] Konvertierungen werden konsistent und mit eindeutigem Rundungsverhalten dargestellt.

---

## Story R1.5-13: Football Core Metrics um Basis-Belastungsmetriken erweitern
**Als** Nutzer
**möchte ich** zusätzliche Core Metrics (Duration, Heart Rate min/avg/max, Direction Changes) sehen
**damit** ich die Session-Belastung vollständiger bewerten kann.

### Acceptance Criteria
- [ ] Die Football Core Metrics enthalten zusätzlich: Duration, Heart Rate (min/avg/max) und Direction Changes.
- [ ] Jede neue Metrik enthält einen detaillierten Erklärungstext (Definition, Berechnungslogik, Interpretationshilfe).
- [ ] Bei fehlenden Eingangsdaten wird die Metrik transparent als nicht verfügbar gekennzeichnet.
- [ ] Die neuen Metriken sind in Vergleichsansichten konsistent mit vorhandenen Core Metrics nutzbar.
