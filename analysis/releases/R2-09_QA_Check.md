# R2-09 QA Check (Backend Architecture Measures – Snapshot + Atomic Upload)

Story-Kontext: Umsetzung zentraler Maßnahmen aus `docs/backend-architecture-review-v2.md` mit Fokus auf Backend-Stabilität, Read-Path-Entlastung und robustere Persistenz.

## 1) QA Delta-Befund (kurz)

**Positiv verifiziert**
- Summary-Snapshot wird serverseitig persistiert und bei API-Responses bevorzugt genutzt.
- Upload + AdaptiveStats werden in einem gemeinsamen DB-Transaction-Flow geschrieben.
- Controller ist klarer auf Use-Case delegiert (keine manuelle Use-Case-Instanziierung mehr).
- Parse-Fehler und Storage-Fehler sind semantisch getrennt (`upload_parse_failed` vs. `upload_storage_failed`).

**Offene QA-Punkte / Restrisiken**
- Upload-Idempotenz ist weiterhin **nicht** technisch abgesichert (kein dedizierter Idempotency-Key-/Dublettenschutz-Flow auf API-/Repository-Ebene).
- Snapshot-Aktualisierung erfolgt für Upload/Recalculate/Smoothing-Override, aber (aktuell erwartbar) nicht für reine Session-Context-Änderung.

## 2) AC-/Änderungs-Traceability

1. **Read-Path entlasten (Snapshot-first statt Parse-on-read)**
   - Feld `SessionSummarySnapshotJson` im Modell vorhanden.
   - Snapshot wird bei Upload gesetzt.
   - API-Response nutzt `ResolveSummary(upload)`; dort Snapshot-first mit Fallback-Recompute.

2. **Atomare Persistenz Upload + AdaptiveStats**
   - Neues Repository-Contract `AddWithAdaptiveStatsAsync(...)` vorhanden.
   - Implementierung nutzt DB-Transaktion für `TcxUploads` + `TcxAdaptiveStats`.

3. **Boundary-Härtung Controller ↔ UseCase**
   - `TcxController` verwendet ausschließlich DI über `ITcxSessionUseCase`.
   - Parsevalidierung liegt im UseCase (`InvalidDataException` auf Parse-Fail), Controller mappt Fehler auf API-Contract.

4. **Fehlersemantik**
   - Parsefehler liefern `upload_parse_failed`.
   - Persistenzfehler liefern `upload_storage_failed`.

## 3) DoD-Check (story-relevant, Backend)

Referenz: `analysis/releases/Definition_of_Done.md`.

### 3.1 Fachliche Abnahme
- **Erfüllt (im Scope):** Kernziel der Story (Backend-Architekturmaßnahme) umgesetzt und testbar.

### 3.2 Datenqualität & Analytik
- **Teilweise erfüllt:**
  - Validierung unterstützter Formate vorhanden und getestet.
  - Rohdatei wird weiterhin gespeichert.
  - **Offen:** explizite technische Idempotenzabsicherung/Dublettenschutz bleibt ausstehend.

### 3.3 Technische Qualität
- **Erfüllt:**
  - Strukturverbesserung (Controller/UseCase-Grenze), atomare Persistenz für kritischen Flow, konsistente Fehlercodes.

### 3.4 Tests
- **Erfüllt:**
  - Backend-Tests grün.
  - Zusätzlich komplette lokale Kette (`check-local`) inkl. Frontend + E2E Smoke grün.

### 3.5 Dokumentation
- **Erfüllt (minimal):**
  - Architekturmaßnahmen in Review v2 dokumentiert.
  - Dieser QA-Check ergänzt DoD-Transparenz.

## 4) Testprotokoll

- `bash scripts/test-backend.sh` ✅
- `bash scripts/check-local.sh` ✅ (Backend + Frontend + E2E Smoke)

## 5) QA-Urteil

**Status: „Done mit Restpunkt“**

Die umgesetzten Änderungen sind aus QA-Sicht für den aktuellen Scope stabil und regressionsarm. Die Story ist **releasefähig im aktuellen Umfang**, mit einem klaren, dokumentierten Restpunkt: **Idempotenz/Dublettenschutz für Upload** sollte als nächster harter Architektur-Guardrail umgesetzt werden.
