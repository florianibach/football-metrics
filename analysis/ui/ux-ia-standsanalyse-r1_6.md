# UX/UI/IA-Standanalyse (Ist) vs. Strukturvorschlag `ux-ia-struktur-r1_5.md`

## Ziel dieser Analyse
Diese Analyse bewertet den aktuellen App-Stand aus UX/UI/IA-Sicht und gleicht ihn mit dem Strukturvorschlag R1.5→R1.6 ab. Zusätzlich enthält sie umsetzbare Inkremente im User-Story-Format, damit ein Entwicklerteam schrittweise umbauen kann.

---

## 1) Executive Summary

**Kurzfazit:**
- Das **Grundgerüst** des Vorschlags ist sichtbar umgesetzt (session-zentrierter Einstieg, Session-Analyse, Vergleichspfad, Profil, Light/Dark-Theme).
- Der **inhaltliche Reifegrad** ist aber noch uneinheitlich: einige Kernpunkte sind nur teilweise erfüllt (vor allem Upload-Qualitätsstufe, Segment-Analysegrammatik, Baseline-Logik, Listen-Filter).
- Insgesamt liegt der Erfüllungsgrad des Strukturvorschlags grob bei **ca. 60–70 %**.

**Größte Lücken mit UX-Wirkung:**
1. Keine klare, explizite **Qualitätsübersicht als eigener Schritt** im Upload-Flow.
2. Segment-UX ist noch nicht in **Analysieren** vs. **Bearbeiten** getrennt.
3. Vergleich/Baseline noch nicht kontextsensitiv gemäß Vorschlag (Auto-Baseline + Kompatibilitätsregeln fehlen).
4. Session-Liste ohne die vorgeschlagenen Filter (Sessiontyp, Datum, Qualitätsstatus).

---

## 2) Ist-Bild der IA (heute)

### Primärseiten
1. **Sessions (Startseite)**
   - Session-Historie als tabellarische Liste.
   - Sortierung (neu/alt) vorhanden.
   - Direkter Sprung in Session-Details vorhanden.
   - Vergleich ist heute sichtbar aus der Liste möglich, sollte perspektivisch aber aus der Session gestartet werden.

2. **Upload**
   - Datei-Upload per Dropzone/Form.
   - Nach erfolgreichem Upload direkter Sprung in Session-Ansicht.

3. **Session**
   - Subnavigation: Analyse / Segmente / Vergleich.
   - Analyse enthält umfangreiche Metriken, Qualitätsinformationen, Heatmap, Intervallfenster (1/2/5).
   - Segmente enthalten aktuell vor allem CRUD-/Merge-Funktionen.
   - Vergleich mit Baseline-Selektor vorhanden.

4. **Profil**
   - Schwellenwerte, Präferenzen (u. a. Theme, Speed Unit, Aggregationsfenster, Filter-Defaults), Recalculation.

### IA-Stärke
- Der Produktkern ist klar **session-zentriert** und kein reines Feature-Silo.
- Hauptnavigation ist grundsätzlich nachvollziehbar (Sessions/Upload/Profile + Session-Subpages).

### IA-Schwäche
- Für neue Nutzer ist der Leitfaden „Orientierung → Drill-down → Vergleich“ noch nicht konsequent geführt.

---

## 3) Soll-Ist-Abgleich zum Strukturvorschlag

## 3.1 Leitprinzipien

| Leitprinzip | Status | Bewertung |
|---|---|---|
| Session-zentriert statt funktionszentriert | ✅ weitgehend erfüllt | Start auf Sessions + Session als zentrale Arbeitseinheit passt. |
| Gleiche Analysegrammatik für Session & Segment | ⚠️ teilweise | Session stark ausgebaut, Segment aktuell primär Verwaltungsobjekt. |
| Progressive Vertiefung | ⚠️ teilweise | Bausteine da, aber noch nicht als klarer geführter Analysepfad orchestriert. |
| Datenqualität als Vertrauens-Layer | ✅ gut erfüllt | Qualität sichtbar; Warnhinweise und Datenmodi vorhanden. |
| Vergleich nur in vergleichbaren Kontexten | ⚠️ teilweise | Vergleich vorhanden, aber Kontextregeln/Baseline-Heuristik fehlen. |

