# Ergänzende Recherche & Product-Ideen (inkl. Release-Vorschlag)

## Vorgehen der Recherche
Als Grundlage wurden genutzt:
1. die bestehende interne Analyse im Repository (`analysis/Auswertung ... pdf`),
2. praxisnahe Anforderungen für GPS-/HF-basierte Fußballanalyse (Load-Management, Interpretierbarkeit, Datenqualität),
3. Umsetzbarkeit im aktuellen Single-User-Fokus.

---

## Was aus meiner Sicht noch fehlt (priorisiert)

## 1) Datenqualität & Vertrauensniveau je Metrik (Confidence Score)
**Warum sinnvoll:** Nutzer brauchen nicht nur einen Session-Qualitätsstatus, sondern pro Metrik einen Vertrauenswert (z. B. Distanz hoch, Sprintcount mittel).  
**Nutzen:** Bessere Interpretierbarkeit, weniger Fehlentscheidungen.

**Vorschlag Release:** **R1.5**  
**Beispiel AC-Idee:** Jede Kernmetrik hat ein Confidence-Level inkl. Grund (z. B. „GPS-Aussetzer Minute 12–16“).

---

## 2) Individuelle Schwellen-Kalibrierung statt statischer Defaults
**Warum sinnvoll:** Sprint-Schwellen und HF-Zonen sollten stärker individualisiert sein (z. B. auf Basis historischer Peaks, Feldposition, Fitnessstand).  
**Nutzen:** Aussagekräftigere interne/externe Lastprofile.

**Vorschlag Release:** **R2** (Basis), **R2.5** (automatische Vorschläge)  
**Beispiel AC-Idee:** System schlägt neue Schwellen auf Basis der letzten 6–8 Wochen vor, Nutzer bestätigt aktiv.

---

## 3) Readiness-/Belastungsampel für die nächste Einheit
**Warum sinnvoll:** Aus Trends (z. B. TRIMP, Hochintensitätszeit, Erholungsindikatoren) kann ein einfacher „Heute eher locker / normal / intensiv“-Hinweis abgeleitet werden.  
**Nutzen:** Konkreter Mehrwert für Trainingssteuerung im Amateuralltag.

**Vorschlag Release:** **R2.5**  
**Beispiel AC-Idee:** Ampel mit transparenten Treibern (nicht Blackbox), inkl. Disclaimer „Entscheidungshilfe, keine medizinische Diagnose“.

---

## 4) Drill-/Übungs-Tags pro Session und Segment
**Warum sinnvoll:** Werte sind nur im Kontext sinnvoll (z. B. kleines Feld, Abschlussspiel, Laufspiel).  
**Nutzen:** Bessere Vergleichbarkeit und Vermeidung falscher Schlüsse.

**Vorschlag Release:** **R1.5** (manuelle Tags), **R2** (halbautomatische Vorschläge)  
**Beispiel AC-Idee:** Nutzer kann Session/Lap mit Drill-Typ taggen; Vergleichsansicht filtert nach gleichem Drill.

---

## 5) Positions-/Heatmap-Insights in „player-friendly“ Sprache
**Warum sinnvoll:** Roh-Heatmaps sind visuell gut, aber ohne Erklärung schwer nutzbar.  
**Nutzen:** Umsetzbare Coaching-/Selbstcoaching-Impulse („du warst 35 % zentraler als üblich“).

**Vorschlag Release:** **R2** (Heatmap), **R3** (automatische Insight-Texte)  
**Beispiel AC-Idee:** Pro Session 3 kurze, verständliche Insights mit Datenbezug.

---

## 6) Datenimport-Robustheit & Deduplizierung über Geräte hinweg
**Warum sinnvoll:** Nutzer laden oft dieselbe Einheit mehrfach oder aus unterschiedlichen Exporten hoch.  
**Nutzen:** Saubere Historie und stabile Trends.

**Vorschlag Release:** **R2**  
**Beispiel AC-Idee:** Duplikatserkennung über Hash + Zeitfenster + Trackpunkt-Signatur.

---

## 7) Datenschutz- und Exportkontrolle (Single User)
**Warum sinnvoll:** Bei Gesundheits-/Leistungsdaten sind Transparenz und Kontrolle zentral.  
**Nutzen:** Vertrauen und rechtliche Robustheit.

**Vorschlag Release:** **MVP/R1** (Basis), **R2** (vollständig)  
**Beispiel AC-Idee:** „Meine Daten löschen“ und „Alle Rohdaten + berechnete Daten exportieren“ mit Audit-Log.

---

## 8) Device-Profiling (Uhr ohne GPS vs. mit GPS)
**Warum sinnvoll:** Unterschiedliche Geräte liefern unterschiedliche Datenqualität und Felder.  
**Nutzen:** Korrekte Erwartung an verfügbare Metriken und bessere Fallbacklogik.

**Vorschlag Release:** **R1**  
**Beispiel AC-Idee:** Beim Upload wird ein Geräteprofil erkannt; UI zeigt „diese Metriken sind auf deinem Gerät verlässlich verfügbar“.

---

## 9) Coaching-Ansicht für Verlauf in Zeitfenstern + Runden
**Warum sinnvoll:** Ihr habt bereits Intervall-/Lap-Themen, aber der Mehrwert steigt mit kombinierten Ansichten (z. B. Runde 3 in 1-Min-Fenstern).  
**Nutzen:** Präziser Blick auf Leistungsabfall in Spielphasen.

**Vorschlag Release:** **R2.5**  
**Beispiel AC-Idee:** Zeitfenster-Aggregation ist auf Gesamt-Session und auf einzelne Laps anwendbar.

---

## 10) „Explainability Panel“ pro Kennzahl
**Warum sinnvoll:** Neben Metrik-Tooltip sollte es eine tiefere Ebene geben (Formel, Datenquellen, Ausschlussgründe).  
**Nutzen:** Maximales Vertrauen für datenaffine Nutzer.

**Vorschlag Release:** **R2**  
**Beispiel AC-Idee:** Klick auf Metrik öffnet Panel: Formel, Inputs, Qualitätsregeln, bekannte Limitationen.

---

## Empfohlene neue Release-Etappen (optional)
- **R2.5 (Insight & Decision Support):** Readiness-Ampel, kombinierte Intervall+Lap-Analysen, automatische Schwellen-Vorschläge.
- **R3 (Intelligent Coaching):** explainable Insights in Alltagssprache, kontextbasierte Empfehlungen je Drill/Session-Typ.

---

## Kurzfazit
Die aktuelle Roadmap ist bereits sehr solide. Der größte zusätzliche Hebel liegt nun bei:
1. **Vertrauenswürdigkeit pro Metrik** (Confidence + Explainability),
2. **stärkerer Kontext** (Drills, Laps, Zeitfenster kombiniert),
3. **Handlungsempfehlungen statt nur Reporting** (Readiness/Insights).
