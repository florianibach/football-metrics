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
- [x] Für HF-only-Sessions werden mindestens angezeigt: ØHF, MaxHF, Zeit in HF-Zonen, Zeit >85% HFmax, TRIMP, TRIMP/min.
- [x] Die Session-Ansicht enthält eine kurze Interpretationshilfe für HF-only-Ergebnisse.
- [x] Nicht verfügbare GPS-Metriken erscheinen nicht als Nullwerte.
- [x] HF-only-Sessions sind in Vergleichen mit korrekter Kennzeichnung nutzbar.

---

## Story R1.6-03: Session in Unter-Sessions segmentieren
**Als** Nutzer
**möchte ich** eine Session in inhaltliche Phasen aufteilen (z. B. Warm-up, Torschuss, Abschlussspiel, Halbzeiten)
**damit** ich die Analyse auf realistische Trainings-/Spielphasen anwenden kann.

### Acceptance Criteria
- [x] Nutzer kann Segmente mit Label, Start- und Endzeit anlegen.
- [x] Segmente sind editierbar (umbenennen, verschieben, löschen, zusammenführen).
- [x] Segmente dürfen sich nicht unzulässig überlappen.
- [x] Segmentgrenzen werden versioniert gespeichert, sodass Änderungen nachvollziehbar bleiben.

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

## Story R1.6-13: GPS-Punkte-Heatmap in GPS- und Dual-Mode ✅ DONE
**Als** Nutzer
**möchte ich** aus den vorhandenen GPS-Punkten eine Heatmap sehen
**damit** ich Lauf- und Positionsschwerpunkte schnell visuell erkennen kann.

### Acceptance Criteria
- [x] Die Heatmap wird angezeigt, wenn der Session-Datenmodus `GPS-only` oder `Dual Mode` ist.
- [x] Die Heatmap basiert auf den tatsächlich importierten GPS-Punkten der Session (keine synthetischen Ersatzdaten).
- [x] Im `HF-only`-Modus wird keine Heatmap gerendert; stattdessen erscheint ein klarer Hinweis, dass GPS-Daten fehlen.
- [x] Die Darstellung ist konsistent mit den bestehenden Heatmap-Ansichten für Gesamt-Session, Zeitfenster und Segmente.

---

## Story R1.6-14: Sprint- & High-Intensity-Trackpoints mit Richtungsdarstellung auf der Karte ✅ DONE
**Als** Nutzer
**möchte ich** Sprint- und High-Intensity-Runs als Trackpoints auf der Karte sehen, inklusive visuell erkennbarer Laufrichtung
**damit** ich intensive Laufaktionen räumlich und zeitlich besser einordnen kann.

### Acceptance Criteria
- [x] Die Kartenansicht bietet eine zusätzliche Layer-/Ansichtsoption für Trackpoints von `Sprints` und `High-Intensity Runs`.
- [x] Sprint-Trackpoints und High-Intensity-Trackpoints sind farblich eindeutig unterscheidbar (z. B. Sprint = Rot, High-Intensity = Orange).
- [x] Die Laufrichtung innerhalb eines Runs ist visuell erkennbar, z. B. über ansteigende Punktgröße oder Richtungspfeile; der letzte Punkt eines Runs ist eindeutig als „Endpunkt“ hervorgehoben.
- [x] Die Karteninteraktion entspricht der Heatmap: Zoomen, Verschieben (Panning) und Reset-Verhalten funktionieren identisch.
- [x] Eine kurze Erklärung in der UI beschreibt, wie die Darstellung zu lesen ist (Farbcode, Start-/Endpunkt, Bedeutung der Richtung).
- [x] Im HF-only-Modus wird die Ansicht nicht dargestellt; stattdessen erscheint ein konsistenter Hinweis auf fehlende GPS-Daten.

### Verständnis-/Erklärungstext (fachlich)
- **Farben:** Jede Farbe steht für eine Intensitätsklasse (`Sprint` vs. `High-Intensity Run`).
- **Richtung:** Die Reihenfolge der Punkte zeigt die Bewegungsrichtung innerhalb eines Laufsegments.
- **Endpunkt-Betonung:** Der größte oder besonders markierte Punkt kennzeichnet den letzten Punkt (Run-Ende) und erleichtert die Interpretation von Laufwegen.
- **Einordnung:** Viele markierte Punkte in einem Feldbereich deuten auf wiederholte intensive Aktionen in dieser Zone hin.

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

## Story R1.6-15: Robuste Run-Detection mit Consecutive-Sample-Logik ✅ DONE
**Als** Nutzer  
**möchte ich** dass High-Intensity-Runs und Sprints nur bei stabiler Geschwindigkeitsüberschreitung erkannt werden  
**damit** kurze GPS-Spikes oder Einzelwerte nicht als echte Belastungsphasen gezählt werden.

