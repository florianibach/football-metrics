# R1.7 – User Stories (Session-Detail UI Rework, Peak-Flow, Vergleichsorientierung)

## Zielbild R1.7
R1.7 fokussiert auf ein **UI-Rework der Session-Detailseite**: bestehende Metriken und bestehende Berechnungslogik werden in eine klarere Analyseführung überführt (Overview, Timeline, Peak Demand, Segments, Heatmap). Neue Berechnungen werden nur dort ergänzt, wo sie für das Zielbild zwingend fehlen.

---

## User Stories in Priorisierungs-Reihenfolge (Must → Should → Could)

## Must-have

## Story R1.7-01: Session-Detail als tab-basierte Analysefläche strukturieren ✅ done
**Als** Nutzer
**möchte ich** die Session-Detailseite in klar getrennten Bereichen nutzen (Overview, Timeline, Peak Demand, Segments, Heatmap)
**damit** ich schnell zwischen Überblick und Tiefenanalyse wechseln kann.

### Acceptance Criteria
- [x] Die Session-Detailseite enthält die Tabs `Overview`, `Timeline`, `Peak Demand`, `Segments`, `Heatmap`.
- [x] Der Header bleibt tab-übergreifend konstant (Datum, Session-Typ, Gegner optional, Kern-KPIs).
- [x] Bereits vorhandene Metriken werden in die neue Struktur überführt (keine fachliche Neuberechnung allein durch das Rework).
- [x] Leere/nicht verfügbare Inhalte pro Tab werden konsistent mit bestehenden Availability-Hinweisen dargestellt.

---

## Story R1.7-02: Overview nach 4 Belastungsdimensionen neu ordnen ✅ done
**Als** Nutzer
**möchte ich** die Übersicht in Volume, Speed, Mechanical und Internal gegliedert sehen
**damit** ich Belastungssignale schneller fachlich einordnen kann.

### Acceptance Criteria
- [x] `Overview` gruppiert KPI-Cards in die vier Dimensionen `Volume`, `Speed`, `Mechanical`, `Internal`.
- [x] Bereits vorhandene Metriken (z. B. Distance, Duration, Max Speed, HR min/avg/max, Direction Changes) werden den passenden Dimensionen zugeordnet.
- [x] Die Dimensionen sind Inhaltsstruktur, aber **kein** eigenes Navigationskonzept.
- [x] Auf Mobile wird die Struktur als Accordion, auf Desktop als Sections dargestellt.

---

## Story R1.7-03: KPI-Card-Design vereinheitlichen (inkl. Vergleichskontext)
**Als** Nutzer
**möchte ich** jede Metrik in einer konsistenten KPI-Card sehen
**damit** ich Werte, Kontext und Aktionen ohne Umlernen erfasse.

### Acceptance Criteria
- [ ] Jede KPI-Card enthält mindestens: Primary Value, Einheit, Label, Info-Icon.
- [ ] Optional verfügbare Vergleichswerte werden einheitlich angezeigt: `Ø letzte Sessions` und `Bestwert Saison`.
- [ ] KPI-Cards bieten kontextsensitive Aktionen (`Zur Timeline`, `Peak Analyse anzeigen`), sofern die Zielansicht verfügbar ist.
- [ ] Bereits vorhandene Erklärtexte/Definitionen werden übernommen und auf das neue Card-Layout gemappt.

---

## Story R1.7-04: Timeline als synchronisierte Mehrspur-Analyse ausbauen
**Als** Nutzer
**möchte ich** alle relevanten Belastungsverläufe auf gemeinsamer Zeitachse sehen
**damit** ich Zusammenhänge zwischen externen und internen Signalen erkenne.

### Acceptance Criteria
- [ ] Timeline-Charts sind zeitlich synchronisiert und teilen sich eine gemeinsame X-Achse.
- [ ] Mindestens folgende Spuren sind darstellbar (datenmodusabhängig): `m/min`, `Speed + HSR Events`, `Accel/Decel Events`, `Heart Rate`.
- [ ] Zwischen `Instant` und `Rolling` kann umgeschaltet werden.
- [ ] Rolling unterstützt 1-, 2- und 5-Minuten-Fenster.

Rolling Window Definition:
Rolling Fenster werden gleitend über die Session-Zeit berechnet (nicht blockbasiert).
Berechnung erfolgt auf Basis der bestehenden Aggregationslogik (Backend).
Zeitauflösung = vorhandene Samplefrequenz.
Siehe hierzu auch r1_7_concept.md für mehr Details.

---

## Story R1.7-05: Peak-Demand-Tab auf bestehender Rolling-Logik aufsetzen
**Als** Nutzer
**möchte ich** Peak-Werte pro Metrik in 1/2/5-Minuten-Fenstern vergleichen
**damit** ich Maximalbelastungen gezielt beurteilen kann.

