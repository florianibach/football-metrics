# R1.5 – User Stories (Nutzbarkeit, Vergleichbarkeit, datengetriebene Iteration)

## Zielbild R1.5
R1.5 stabilisiert und verbessert die Nutzung im Alltag: bessere Vergleichsansichten, erste Personalisierung und klare Qualitätstransparenz, um die Analysen über mehrere Sessions hinweg bewertbar zu machen.

---

## Story R1.5-01: Sessions vergleichen
**Als** Nutzer  
**möchte ich** zwei oder mehr Sessions vergleichen  
**damit** ich Trainingsfortschritte und Belastungsunterschiede erkennen kann.

### Acceptance Criteria
- [ ] Nutzer kann mindestens 2 Sessions auswählen und nebeneinander vergleichen.
- [ ] Vergleich enthält Kernmetriken aus R1 inkl. Qualitätsstatus je Session.
- [ ] Unterschiede werden visuell hervorgehoben (z. B. +/− Prozent oder absolute Delta-Werte).
- [ ] Bei unterschiedlicher Datenqualität wird ein Warnhinweis angezeigt, um Fehlinterpretation zu vermeiden.

---

## Story R1.5-02: Metriken über 1-, 2- und 5-Minuten-Intervalle aggregieren
**Als** Nutzer  
**möchte ich** Metriken in 1-, 2- und 5-Minuten-Fenstern sehen  
**damit** ich erkenne, wie sich Intensität und Belastung über den Spielverlauf verändern.

### Acceptance Criteria
- [ ] Die Session-Analyse bietet umschaltbare Aggregation für 1, 2 und 5 Minuten.
- [ ] Für jedes Fenster werden mindestens interne und externe Kernmetriken zeitlich aggregiert dargestellt.
- [ ] Die Aggregation arbeitet auf Zeitbasis robust auch bei leicht unregelmäßigen Trackpunkt-Abständen.
- [ ] Fehlende Datenbereiche werden sichtbar markiert und nicht still interpoliert.

---

## Story R1.5-03: Individuelle Metrik-Schwellen konfigurieren
**Als** Nutzer  
**möchte ich** Schwellenwerte (z. B. Sprinttempo, HF-Zonen) konfigurieren  
**damit** die Auswertung zu meinem Leistungsstand passt.

### Acceptance Criteria
- [ ] Einstellbare Schwellen sind in einem persönlichen Profilbereich änderbar.
- [ ] Änderungen gelten mindestens für neue Analysen und sind nachvollziehbar versioniert.
- [ ] Das System validiert Eingaben (z. B. realistische Wertebereiche).
- [ ] Die aktuell verwendeten Schwellen sind in der Session-Ansicht sichtbar.

---

## Story R1.5-04: Interne und externe Metriken in der UI trennen
**Als** Nutzer  
**möchte ich** interne und externe Metriken getrennt dargestellt sehen  
**damit** ich Belastungssignale besser einordnen kann.

### Acceptance Criteria
- [ ] Die UI unterscheidet klar zwischen „internen“ Metriken (z. B. HF-basiert) und „externen“ Metriken (z. B. Distanz/Geschwindigkeit).
- [ ] Jede Metrik ist genau einer Kategorie zugeordnet.
- [ ] In beiden Kategorien wird erklärt, was die Kategorie bedeutet.
- [ ] Filter oder Tabs erlauben die fokussierte Ansicht je Kategorie.

---

## Story R1.5-05: Qualitäts- und Verarbeitungstransparenz erweitern
**Als** Nutzer  
**möchte ich** verstehen, wie Analyseergebnisse zustande kommen  
**damit** ich den Kennzahlen besser vertraue.

### Acceptance Criteria
- [ ] Für jede Session ist ein Kurzprotokoll verfügbar (Importstatus, erkannte Datenlücken, angewandte Glättung, Metrikvoraussetzungen).
- [ ] Kritische Verarbeitungsschritte sind zeitlich protokolliert.
- [ ] Fehlgeschlagene Berechnungen enthalten einen klaren Grund und Handlungsempfehlung.
- [ ] Das Protokoll ist exportier- oder kopierbar (für Nachvollziehbarkeit und Support).
