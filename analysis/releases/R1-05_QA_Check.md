# R1-05 QA Check (DoD + AC Traceability)

Story: **R1-05 – Upload-Pipeline für weitere Dateitypen vorbereiten**

## AC Traceability

1. **Adapter-/Strategie-Schnittstelle je Dateityp**
   - Implementiert über `IUploadFormatAdapter` + `IUploadFormatAdapterResolver`.
   - Abgedeckt durch Tests `R1_05_Ac01_Resolver_ShouldReturnAdapterByExtensionCaseInsensitive` und `R1_05_Ac01_Resolver_ShouldReturnNullForUnsupportedExtension`.

2. **TCX bleibt einzig freigeschaltet in der UI**
   - UI akzeptiert weiterhin nur TCX (`invalidExtension`-Flow unverändert).
   - Backend-Resolver registriert aktuell nur `TcxUploadFormatAdapter` (`.tcx`).

3. **Nicht unterstützte Endungen klar ablehnen, für Zukunft loggbar**
   - Controller lehnt unbekannte Endungen mit klarer Antwort ab und loggt die Endung als potenzielles Zukunftsformat.
   - Abgedeckt durch `R1_05_Ac01_Ac03_UploadingUnsupportedExtension_ShouldReturnClearFutureFormatMessage`.

4. **TCX-Mapping ins kanonische Activity-Modell dokumentiert**
   - Dokumentiert in `analysis/releases/R1-05_TCX_to_Canonical_Activity_Mapping.md`.

## DoD Review (Story-relevant)

- Funktionalität: **erfüllt** (alle ACs umgesetzt).
- Tests: **erfüllt** (automatisierte Tests mit Story-/AC-Bezug vorhanden).
- Dokumentation: **erfüllt** (README + Mapping-Dokument + Story-Status aktualisiert).

Aus QA-Sicht ist R1-05 im definierten Story-Scope **Done-fähig**.
