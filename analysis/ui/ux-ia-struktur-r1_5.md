# UX-/IA-Strukturvorschlag für Football Metrics (R1.5 → R1.6)

## Rahmen
- Zielgruppe: ausschließlich Amateurfußballer (Selbstanalyse).
- Primärer Zweck: individuelle Analyse/Fortschritt.
- Primäres Gerät: Mobile (Desktop/Tablet sekundär).
- Primärer Zeitpunkt: Nachbereitung jeder Einheit (Spiel + Training).
- Primärer Einstieg: Session-Liste.

## Leitprinzipien der Informationsarchitektur
- Session-zentriert statt funktionszentriert.
- Gleiche Analysegrammatik für Session und Segment.
- Progressive Vertiefung: Orientierung → Drill-down → Vergleich.
- Datenqualität als Vertrauens-Layer (sichtbar, aber nicht dominant).
- Vergleich nur in sinnvoll vergleichbaren Kontexten (Sessiontyp + Segmenttyp).

## Seitenstruktur (IA)
1. **Session-Liste (Startseite)**
   - Neueste zuerst.
   - Filter: Sessiontyp, Datum, Qualitätsstatus.
   - Aktionen: Session öffnen, Upload starten.

2. **Upload-Flow**
   - Schritt 1: Datei hochladen.
   - Schritt 2: Qualitätsübersicht (high/medium/low, kurzer Impact-Hinweis).
   - Schritt 3: Direkter Übergang in Session-Analyse.

3. **Session-Analyse (Gesamtsession)**
   - Aggregierte Kernaussage zuerst.
   - Danach interne/externe Metriken (Ursachenebene).
   - Heatmap als gleichwertige Analyseperspektive.
   - Optionaler Deep-Dive: 1/2/5-Minuten-Zeitfenster.

4. **Segment-Analyse**
   - Gleicher Aufbau wie Session-Analyse.
   - Segmente: feste Kategorien + individuelle Benennung.
   - Mehrfach vorkommende Segmentkategorien sind erlaubt.

5. **Vergleich (sekundärer, naher Pfad)**
   - Session vs. Session.
   - Segment vs. Segment (innerhalb und über Sessions).
   - Segment/Halbzeit A vs. B.
   - Gegen automatische Baseline.

6. **Profil/Einstellungen (sekundär)**
   - Thresholds (selten benötigt).
   - Später: Baseline-Konfiguration pro Nutzer.

## Navigationsarchitektur
- Primärer Pfad: `Session-Liste → Session-Analyse → Segment/Vergleich`.
- Upload-Pfad: `Session-Liste → Upload → Qualitätsübersicht → Session-Analyse`.
- Qualitätsdetails bleiben aus der Session heraus jederzeit erreichbar.
- Vergleich bleibt 1 Schritt entfernt, aber nicht als Pflicht im Hauptflow.

## Empfohlene Funktionsgruppierung
- **Finden & Starten:** Session-Liste, Filter, Upload.
- **Analysieren:** Session- und Segmentanalyse (gleiches Analysemodell).
- **Einordnen:** Vergleich + Baseline + 1/2/5-Minuten-Modus.
- **Datenvertrauen:** Qualitätsübersicht + Detailansicht.
- **Konfiguration:** Thresholds, spätere Baseline-Einstellungen.

## User-Flows (priorisiert)
1. **Hauptflow (häufig):** Session wählen → analysieren → optional Segment öffnen → optional Vergleich.
2. **Upload-Flow (zweithäufig):** Upload → Qualitätsübersicht → direkte Analyse.
3. **Deep-Dive (seltener):** Vergleich + Zeitfenster + Baseline-Kontext.

## Metrik-Priorisierung im Analyseaufbau
- Standard-Reihenfolge:
  1) Aggregierte Kernaussage,
  2) intern/externer Drill-down,
  3) Heatmap,
  4) Zeitfenster-Vertiefung.
- Begründung: schnelle Orientierung auf Mobile, dann Erklärung auf Ursachenebene.

## Baseline-Logik (Default)
- Automatisch: letzte **8** vergleichbare Einheiten.
- Vergleichbarkeit bei Segmenten: **Sessiontyp + Segmenttyp**.
- Fallback:
  - bei 3–7 Einheiten: verwende verfügbare Historie,
  - unter 3: Hinweis „nicht genug Historie für stabile Baseline“.
- Später im Profil konfigurierbar.

## Segment-Taxonomie (Startvorschlag)
- Warm-up
- Spielform
- Technik
- Torschuss
- Athletik
- Cool-down
- + individuelle Benennung pro Segment

## Offene fachliche Entscheidungen (vor Umsetzung finalisieren)
1. Vergleichsregel für Spielformen mit unterschiedlichem Format (z. B. 5v5 vs. 7v7): gleich/ungleich?
2. Verhalten bei niedriger Datenqualität: nur Hinweis oder Teilmetriken einschränken?
3. Versionierung bei nachträglicher Segmentbearbeitung (Vergleichskonsistenz).
4. Konkrete Definition „aggregierte Kernaussage“ (welche aggregierten Kennzahlen zuerst).

## Priorisierung (Must / Should / Later)
### Must
- Session-Liste als Startseite.
- Upload → Qualitätsübersicht → direkte Analyse.
- Session-/Segmentanalyse mit identischer Struktur.
- Vergleich als sekundärer, direkt erreichbarer Pfad.
- Baseline-Default (8, mit Fallback).

### Should
- Feste Segmentkategorien + freie Benennung.
- Zeitfenstermodus 1/2/5 Minuten als Deep-Dive.
- Qualitätsdetails dauerhaft aus Session erreichbar.

### Later
- Konfigurierbare Baseline im Profil.
- Erweiterte Vergleichsregeln für spezielle Spielform-Kontexte.
- Zusammenfassender Report/Score.