## 3.2 Seitenstruktur / IA-Ziele

| Vorschlag | Status | Bewertung |
|---|---|---|
| Session-Liste als Startseite | ✅ erfüllt | Vorhanden. |
| Session-Liste mit Filtern (Typ/Datum/Qualität) | ❌ offen | Aktuell Sortierung, aber keine inhaltlichen Filter. |
| Upload Schritt 1→2→3 (inkl. Qualitätsübersicht) | ⚠️ teilweise | Upload + direkter Übergang existiert; eigener Qualitäts-Step fehlt. |
| Session-Analyse inkl. Heatmap + Deep-Dive | ✅ weitgehend erfüllt | Umfangreiche Analytik inkl. Heatmap und 1/2/5-Fenster. |
| Segment-Analyse gleiches Modell wie Session | ❌ offen | Segmentpflege vorhanden, aber keine vollständige Segment-Analyseansicht. |
| Vergleich als naher sekundärer Pfad | ✅ teilweise | Pfad ist nah, aber Startpunkt sollte von Session (nicht Liste) aus geführt werden. |
| Profil/Einstellungen sekundär | ✅ erfüllt | Profil separiert und nicht im Hauptflow erzwungen. |

## 3.3 Priorisierung (Must/Should/Later) aus Vorschlag

### Must
- Session-Liste als Startseite: **erfüllt**.
- Upload → Qualitätsübersicht → Analyse: **teilweise** (Qualitätsübersicht als eigener Schritt fehlt).
- Session-/Segmentanalyse identische Struktur: **offen**.
- Vergleich sekundär direkt erreichbar: **teilweise** (Erreichbarkeit ja, Startlogik noch nachschärfen).
- Baseline-Default (8 + Fallback): **offen**.

### Should
- Feste Segmentkategorien + freie Benennung: **offen** (freie Labels ja, Taxonomie nein).
- Zeitfenster 1/2/5 Minuten: **erfüllt**.
- Qualitätsdetails dauerhaft aus Session erreichbar: **erfüllt**.

### Later
- Konfigurierbare Baseline im Profil: **offen**.
- Erweiterte Vergleichsregeln (z. B. Spielformen): **offen**.
- Zusammenfassender Report/Score: **offen**.

---

## 4) Priorisierte Inkremente (umsetzbar in kleinen Schritten)

## Increment 1 — Session-Liste als echte Arbeitszentrale

**Ziel:** Finden & Starten beschleunigen, IA-Vorschlag sauber erfüllen.

### User Story 1.1
**Status: ✅ Done**

Als Spieler möchte ich Sessions nach **Typ**, **Datum** und **Qualitätsstatus** filtern, damit ich schnell die relevanten Einheiten finde.

**Acceptance Criteria**
- Filterleiste oberhalb der Tabelle mit:
  - Sessiontyp (Multi-Select)
  - Qualitätsstatus (High/Medium/Low)
  - Datumsbereich (von/bis)
- Filter wirken kombiniert und sind URL-/State-persistiert (mindestens im Client-State beim Navigieren).
- „Filter zurücksetzen“-Aktion vorhanden.

### User Story 1.2
**Status: ✅ Done**

Als Spieler möchte ich die Session-Liste rein zum **Finden/Öffnen** nutzen und den Vergleich erst aus einer geöffneten Session starten, damit der Hauptflow klar bleibt.

**Acceptance Criteria**
- In der Session-Liste gibt es keine Vergleichs-Checkboxen/-Badges.
- Beim Öffnen einer Session und Wechsel auf „Vergleich“ ist die geöffnete Session automatisch als Baseline gesetzt und als „aktive Session“ markiert.
- In der Vergleichsansicht sind weitere Sessions **nur gleichen Sessiontyps** auswählbar.
- Die aktive Session bleibt in der Auswahlliste sichtbar/markiert (wichtig für späteren Segmentvergleich).

---

## Increment 2 — Upload-Flow mit explizitem Qualitäts-Schritt

**Ziel:** Vertrauen stärken und den vorgeschlagenen 3-Schritt-Flow herstellen.

### User Story 2.1
**Status: ✅ Done**

Als Spieler möchte ich nach Upload zuerst eine **kompakte Qualitätsübersicht** sehen, damit ich die Belastbarkeit der Kennzahlen sofort verstehe.

