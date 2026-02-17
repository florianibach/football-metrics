# R1-08 QA Check (DoD + AC Traceability)

Story: **R1-08 – Filter-Erklärung und empfohlener Standard in der UI**

## AC Traceability

1. **Kurzbeschreibung je Filter (Zweck, Stärken, Grenzen, Nutzung)**
   - In der Session-Detailansicht ergänzt durch lokalisierte Filter-Hilfetexte für `Raw`, `AdaptiveMedian`, `Savitzky-Golay` und `Butterworth`.
   - Abgedeckt durch Frontend-Test `R1_08_Ac01_Ac02_Ac03_Ac04_shows_filter_explanations_recommendation_and_localized_change_hint`.

2. **Empfohlener Filter klar markiert**
   - `AdaptiveMedian` ist im Dropdown als empfohlen markiert.
   - Ebenfalls durch den oben genannten R1-08-Test abgedeckt.

3. **Hinweis auf Kennzahlenänderung bei Filterwechsel**
   - Die UI zeigt explizit den Hinweis, dass Distanz, Richtungswechsel und abgeleitete Metriken sich je nach Filter ändern können.
   - Ebenfalls durch den R1-08-Test abgedeckt.

4. **Lokalisierung (DE/EN) und gute Erreichbarkeit in den Session-Details**
   - Alle neuen Guidance-Texte sind in den bestehenden Übersetzungen für EN/DE ergänzt.
   - Sichtbar direkt im Filterbereich der Session-Details.
   - Ebenfalls durch den R1-08-Test inkl. Sprachwechsel EN→DE validiert.

## DoD Review (Story-relevant)

- Funktionalität: **erfüllt** (alle ACs umgesetzt).
- Tests: **erfüllt** (AC-bezogener automatisierter Frontend-Test vorhanden).
- Dokumentation: **erfüllt** (`README.md`, Story-Status und QA-Check aktualisiert).

Aus QA-Sicht ist R1-08 im definierten Story-Scope **Done-fähig**.
