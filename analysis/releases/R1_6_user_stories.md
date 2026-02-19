# R1.6 – User Stories (Tiefenanalyse, HF-only-Robustheit, Segmentierung)

## Zielbild R1.6
R1.6 hebt die Analyse von Einzelwerten auf kontextbezogene Tiefenanalyse: robuste Auswertung bei HF-only-Sessions, gleichwertige Analysen für Gesamt- und Segmentebene sowie aussagekräftige Vergleiche über Zeitfenster, Segmente und Session-Typen hinweg.

---

## User Stories in Priorisierungs-Reihenfolge (Must → Should → Could)

## Must-have

## Story R1.6-01: Data-Availability Layer (Dual/HF-only/GPS-only)
**Als** Nutzer
**möchte ich** transparent sehen, welche Datengrundlage in meiner Session verfügbar ist
**damit** ich die angezeigten Insights korrekt interpretieren kann.

### Acceptance Criteria
- [x] Pro Session wird automatisch ein Datenmodus erkannt: Dual, HF-only oder GPS-only.
- [x] Der aktive Datenmodus ist in Session-Liste und Session-Detail klar sichtbar.
- [x] Insights, die im aktiven Modus nicht valide sind, werden ausgeblendet oder als „nicht verfügbar“ markiert.
- [x] Die UI erklärt den Grund (z. B. „GPS nicht vorhanden“ vs. „GPS unbrauchbar“).

---

## Story R1.6-02: HF-only Insight Pack
**Als** Nutzer mit nur Herzfrequenzdaten
**möchte ich** trotzdem eine vollwertige Analyse erhalten
**damit** die App auch ohne GPS-Hardware einen praktischen Mehrwert liefert.

### Acceptance Criteria
- [ ] Für HF-only-Sessions werden mindestens angezeigt: ØHF, MaxHF, Zeit in HF-Zonen, Zeit >85% HFmax, TRIMP, TRIMP/min.
- [ ] Die Session-Ansicht enthält eine kurze Interpretationshilfe für HF-only-Ergebnisse.
- [ ] Nicht verfügbare GPS-Metriken erscheinen nicht als Nullwerte.
- [ ] HF-only-Sessions sind in Vergleichen mit korrekter Kennzeichnung nutzbar.

---

## Story R1.6-03: Session in Unter-Sessions segmentieren
**Als** Nutzer
**möchte ich** eine Session in inhaltliche Phasen aufteilen (z. B. Warm-up, Torschuss, Abschlussspiel, Halbzeiten)
**damit** ich die Analyse auf realistische Trainings-/Spielphasen anwenden kann.

### Acceptance Criteria
- [ ] Nutzer kann Segmente mit Label, Start- und Endzeit anlegen.
- [ ] Segmente sind editierbar (umbenennen, verschieben, löschen, zusammenführen).
- [ ] Segmente dürfen sich nicht unzulässig überlappen.
- [ ] Segmentgrenzen werden versioniert gespeichert, sodass Änderungen nachvollziehbar bleiben.

---

## Story R1.6-04: Nachträgliche Segmentierung mit Verlaufshilfe
**Als** Nutzer
**möchte ich** Segmentgrenzen nachträglich über HF-/GPS-Verläufe setzen
**damit** ich Sessions auch im Nachhinein effizient strukturieren kann.

### Acceptance Criteria
- [ ] Segmentierung kann in einer Zeitachsen-Ansicht mit HF- und (falls verfügbar) GPS-basierten Intensitätskurven erfolgen.
- [ ] Das System kann sinnvolle Segmentvorschläge (Schnittpunkte) anzeigen.
- [ ] Nutzer kann Vorschläge übernehmen, anpassen oder verwerfen.
- [ ] Bei HF-only funktionieren Vorschläge und manuelle Segmentierung weiterhin zuverlässig.

---

## Story R1.6-05: Analyse-Parität zwischen Gesamtsession und Segmenten
**Als** Nutzer
**möchte ich** auf Segmenten exakt die gleichen Auswertungsarten wie auf der Gesamtsession nutzen
**damit** ich Phasenanalysen ohne Funktionsverlust durchführen kann.

### Acceptance Criteria
- [ ] Jede auf Session-Ebene verfügbare Auswertung ist auch auf Segment-Ebene verfügbar (sofern Datengrundlage vorhanden).
- [ ] Gleiches gilt umgekehrt: Segment-Auswertungen folgen denselben Definitionsregeln wie Session-Auswertungen.
- [ ] Heatmaps, Metrik-Kacheln, Zeitreihen, Vergleiche und Quality-Hinweise nutzen identische Berechnungslogik zwischen Session und Segment.
- [ ] Bei fehlender Datengrundlage auf Segmentebene wird konsistent derselbe „nicht verfügbar“-Mechanismus wie auf Session-Ebene verwendet.

---

## Story R1.6-06: Zeitfenster- und Segment-Intensitätsprofil
**Als** Nutzer
**möchte ich** Intensitätsverläufe je Zeitfenster und Segment sehen
**damit** ich Belastungsabfälle, Peaks und Phasenunterschiede erkennen kann.

### Acceptance Criteria
- [ ] Intensitätsprofile zeigen mindestens Distanz/min, HSR/min (wenn GPS), %Zeit >85% HFmax, TRIMP/min.
- [ ] Nutzer kann zwischen Zeitfensteransicht und Segmentansicht umschalten.
- [ ] Fehlende Datenbereiche sind visuell markiert.
- [ ] Peaks und Drop-offs sind mit Tooltips numerisch nachvollziehbar.

