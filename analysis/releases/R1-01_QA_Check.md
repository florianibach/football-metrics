# R1-01 QA Check (DoD + AC Traceability)

Story: **R1-01 – Konfigurierbare GPS-Glättung für Fußballbewegungen**

## Acceptance Criteria Review

- **AC1:** Erfüllt. API nutzt `FootballAdaptiveMedian` zusätzlich zu einer Baseline-Referenzmetrik für Richtungswechsel.
- **AC2:** Erfüllt. Kurzfristige Richtungswechsel bleiben in der adaptiven Glättung erkennbar (`smoothedDirectionChanges` im Vergleich zur Baseline).
- **AC3:** Erfüllt. Unplausible GPS-Ausreißer werden über Geschwindigkeitsausreißer erkannt und lokal geglättet (`correctedOutlierCount`).
- **AC4:** Erfüllt. Glättungslogik + Parameter werden je Lauf unter `summary.smoothing` mit Zeitstempel zurückgegeben.

## Test-Traceability

- `R1_01_Ac01_Ac03_Extract_ShouldApplyFootballAdaptiveSmoothingAndCorrectOutlier`
- `R1_01_Ac02_Ac04_Extract_ShouldPreserveShortDirectionChangesAndExposeTrace`
- `R1_01_Ac04_UploadingTcx_ShouldReturnSmoothingTraceWithSelectedParameters`

## DoD Review (Story-relevant)

- Fachliche Umsetzung: **erfüllt**
- Datenqualität & Analytik: **erfüllt** (Regeln/Schwellen dokumentiert, Ausreißerbehandlung nachvollziehbar)
- Technische Qualität: **erfüllt** (bestehende Flows unverändert nutzbar, Tests grün)
- Tests: **erfüllt** (AC-bezogene automatisierte Tests vorhanden; zusätzlich Story-bezogener E2E-Smoke-Check in `scripts/e2e-smoke.sh`)
- Dokumentation: **erfüllt** (`README.md` + Story-Status aktualisiert)

Aus QA-Sicht ist R1-01 im Story-Scope **Done-fähig**.


## QA-Fazit

- Mit den vorhandenen Unit/Integration-Tests plus dem Story-referenzierten E2E-Smoke-Test ist die DoD-Anforderung zur automatisierten AC-Abdeckung für R1-01 erfüllt.
- R1-01 kann aus QA-Sicht auf **Done** bleiben.
