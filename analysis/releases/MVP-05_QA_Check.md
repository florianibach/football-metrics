# MVP-05 QA Check (DoD + AC Traceability)

## Scope
Story: **MVP-05 – Session-Liste mit Upload-Historie**

## Acceptance Criteria Traceability

- **AC1:** Es gibt eine tabellarische oder kartenbasierte Übersicht aller hochgeladenen Sessions.
  - Frontend Test: `Mvp05_Ac01_Ac02_renders_session_history_with_required_columns`.
- **AC2:** Pro Eintrag werden mindestens angezeigt: Dateiname, Upload-Zeit, Aktivitätszeitpunkt, Qualitätsstatus.
  - Frontend Test: `Mvp05_Ac01_Ac02_renders_session_history_with_required_columns`.
  - Backend Test: `Mvp05_Ac01_Ac02_GetUploads_ShouldIncludeSummaryFieldsForEachSession`.
- **AC3:** Die Liste ist nach Upload-Zeit sortierbar (neueste zuerst als Default).
  - Frontend Test: `Mvp05_Ac03_sorts_history_by_upload_time_with_newest_first_as_default`.
- **AC4:** Ein Klick auf einen Eintrag öffnet die Detailansicht der Session.
  - Frontend Test: `Mvp05_Ac04_clicking_history_entry_opens_the_session_detail_view`.
  - Backend Test: `Mvp05_Ac04_GetUploadById_ShouldReturnSpecificSessionDetail`.

## DoD Review (Story-relevant)

- Fachliche Abnahme: **erfüllt** (AC1–AC4 implementiert und getestet).
- UX & Transparenz: **erfüllt** für MVP-05 Scope (lokalisierte UI, verständliche Statusinfos, Session-Detail via UI).
- Technische Qualität: **erfüllt** (Backend/Frontend Tests grün, Build grün).
- Tests: **erfüllt** für Story-Scope (jedes AC hat automatisierte Testabdeckung mit AC-Referenz im Testnamen).
- Dokumentation: **erfüllt** (`README.md` und Story-Dokument aktualisiert).

## Ergebnis
Aus QA-Sicht ist MVP-05 im definierten Story-Scope **Done-fähig**.