**Acceptance Criteria**
- Neuer Upload-Step „Qualitätscheck“ zwischen Upload und Analyse.
- Anzeige: Gesamtqualität (High/Medium/Low), Kanalqualität (GPS/HR), 2–4 Kernauswirkungen auf Interpretation.
- Primärer CTA: „Zur Session-Analyse“.

### User Story 2.2
**Status: ✅ Done**

Als Spieler möchte ich Qualitätsdetails später jederzeit wieder öffnen können, damit ich bei Unsicherheit nachprüfen kann.

**Acceptance Criteria**
- In Session-Analyse persistenter Link/Button „Qualitätsdetails“.
- Öffnet denselben Inhaltsbaustein wie im Upload-Schritt (kein separater Textstand).

---

## Increment 3 — Analysefluss schärfen (Orientierung → Drill-down → Vergleich)

**Ziel:** Kognitive Last reduzieren, Mobile-Flow verbessern.

### User Story 3.1
Als Spieler möchte ich zuerst eine **Kernaussage-Karte** sehen, damit ich in <10 Sekunden die Session einordnen kann.

**Acceptance Criteria**
- Top-Block in Session-Analyse mit 3–5 wichtigsten Aussagen (z. B. externe Last, interne Last, Qualitätsvertrauen, Trend vs. Baseline).
- Darunter erst detaillierte Metrikblöcke.

### User Story 3.2
Als Spieler möchte ich Analyseblöcke standardmäßig eingeklappt sehen, damit die Ansicht auf Mobile übersichtlich bleibt.

**Acceptance Criteria**
- Accordion/Disclosure für Deep-Dive-Bereiche.
- Zustand pro Bereich lokal gemerkt (während der Session).

---

## Increment 4 — Segmentfluss: Auswählen, Analysieren, getrennt Bearbeiten

**Ziel:** Segmentanalyse nutzbar machen und Segmentpflege aus dem Analyseflow auslagern.

### User Story 4.1
Als Spieler möchte ich eine Segmentliste sehen und ein Segment auswählen können, damit ich direkt in die Analyse dieses Segments springen kann.

**Acceptance Criteria**
- Eigene Unterseite „Segmente“ als Liste.
- Tap/Click auf Segment öffnet Segment-Analyse.
- Segment-Analyse nutzt dieselbe Analysegrammatik wie Session-Analyse (Kernaussage → Drill-down → Heatmap/Deep-Dive, soweit datenabhängig möglich).

### User Story 4.2
Als Spieler möchte ich, dass bei Sessions ohne manuelle Segmentierung automatisch ein Default-Segment „gesamte Session“ existiert, damit ich sofort segmentbasiert analysieren kann.

**Acceptance Criteria**
- Wenn keine Segmente vorhanden sind, wird genau ein Segment über die gesamte Sessiondauer bereitgestellt.
- Dieses Default-Segment ist in Analyse- und Vergleichslogik wie ein normales Segment nutzbar.
- Umsetzung kann Frontend- oder Backend-seitig erfolgen, sollte aber API-seitig eindeutig und konsistent sein.

### User Story 4.3
Als Spieler möchte ich Segmente in Kategorien einordnen (z. B. Warm-up, Spielform), damit segmentübergreifende Vergleiche sinnvoll sind.

**Acceptance Criteria**
- Segmentformular: Kategorie (Taxonomie) + freies Label.
- Mehrfach vorkommende Kategorien erlaubt.

### User Story 4.4
Als Spieler möchte ich Segment-Bearbeitung (teilen/mergen/Metadaten) auf einer separaten Unterseite durchführen, damit Analyse und einmalige Strukturpflege klar getrennt sind.

**Acceptance Criteria**
- Neue Unterseite „Segmente bearbeiten“ mit Funktionen: neu teilen, mergen, Label/Kategorie ändern.
- Segmentliste für Analyse bleibt davon getrennt und fokussiert auf Auswahl + Analyse.
- Optionaler Einstieg direkt nach Upload möglich („Segmente jetzt bearbeiten“), ohne Pflichtschritt.

---

## Increment 5 — Vergleichslogik mit Baseline-Default

**Ziel:** Vergleiche valider und weniger manuell machen.

