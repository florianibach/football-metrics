# R1-04 QA Check (DoD + AC Traceability)

Story: **R1-04 – GPS-/Nicht-GPS-Fallbacklogik in Metriken**

## AC-Abdeckung

- **AC1 – Bei fehlendem GPS werden verfügbare Metriken weiterhin berechnet:**
  - Backend-Fallback berechnet HF-basierte Metriken weiterhin bei fehlendem GPS.
  - Testabdeckung: `R1_04_Ac01_Ac02_Ac03_Ac04_Extract_WithoutGpsButWithHeartRate_ShouldProvideFallbackMetricsAndReasons`.

- **AC2 – Nicht berechenbare GPS-Metriken klar als nicht verfügbar markiert:**
  - Per-Metrik-Status (`NotMeasured` / `NotUsable`) vorhanden und in der UI angezeigt.
  - Testabdeckung:
    - Backend: `R1_04_Ac01_Ac02_Ac03_Ac04_Extract_WithoutGpsButWithHeartRate_ShouldProvideFallbackMetricsAndReasons`.
    - Frontend: `R1_04_Ac02_Ac03_marks_unavailable_metrics_as_not_measured_or_unusable`.

- **AC3 – UI unterscheidet „nicht gemessen“ vs. „Messung unbrauchbar“:**
  - Übersetzungen und Anzeige in der Detailansicht umgesetzt.
  - Testabdeckung: `R1_04_Ac02_Ac03_marks_unavailable_metrics_as_not_measured_or_unusable`.

- **AC4 – Keine irreführenden Nullwerte als echte Messwerte:**
  - Nicht verfügbare Metriken bleiben `null` und werden als `Not available` mit Statushinweis gerendert.
  - Testabdeckung: `R1_04_Ac04_does_not_render_fake_zero_values_for_unavailable_metrics`.

## DoD Review (Story-relevant)

- Funktionalität: **erfüllt** (alle ACs im Story-Scope umgesetzt und nachvollziehbar).
- Tests: **erfüllt** (AC-bezogene automatisierte Backend-/Frontend-Tests vorhanden; Regression-Checks grün).
- Dokumentation: **erfüllt** (`README.md`, `R1_user_stories.md`, zusätzlicher QA-Check aktualisiert).
- Transparenz UX: **erfüllt** (klare Kennzeichnung nicht verfügbarer Metriken inkl. Ursache).

## Ergebnis

Aus QA-Sicht ist R1-04 im definierten Story-Scope **Done-fähig**.
