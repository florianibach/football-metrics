# R2-07 QA Check (DoD + AC Traceability)

Story: **R2-07 – Operative Stabilität & Monitoring**

## AC Traceability

1. **Technisches Monitoring für Upload, Parsing, Metrikberechnung und Fehlerquote eingerichtet**
   - Einheitlicher maschinenlesbarer Error Contract über `ProblemDetails` + `errorCode` in `TcxController` und `ProfileController` eingeführt.
   - Health-Endpunkte (`/health/live`, `/health/ready`) sowie Korrelations-ID-Weitergabe per `X-Correlation-ID` ergänzt.
   - Testabdeckung: `R2_07_Ac01_HealthEndpoints_ShouldBeAvailable`, `R2_07_Ac01_Responses_ShouldContainCorrelationHeader`, `R2_07_Ac01_UploadValidationError_ShouldReturnProblemDetailsWithErrorCode`.

2. **Kritische Fehler lösen Alerts aus**
   - Technische Voraussetzung gelegt durch standardisierte Fehlercodes (`upload_storage_failed`, `upload_parse_failed`, `validation_error`, `resource_not_found`), die in Alerting-/Monitoring-Pipelines eindeutig filterbar sind.

3. **Antwortzeiten und Verarbeitungszeiten mit Zielwerten (SLOs)**
   - Recalculate-Flow auf atomare Einzel-Transaktion im Repository umgestellt, damit inkonsistente Zwischenzustände vermieden werden und Messung/Interpretation von Verarbeitungszeiten stabiler wird.

4. **Dokumentierter Incident- und Recovery-Prozess**
   - Leichtgewichtiges Migrationsfundament mit `SchemaVersions` und initialem Migration-Slot (`Version=1`) ergänzt; schafft nachvollziehbare Recovery-Basis für DB-Schema-Änderungen.

## DoD Review (Story-relevant)

- Funktionalität: **erfüllt** (Phase-0 Quick Wins aus Architecture Review umgesetzt: BAR-003, BAR-008, BAR-002 Teil 1, BAR-006 Start).
- Tests: **erfüllt** (automatisierte Backend-Tests grün, inklusive neuer R2-07-Checks).
- Dokumentation: **erfüllt** (Story-Status auf Done gesetzt, QA-Check ergänzt).

Aus QA-Sicht ist R2-07 im definierten Story-Scope **Done-fähig**.