---

## Story R1.6-08: Bestehende Profil-Granularität 1/2/5 Minuten beibehalten
**Als** Bestandsnutzer
**möchte ich** weiterhin mit 1-, 2- oder 5-Minuten-Granularität vergleichen
**damit** mein etablierter Analyse-Workflow erhalten bleibt.

### Acceptance Criteria
- [ ] Profil-/Vergleichsansichten bieten weiterhin die Auswahl 1, 2, 5 Minuten.
- [ ] Neue R1.6-Funktionen sind mit allen drei Granularitäten kompatibel.
- [ ] Die gewählte Granularität bleibt pro Nutzerprofil persistent gespeichert.
- [ ] Es gibt keine erzwungene Umstellung auf nur eine Standardauflösung.

---

## Should-have

## Story R1.6-07: Vergleichsansicht Training vs. Spiel inkl. Segmentebene
**Als** Nutzer
**möchte ich** Training und Spiel miteinander vergleichen
**damit** ich erkenne, ob meine Trainingsbelastung spielnah ist.

### Acceptance Criteria
- [ ] Vergleich ist nach Session-Typ filterbar (mindestens Training vs. Spiel).
- [ ] Vergleich funktioniert in Dual- und HF-only-Konstellationen.
- [ ] Segmentvergleich ist verfügbar (z. B. Abschlussspiel vs. erste Halbzeit).
- [ ] Ergebnis enthält einen klaren Gap-Hinweis (Unterforderung / passend / Überforderung).

---

## Story R1.6-09: Kombi-Insight „interne vs. externe Last“ (Dual Mode)
**Als** Nutzer mit GPS+HF
**möchte ich** interne und externe Last in einer gemeinsamen Kennzahl sehen
**damit** ich Belastungseffizienz und mögliche Überlastung schneller erkenne.

### Acceptance Criteria
- [ ] Kombi-Insight wird nur bei Dual-Mode-Sessions angezeigt.
- [ ] Kennzahl kombiniert mindestens externe Last/min und interne Last/min (z. B. TRIMP pro 100 m).
- [ ] Insight wird mit einfacher Ampellogik (niedrig/mittel/hoch) ergänzt.
- [ ] Erklärungstext beschreibt Aussagekraft und Grenzen der Kennzahl.

---

## Story R1.6-10: Datenqualitäts- und Segmentqualitäts-Hinweise
**Als** Nutzer
**möchte ich** Datenqualität pro Session und Segment sehen
**damit** ich die Verlässlichkeit meiner Analyse realistisch einschätzen kann.

### Acceptance Criteria
- [ ] Session- und Segmentansicht zeigen Verfügbarkeiten (GPS/HF), Lückenquote und Qualitätsstatus.
- [ ] Qualitätswarnungen werden in Vergleichen berücksichtigt (sichtbar markiert).
- [ ] „Nicht gemessen“ und „Messung unbrauchbar“ bleiben fachlich getrennt.
- [ ] Qualitätsstatus ist in Export/Share-Ansichten mit enthalten.

---

## Could-have

## Story R1.6-11: Segment-Vorlagen (Template-basierte Segmentierung)
**Als** Nutzer
**möchte ich** Vorlagen für wiederkehrende Session-Strukturen nutzen
**damit** ich Sessions schneller und konsistenter segmentieren kann.

### Acceptance Criteria
- [ ] Es gibt mindestens Vorlagen für „Spiel“ und „Training“.
- [ ] Vorlagen können vor oder nach dem Upload auf eine Session angewendet werden.
- [ ] Vorschlagszeiten sind editierbar und nicht erzwungen.
- [ ] Nutzer kann eigene Vorlagen speichern und wiederverwenden.

---

## Story R1.6-12: Segmenttrends über Wochen vergleichen
**Als** Nutzer
**möchte ich** gleiche Segmenttypen über mehrere Sessions vergleichen
**damit** ich Fortschritte in spezifischen Phasen (z. B. Warm-up, Abschlussspiel) erkenne.

### Acceptance Criteria
- [ ] Vergleich nach Segmentlabel über mehrere Sessions ist möglich.
- [ ] Trends werden für HF-only und Dual-Mode korrekt dargestellt.
- [ ] Ausreißer/fehlende Daten sind im Trendchart klar markiert.
- [ ] Trendansicht unterstützt die Profil-Granularität 1/2/5 Minuten.

---

## Priorisierung für R1.6

### Must-have
- R1.6-01 Data-Availability Layer
- R1.6-02 HF-only Insight Pack
- R1.6-03 Session-Segmentierung
- R1.6-04 Nachträgliche Segmentierung mit Verlaufshilfe
- R1.6-05 Analyse-Parität Session ↔ Segmente
- R1.6-06 Zeitfenster-/Segment-Intensitätsprofil
- R1.6-08 Beibehaltung 1/2/5-Minuten-Granularität

### Should-have
- R1.6-07 Training-vs-Spiel inkl. Segmentvergleich
- R1.6-09 Kombi-Insight interne vs. externe Last
- R1.6-10 Datenqualitäts-/Segmentqualitäts-Hinweise

### Could-have
- R1.6-11 Segment-Vorlagen
- R1.6-12 Segmenttrends über Wochen

---

## Ausblick (nicht R1.6)
- Positionsspezifische Auswertungen mit Feldgrößen-Normalisierung.
- Erweiterte rollenbasierte Benchmarks erst nach stabiler Datengrundlage über mehrere Teams/Saisons.