### Acceptance Criteria
- [x] Ein Run (HSR oder Sprint) startet nur, wenn mindestens zwei aufeinanderfolgende Samples eine Geschwindigkeit ≥ dem jeweiligen Threshold aufweisen.
- [x] Ein Run endet erst, wenn mindestens zwei aufeinanderfolgende Samples wieder unterhalb des Thresholds liegen.
- [x] Einzelne Geschwindigkeitsspitzen von nur einem Sample dürfen keinen Run auslösen.
- [x] Die Logik funktioniert identisch für HSR und Sprint, wobei jeweils der definierte Schwellenwert verwendet wird.
- [x] Die Berechnung basiert auf 1 Hz GPS-Daten.
- [x] Bereits erkannte valide Runs (z. B. ≥ 2 Sekunden Dauer) bleiben korrekt erfasst.
- [x] Die Run-Distanz wird weiterhin als Summe der zurückgelegten Strecken innerhalb des gültigen Run-Zeitraums berechnet.
- [x] Bestehende Analysen (Peaks, Summen, Anzahl Runs) bleiben konsistent.

---

## Story R1.6-16: Hierarchische Run-Struktur mit differenzierter Sprint-Visualisierung
**Als** Nutzer  
**möchte ich** dass High-Intensity-Runs als übergeordnete Bewegungsphasen erkannt werden und Sprint-Phasen als Intensitätssegmente innerhalb dieser Runs modelliert werden  
**damit** Belastungsdaten sportwissenschaftlich korrekt strukturiert sind und gleichzeitig flexibel analysiert und visuell unterschieden dargestellt werden können.

### Acceptance Criteria
- [ ] Ein Run wird primär als HSR-Run erkannt, basierend auf der definierten Schwellenlogik.
- [ ] Sprint-Phasen werden als Teilsegmente innerhalb eines HSR-Runs gespeichert.
- [ ] Sprint-Phasen besitzen eigene Start- und Endzeitpunkte sowie eigene Distanz- und Dauerwerte.
- [ ] Sprint-Distanz ist stets Teilmenge der HSR-Distanz und wird nicht doppelt addiert.
- [ ] In der Gesamtübersicht werden separat ausgewiesen:
  - Anzahl HSR-Runs
  - Anzahl Sprint-Phasen
  - Gesamt-HSR-Distanz
  - Gesamt-Sprint-Distanz
- [ ] Im Bereich „Sprint & high-intensity trackpoints“ erlaubt die UI folgende Filteroptionen:
  - Show all
  - Only HSR runs
  - Only sprint phases
  - HSR runs with sprint phases
- [ ] Bei „Show all“ werden HSR-Segmente (orange) und Sprint-Segmente (rot) gemeinsam dargestellt.
- [ ] Bei „Only HSR runs“ werden ausschließlich HSR-Segmente (orange) dargestellt.
- [ ] Bei „Only sprint phases“ werden ausschließlich die Sprint-Segmente (rot) dargestellt.
- [ ] Bei „HSR runs with sprint phases“ werden nur jene HSR-Runs angezeigt, die mindestens eine Sprint-Phase enthalten.
- [ ] GPS-Punkte, die als Sprint klassifiziert sind, werden innerhalb eines HSR-Runs stets rot dargestellt.
- [ ] GPS-Punkte oberhalb der HSR-Schwelle, aber unterhalb der Sprint-Schwelle, werden orange dargestellt.
- [ ] Die bestehende visuelle Farblogik bleibt konsistent.

---

## Story R1.6-17: Erweiterte Run-Visualisierung zur Richtungsdarstellung
**Als** Nutzer  
**möchte ich** dass auf der HSR-Tracking-Map pro High-Intensity-Run oder Sprint mindestens vier aufeinanderfolgende GPS-Punkte dargestellt werden  
**damit** die Bewegungsrichtung und der Laufkontext klar erkennbar sind.

### Acceptance Criteria
- [ ] Für jeden erkannten HSR- oder Sprint-Run werden mindestens vier zeitlich aufeinanderfolgende GPS-Punkte auf der Map visualisiert.
- [ ] Falls ein Run weniger als vier Schwellen-überschreitende Punkte enthält, werden die unmittelbar davor liegenden Punkte ergänzt.
- [ ] Ergänzte Punkte werden visuell eindeutig als unterhalb der Schwelle gekennzeichnet (z. B. andersfarbige Marker).
- [ ] Schwellen-überschreitende Punkte behalten ihre bestehende farbliche Kennzeichnung (HSR = orange, Sprint = rot).
- [ ] Ergänzte Punkte werden nicht in Distanz-, Zeit- oder Statistikberechnungen einbezogen.
- [ ] Die Ergänzung dient ausschließlich der visuellen Richtungsdarstellung.
- [ ] Die Logik funktioniert identisch für HSR- und Sprint-Phasen.
- [ ] Falls nicht genügend vorherige Punkte existieren (z. B. Run zu Beginn der Session), werden so viele Punkte wie verfügbar ergänzt.

## Priorisierung für R1.6

### Must-have
- R1.6-01 Data-Availability Layer
- R1.6-02 HF-only Insight Pack
- R1.6-03 Session-Segmentierung
- R1.6-04 Nachträgliche Segmentierung mit Verlaufshilfe
- R1.6-05 Analyse-Parität Session ↔ Segmente
- R1.6-06 Zeitfenster-/Segment-Intensitätsprofil
- R1.6-14 Sprint- & High-Intensity-Trackpoints mit Richtungsdarstellung auf der Karte
- R1.6-08 Beibehaltung 1/2/5-Minuten-Granularität
- [x] R1.6-13 GPS-Punkte-Heatmap in GPS- und Dual-Mode
- [x] R1.6-15 Robuste Run-Detection mit Consecutive-Sample-Logik

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