### Acceptance Criteria
- [ ] `Peak Demand` bietet einen klaren Window-Selector (1/2/5 min), Default = 5 min.
- [ ] Peaks werden nach den vier Belastungsdimensionen tabellarisch dargestellt.
- [ ] Pro Peak-Metrik können (falls vorhanden) `Ø letzte Sessions` und `Best Saison` angezeigt werden.
- [ ] Klick auf einen Peak springt in die Timeline und markiert das zugehörige Zeitfenster.

Peak Definition:
- Distance: Rolling Sum
- HSR Distance: Rolling Sum
- Accels: Rolling Count
- TRIMP/min: Rolling Average über Fenster
- HR: Rolling Average

---

## Story R1.7-06: Segment-Analyse für Halbzeit-/Blockvergleiche schärfen
**Als** Nutzer
**möchte ich** Segmentvergleiche (inkl. Halbzeiten) als Delta-Ansicht nutzen
**damit** ich Leistungsabfall und Phasenunterschiede schneller erkenne.

### Acceptance Criteria
- [ ] Segment-Ansicht unterstützt mindestens `Entire Session` sowie bestehende Segmente (z. B. HZ1/HZ2, manuelle Segmente).
- [ ] Vergleichstabelle zeigt pro Metrik mindestens zwei Segmente plus Delta (`Δ` absolut oder prozentual).
- [ ] Optional verfügbare Ampelfarben markieren Richtung und Stärke von Unterschieden.
- [ ] Segmentmetriken verwenden dieselbe Berechnungslogik wie auf Session-Ebene (keine abweichenden Definitionen durch UI-Rework).

---

## Story R1.7-06a: Segment-Fokus wirkt tab-übergreifend auf alle Session-Detail-Views (Must-have)
**Als** Nutzer
**möchte ich** dass ein aktivierter Segment-Fokus (`Segment-focused analysis is active`) in allen Tabs konsistent gilt
**damit** ich keine Full-Session-Werte mehr sehe, wenn ich explizit auf ein Segment eingegrenzt habe.

### Acceptance Criteria
- [ ] Wenn `Segment-focused analysis is active`, beziehen sich `Overview`, `Timeline`, `Peak Demand` und `Heatmap` ausschließlich auf das gewählte Segment.
- [ ] Tab-Wechsel verändert den aktiven Segment-Fokus nicht; Scope und Segmentauswahl bleiben erhalten, bis ich sie aktiv ändere.
- [ ] Alle Aggregationen/Peaks/Visualisierungen werden segmentbasiert berechnet bzw. gefiltert (kein stilles Zurückfallen auf Entire Session).
- [ ] Der aktive Scope (`Entire Session` vs. konkretes Segment) ist in jedem betroffenen Tab sichtbar gekennzeichnet.
- [ ] Falls ein Tab für das gewählte Segment keine darstellbaren Daten hat, wird ein segmentbezogener Availability-Hinweis gezeigt.

Abgrenzung/Impact auf bestehende Stories:
- Diese Story erweitert R1.7-04 (Timeline), R1.7-05 (Peak Demand) und R1.7-07 (Heatmap) um verpflichtendes Segment-Scoping-Verhalten.
- R1.7-02 (Overview) erhält damit denselben Scope-Mechanismus wie die Detailtabs, ohne die 4-Dimensionen-Struktur zu ändern.

---

## Story R1.7-07: Heatmap-Ansicht um Accel/Decel-Layer erweitern
**Als** Nutzer
**möchte ich** neben Bewegungs- und High-Speed-Heatmaps auch Accel/Decel-Räume sehen
**damit** ich mechanische Belastung räumlich analysieren kann.

### Acceptance Criteria
- [ ] Bestehende Heatmap-Darstellungen bleiben erhalten und werden in das neue Tab-Layout integriert.
- [ ] Zusätzlicher Layer `Accel/Decel` ist auswählbar.
- [ ] Für Darstellbarkeit werden pro Event-Typ mindestens drei Punkte visualisiert (falls Daten vorhanden).
- [ ] Availability-Regeln bleiben konsistent: ohne GPS keine Heatmap, stattdessen klarer Hinweis.
- [ ] Wenn Segment-Fokus aktiv ist, zeigt die Heatmap nur Positions-/Eventdaten aus dem aktiven Segment.

---

## Story R1.7-08: Vergleichslogik in allen relevanten Views konsistent machen
**Als** Nutzer
**möchte ich** Vergleichswerte überall nach denselben Regeln sehen
**damit** ich Aussagen zwischen Overview, Peak und Segmenten belastbar vergleichen kann.

### Acceptance Criteria
- [ ] Vergleichsquellen sind konsistent definiert (`Ø letzte 3–5 Sessions`, `Best Saison`, Segmentvergleich).
- [ ] Die gewählte Vergleichsbasis ist in jeder Ansicht transparent ausgewiesen.
- [ ] Bei unzureichender Datenbasis wird Vergleich transparent als `nicht verfügbar` markiert, nicht als Nullwert.
- [ ] Qualitäts- und Datenmodus-Hinweise werden in Vergleichs-Widgets übernommen.
- [ ] Bei aktivem Segment-Fokus beziehen sich Vergleichswerte auf denselben Segment-Scope (oder sind explizit als nicht verfügbar markiert).

