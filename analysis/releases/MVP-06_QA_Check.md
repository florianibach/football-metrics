# MVP-06 QA Check (DoD + AC Traceability)

## Scope
Story: **MVP-06 – Basis-Detailseite je Session**

## Acceptance Criteria Traceability

- **AC1:** Detailseite zeigt Basiskennzahlen (Dauer, Distanz, HF min/avg/max sofern vorhanden, Punkteanzahl).
  - Frontend Test: `Mvp06_Ac01_Ac02_displays_base_metrics_including_gps_availability`.

- **AC2:** Sichtbarer Hinweis, ob GPS-Daten vorhanden sind oder nicht.
  - Frontend Test: `Mvp06_Ac01_Ac02_displays_base_metrics_including_gps_availability`.

- **AC3:** Bei fehlenden Daten werden nachvollziehbare Hinweise anstelle leerer/defekter Diagramme gezeigt.
  - Frontend Test: `Mvp06_Ac03_shows_clear_hints_when_heart_rate_or_gps_data_are_missing`.

- **AC4:** Die Seite ist auf Mobile und Desktop lesbar und bedienbar.
  - Frontend Test: `Mvp06_Ac04_keeps_detail_view_readable_on_mobile_layout`.
  - Ergänzend: Responsive CSS-Anpassungen für Container, Tabellen und Buttons.

## DoD Review (Story-relevant)

- Fachliche Abnahme: **erfüllt** (AC1–AC4 implementiert und getestet).
- UX & Transparenz: **erfüllt** (klare Hinweise bei fehlenden Daten, GPS-Status sichtbar, responsive Lesbarkeit).
- Technische Qualität: **erfüllt** (Frontend-Tests und Build-Checks für geänderten Scope).
- Tests: **erfüllt** für Story-Scope (jedes AC mit automatisierter Testabdeckung inkl. AC-Referenz im Testnamen).
- Dokumentation: **erfüllt** (`README.md` und Story-Dokument aktualisiert).

## Ergebnis
Aus QA-Sicht ist MVP-06 im definierten Story-Scope **Done-fähig**.
