# R1-02 QA Check (DoD + AC Traceability)

Story: **R1-02 – Vergleich „roh vs. geglättet“**

## AC-Abdeckung

- **AC1 – Umschaltbare Darstellung Rohdaten/Geglättet in Session-Details:**
  - Umgesetzt über neuen Darstellungsmodus inkl. Selector in der Detailansicht.
  - Testabdeckung: `R1_02_Ac01_Ac02_switches_between_raw_and_smoothed_and_shows_data_change_metric`.

- **AC2 – Kennzahl zur Datenveränderung vorhanden:**
  - Umgesetzt über Kennzahl mit Anteil korrigierter Punkte und Distanzabweichung.
  - Testabdeckung: `R1_02_Ac01_Ac02_switches_between_raw_and_smoothed_and_shows_data_change_metric`.

- **AC3 – Bei Sessions ohne GPS deaktiviert + Erklärung:**
  - Selector ist deaktiviert, Hinweistext wird eingeblendet.
  - Testabdeckung: `R1_02_Ac03_disables_comparison_for_sessions_without_gps_with_clear_hint`.

- **AC4 – Performance im nutzbaren Bereich:**
  - Umsetzung basiert auf bereits gelieferten Summary-/Smoothing-Werten ohne zusätzliche serverseitige Rechenlast pro Umschaltung.
  - Frontend-Regression abgesichert über Test- und Build-Checks.

## DoD Review (Story-relevant)

- Funktionalität: **erfüllt** (alle ACs umgesetzt).
- Tests: **erfüllt** (AC-bezogene automatisierte Frontend-Tests vorhanden).
- Dokumentation: **erfüllt** (`README.md` + Story-Status aktualisiert).

Aus QA-Sicht ist R1-02 im Story-Scope **Done-fähig**.