### User Story 5.1
Als Spieler möchte ich automatisch eine Baseline aus den letzten 8 vergleichbaren Einheiten erhalten, damit ich ohne Setup einen sinnvollen Referenzwert habe.

**Acceptance Criteria**
- Auto-Baseline-Regel: letzte 8 Einheiten gleicher Vergleichsklasse.
- Fallback: 3–7 = nutzen, <3 = **Baseline-Vergleich ausblenden**.
- Wenn Baseline ausgeblendet ist, klarer Hinweistext: „Zu wenig vergleichbare Historie für Baseline-Vergleich“.
- Baseline-Quelle transparent angezeigt.

### User Story 5.2
Als Spieler möchte ich Session-vs-Session und Segment-vs-Segment klar getrennt vergleichen, damit ich nicht Äpfel mit Birnen vergleiche.

**Acceptance Criteria**
- Vergleichsmodus-Switch „Session / Segment“.
- Segmentvergleich nur bei kompatibler Kombination (Sessiontyp + Segmenttyp).

---

## Increment 6 — Profil um Baseline-/Vergleichs-Settings ergänzen

**Ziel:** Later-Themen vorbereiten, ohne Hauptflow zu überladen.

### User Story 6.1
Als Spieler möchte ich im Profil die Baseline-Fenstergröße konfigurieren können, damit der Vergleich zu meinem Trainingsrhythmus passt.

**Acceptance Criteria**
- Profilfeld „Baseline-Fenster“ (Default 8).
- Wirkt auf Auto-Baseline in Vergleichsansichten.

### User Story 6.2
Als Spieler möchte ich Vergleichsregeln für spezielle Spielformen steuern können, damit Kontextunterschiede sauber behandelt werden.

**Acceptance Criteria**
- Konfigurierbare Regel für Spielform-Kompatibilität (z. B. strikt / locker).
- Deutlicher Hinweis, wenn Regeln Vergleiche ausschließen.

---

## 5) Empfohlene Umsetzungsreihenfolge (Roadmap)

1. **Increment 1** (Session-Liste-Filter + Vergleich aus Session starten)
2. **Increment 2** (Upload-Qualitätsstep)
3. **Increment 3** (Analyseführung/Kernaussage)
4. **Increment 4** (Segmentfluss trennen: Liste/Analyse vs. Bearbeiten)
5. **Increment 5** (Auto-Baseline + Vergleichsregeln)
6. **Increment 6** (Profil-Konfiguration für Baseline/Regeln)

So entsteht zuerst ein spürbarer UX-Gewinn im Hauptflow (finden/uploaden/verstehen), bevor komplexere Vergleichslogik folgt.

---

## 6) Definition of Done je Increment (kurz)

- UX-DoD:
  - Mobile-first überprüft (mind. 360px Breite).
  - Tastaturbedienbarkeit + verständliche Labels.
  - Keine Regression der bestehenden Analysefunktionen.
- Fach-DoD:
  - Vergleichs-/Baseline-Regeln transparent in UI erklärt.
  - Qualitätsaussagen konsistent zwischen Upload und Session.
  - Segment-Default und Segmenttypen konsistent zwischen API und UI.
- Technik-DoD:
  - Unit-/Integration-Tests für neue Entscheidungslogik (Filter, Baseline, Kompatibilität, Segment-Default).
  - E2E-Smoke für Hauptflow: Session-Liste → Upload → Qualitätsstep → Session → Segmentauswahl → Vergleich.


## Increment 7 — Metrik-Infos als Sidebar statt Tooltip

**Ziel:** Erklärungen zu Metriken auf Mobile und Desktop besser lesbar machen.

### User Story 7.1
Als Spieler möchte ich beim Klick auf das Info-Icon einer Metrik eine Sidebar mit der vollständigen Erklärung öffnen, damit ich längere Hinweise besser lesen kann als in einem Tooltip.

**Acceptance Criteria**
- Klick auf das Info-Icon öffnet rechts eine Sidebar mit Titel der Metrik und vollständigem Erklärungstext.
- Die Sidebar hat einen klaren Schließen-Button und lässt sich auch über Overlay-Klick schließen.
- Tooltip-basierte Erklärung am Info-Icon entfällt für diese Metriken.
- Verhalten funktioniert auf Desktop und Mobile konsistent.
