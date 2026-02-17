# R1-05 QA Check (DoD + AC Traceability)

Story: **R1-05 – Upload-Pipeline für weitere Dateitypen vorbereiten**

## AC Traceability

1. **Adapter-/Strategie-Schnittstelle je Dateityp**
   - Implementiert über `IUploadFormatAdapter` + `IUploadFormatAdapterResolver`.
   - Abgedeckt durch Tests `R1_05_Ac01_Resolver_ShouldReturnAdapterByExtensionCaseInsensitive`, `R1_05_Ac01_Resolver_ShouldReturnNullForUnsupportedExtension` und `R1_05_Ac01_TcxAdapter_ParseAsync_WhenRootIsInvalid_ShouldReturnFailure`.

2. **TCX bleibt einzig freigeschaltet in der UI**
   - UI akzeptiert weiterhin nur TCX (`Mvp01_Ac02_shows_validation_message_for_non-tcx_files_in_current_language`).
   - Backend-Resolver registriert aktuell nur `TcxUploadFormatAdapter` (`.tcx`), getestet über `R1_05_Ac01_Resolver_ShouldReturnNullForUnsupportedExtension` und `R1_05_Ac01_Ac02_UploadingTcxWithUppercaseExtension_ShouldStillUseTcxAdapter`.

3. **Nicht unterstützte Endungen klar ablehnen, für Zukunft loggbar**
   - Controller lehnt unbekannte Endungen mit klarer Antwort ab und loggt die Endung als potenzielles Zukunftsformat.
   - Abgedeckt durch `R1_05_Ac01_Ac03_UploadingUnsupportedExtension_ShouldReturnClearFutureFormatMessage`.

4. **TCX-Mapping ins kanonische Activity-Modell dokumentiert**
   - Dokumentiert in `analysis/releases/R1-05_TCX_to_Canonical_Activity_Mapping.md`.
   - Zusätzlich automatisiert verifiziert über `R1_05_Ac01_Ac04_TcxAdapter_ParseAsync_ShouldReturnCanonicalActivityMapping`.

## DoD Review (Story-relevant)

- Funktionalität: **erfüllt** (alle ACs umgesetzt).
- Tests: **erfüllt** (automatisierte Tests mit Story-/AC-Bezug vorhanden).
- Dokumentation: **erfüllt** (README + Mapping-Dokument + Story-Status aktualisiert).

Aus QA-Sicht ist R1-05 im definierten Story-Scope **Done-fähig**.