Vergleichsbasis:
- Standard: Ø letzte 5 Sessions gleichen Typs (Spiel/Training)
- Gleiches Datenqualitätsniveau erforderlich
- Kein positionsbasierter Filter in R1.7
- Keine Gewichtung

---

## Story R1.7-09: Informationsarchitektur auf Reuse statt Re-Implementierung absichern
**Als** Product Owner
**möchte ich** dass R1.7 vorhandene Metriken/Berechnungen wiederverwendet
**damit** wir Risiko, Aufwand und Inkonsistenzen minimieren.

### Acceptance Criteria
- [ ] Für jede R1.7-Ansicht ist dokumentiert, welche Metriken aus bestehenden Releases übernommen werden.
- [ ] Neue Backend-Berechnungen werden nur für fachlich fehlende Metriken ergänzt und explizit gekennzeichnet.
- [ ] Bestehende API-Felder werden bevorzugt weiterverwendet; Breaking Changes sind ausgeschlossen oder klar versioniert.
- [ ] QA-Check enthält einen Abschnitt „Rework vs. Neuimplementierung“ mit Abweichungsbegründung.

---

## Should-have

## Story R1.7-10: Default-Verhalten aus Profilpräferenzen in neue Views übernehmen
**Als** Nutzer
**möchte ich** dass meine Profildefaults (z. B. Zeitfenster, Einheiten) in den neuen Tabs weiterhin greifen
**damit** ich trotz UI-Rework konsistente Voreinstellungen behalte.

### Acceptance Criteria
- [ ] Profil-Default für Zeitfenster (1/2/5) wird in Timeline und Peak Demand automatisch angewendet.
- [ ] Profil-Default für Geschwindigkeitseinheit wird in KPI-Cards, Timeline und Peak-Tab konsistent verwendet.
- [ ] Manuelle View-Overrides pro Session bleiben möglich, ohne den Profil-Default still zu überschreiben.
- [ ] Aktive Quelle einer Einstellung (Profildefault vs. manuell) ist transparent erkennbar.

---

## Story R1.7-11: Navigationsfluss zwischen KPI, Peak und Timeline verbessern
**Als** Nutzer
**möchte ich** aus jeder Kennzahl direkt in den passenden Analysekontext springen
**damit** ich schneller von Auffälligkeit zu Ursache komme.

### Acceptance Criteria
- [ ] KPI-Card-Aktionen führen kontextgenau zur richtigen Timeline-Spur oder Peak-Darstellung.
- [ ] Rücksprungmechanismen (z. B. „zurück zur KPI“) erhalten den Scroll-/Tab-Kontext.
- [ ] Markierungen (Peak-Fenster, selektiertes Segment) sind nach Navigation klar sichtbar.
- [ ] Interaktionsverhalten ist auf Desktop und Mobile konsistent.

---

## Could-have

## Story R1.7-12: Dimension-Score als vorbereiteter Next-Step integrieren
**Als** Nutzer
**möchte ich** perspektivisch pro Belastungsdimension einen relativen Score sehen
**damit** ich Session-Belastung schneller normiert einordnen kann.

### Acceptance Criteria
- [ ] Die UI-Struktur enthält reservierte Plätze/Badges für `Volume`, `Speed`, `Mechanical`, `Internal` Score.
- [ ] Score-Berechnung kann zunächst feature-flagged oder read-only vorbereitet werden.
- [ ] Interpretationslogik (<90%, 90–105%, >105%) ist fachlich dokumentiert, auch wenn noch nicht produktiv aktiviert.
- [ ] Aktivierung des Scores ist ohne erneutes Layout-Rework möglich.

Dimension Score basiert auf 5-min Peak im Vergleich zu Ø letzte 5 Sessions.

---

## Story R1.7-13: Gegnervalidierung und Kontextvergleich vorbereiten (Future-ready)
**Als** Nutzer
**möchte ich** Session-Kontextdaten (z. B. Gegner) sauber für spätere Vergleiche nutzen können
**damit** zukünftige opponent-bezogene Analysen belastbar möglich sind.

### Acceptance Criteria
- [ ] Vorhandene Kontextfelder (Gegner, Wettbewerb, Ergebnis) bleiben im Header und in Vergleichsansichten konsistent nutzbar.
- [ ] Kontextdaten werden in Vergleichsmodulen als Filterkriterium technisch vorbereitbar gemacht (ohne Pflicht-UI im MVP).
- [ ] Fehlende Kontextdaten verschlechtern nicht die Kernanalyse und werden neutral behandelt.
- [ ] Fachliche Abgrenzung „R1.7 vorbereitet / R2 produktiv“ ist dokumentiert.
