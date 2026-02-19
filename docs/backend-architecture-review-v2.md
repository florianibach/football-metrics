# Backend Architecture Review v2 (Deep-Dive Delta zu Review 1)

## 1) Executive Delta Summary

### Was sich aus Review 1 klar bestätigt

1. **Use-Case-Schicht wurde eingeführt, aber die Architekturgrenzen sind noch nicht stabil.**
   - Positiv: `TcxController` delegiert wesentliche Flows an `ITcxSessionUseCase`.
   - Aber: Der Controller enthält weiterhin fachliche Vorvalidierung, Parsing und Response-Rehydration/Mapping; zusätzlich existiert ein zweiter Konstruktor, der Use-Case manuell zusammensetzt.
2. **Transaktionale Updates wurden verbessert, aber nur innerhalb einzelner Repository-Methoden.**
   - `UpdateSessionPreferencesAndSnapshotsAsync` ist atomar.
   - Gesamt-Workflow (z. B. Upload persistieren + AdaptiveStats upserten) ist weiterhin nicht atomar.
3. **API-Fehlerverträge sind deutlich besser (ProblemDetails + errorCode), aber noch nicht konsistent bis in alle Failure-Pfade.**
4. **Adaptive Threshold-Performance wurde sinnvoll entschärft** (Aggregat aus `TcxAdaptiveStats` statt Vollscan/Neu-Parsing aller Uploads).
5. **Extractor-Zerlegung wurde faktisch nicht erreicht**: Kernlogik ist weiterhin in einem statischen, sehr großen Modul konzentriert (`TcxMetricsExtractor.cs` ~1000 Zeilen).

### Was in Review 1 unterschätzt wurde

1. **Read-Pfad-Skalierungsrisiko durch “parse-on-read”** wurde unterschätzt.
   - `GET /api/v1/tcx` lädt pro Session das gesamte Raw-BLOB und berechnet bei jeder Antwort die Summary neu.
   - Das ist CPU-, Memory- und Latenz-kritisch bei wachsender Session-Anzahl.
2. **Implizite Doppel-/Dreifacharbeit im Upload-Flow** wurde unterschätzt.
   - Parse im Controller (Vorprüfung), Parse im Use-Case (erneut), und erneute Analyse für Response/AdaptiveStats.
3. **Idempotenz fehlt auf Write-Endpoints** (insb. Upload/Recalculate). Wiederholte Requests erzeugen neue bzw. zusätzliche Zustände ohne dedupe-Strategie.
4. **Boundary-Tests fehlen für Architekturregeln** (Layering, API-Domain-Entkopplung, Transaktionsgarantien über Methoden hinweg).

### Was aus Review 1 rückblickend überpriorisiert wirkt

1. **“Migration Runner vorhanden = ausreichend adressiert”** war zu optimistisch.
   - Es gibt zwar `SchemaVersions`, aber weiterhin DDL-Mischung aus “baseline create”, “ensure column exists” und “migration slot”; das ist nicht klar als ein konsistentes Migrationsmodell durchgezogen.
2. **“API DTO-Entkopplung done”** ist überzeichnet.
   - DTOs referenzieren weiterhin Domänenmodelle (`MetricThresholdProfile`, `TcxActivitySummary`, `AppliedProfileSnapshot` etc.) direkt.

---

## 2) Architektur-Reifegrad-Einschätzung

**Score: 6/10 (solider MVP→R2-Stand mit kritischen Skalierungs-/Evolutionskanten).**

**Begründung:**
- **+** Gute Baseline bei operativen Basics (ProblemDetails, Health, Rate Limit, CORS-Konfig), Use-Case-Einführung und funktionaler Abdeckung.
- **+** Repositories und Use-Cases sind vorhanden, wodurch inkrementelle Verbesserung möglich ist.
- **-** Architekturregeln sind nicht strikt: Controller enthält weiterhin Domänen-/Parsing-Anteile; API-/Domain-Modelle sind gekoppelt.
- **-** Read-Pfade sind bei Datenwachstum teuer (BLOB-Laden + Recompute).
- **-** Idempotenz, workflow-weite Atomarität und klare Contract-/Boundary-Tests sind unvollständig.

---

## 3) Kritische Erkenntnisse (High-Impact)

### K1 — Parse-on-read + BLOB-heavy Reads machen Feature-Erweiterung schnell teuer

- **Fundstelle:**
  - `TcxController.ToResponse(...)` berechnet Summary pro Response aus `RawFileContent`.
  - `TcxSessionUseCase.CreateSummaryFromRawContent(...)` lädt/parst XML bei jedem Aufruf.
  - `TcxUploadRepository.ListAsync()` selektiert `RawFileContent` für Listen-Endpoint.
- **Warum kritisch?**
  - Jede Erweiterung am Session-Listing/Filtering/Sorting skaliert schlecht, weil die teuerste Arbeit am Read-Pfad hängt.
- **Konkretes Risiko für kommende Features:**
  - Timeline, Team-Ansichten, Export- oder Vergleichsfeatures erzeugen überproportionale Last; P95/P99-Latenz steigt früh stark.

### K2 — Workflow-Atomarität endet an Repository-Grenzen

- **Fundstelle:**
  - `TcxSessionUseCase.UploadTcxAsync`: `AddAsync` und danach `RefreshAdaptiveStatsAsync` als getrennte DB-Operationen.
  - `RefreshAdaptiveStatsAsync` führt eigenes Upsert aus.
- **Warum kritisch?**
  - Teilfehler führen zu inkonsistenten Nebenartefakten (Session vorhanden, AdaptiveStats fehlend/veraltet).
- **Konkretes Risiko für kommende Features:**
  - Alle Features, die adaptive Werte, Leaderboards oder Profileffekte nutzen, liefern nicht-deterministische Ergebnisse.

### K3 — Hidden Coupling durch API↔Domain-Leak

- **Fundstelle:**
  - `Api/V1/TcxDtos.cs` und `Api/V1/ProfileDtos.cs` referenzieren Domänentypen direkt.
- **Warum kritisch?**
  - Interne Modelländerungen werden implizit API-Breaks.
- **Konkretes Risiko für kommende Features:**
  - Versionierung, Partner-Integrationen und additive API-Entwicklung werden riskanter und langsamer.

### K4 — Implizite Architekturabweichung: Controller baut Use-Case selbst zusammen

- **Fundstelle:**
  - Zweiter Konstruktor in `TcxController` instanziiert `TcxSessionUseCase` direkt mit konkreten Abhängigkeiten.
- **Warum kritisch?**
  - DI-Regeln werden unterlaufen; Testbarkeit und Austauschbarkeit sinken; Architekturreferenz wird inkonsistent.
- **Konkretes Risiko für kommende Features:**
  - Cross-Cutting (Tracing, Policies, Caching, Decorators) greift nicht verlässlich auf alle Pfade.

### K5 — Fehlersemantik und Idempotenz in Write-Pfaden unvollständig

- **Fundstelle:**
  - `UploadTcx`: persist failure mapped auf `upload_parse_failed` statt `upload_storage_failed`.
  - Keine Idempotency-Key-/Dedup-Strategie bei Upload/Recalculate.
- **Warum kritisch?**
  - Unklare Fehlerdiagnose + doppelte Verarbeitung bei Retries.
- **Konkretes Risiko für kommende Features:**
  - Mobile/instabile Clients, Queue-Replays oder API-Gateway-Retries erzeugen Duplikate und inkonsistente Historien.

### K6 — Testarchitektur schützt funktionale Flows, aber nicht die Architekturgrenzen

- **Fundstelle:**
  - Starkes Integrations-Testing (`WebApplicationFactory`), kaum explizite Contract-/Boundary-/Architekturtests.
- **Warum kritisch?**
  - Architekturerosion wird spät erkannt.
- **Konkretes Risiko für kommende Features:**
  - Mit wachsender Teamgröße steigen unbemerkte Layer-Verstöße und Regressionen der API-Verträge.

---

## 4) Überarbeiteter Maßnahmenkatalog (Delta zu Review 1)

> Fokus: strukturelle Hebel mit hohem Zukunftsnutzen. Nur Ergänzungen/Korrekturen.

### BAR2-001
- **Bezug zu Review 1:** Ergänzt BAR-004/BAR-009
- **Problem:** Read-Model berechnet teure Summarys on-demand aus BLOB.
- **Konkreter Vorschlag:**
  - Persistiere ein `SessionSummarySnapshotJson` (oder normalisierte Read-Model-Spalten) bei Upload/Recalculate/Override.
  - `GET /api/v1/tcx` und `GET /api/v1/tcx/{id}` lesen primär Snapshot statt Raw-Parsing.
  - Fallback-Recompute nur als Reparaturpfad.
- **Nutzen:** Massive Entkopplung von Read-Latenz zu Datenmenge; Features auf Listen/Analytics werden planbar.
- **Aufwand:** **M**
- **Risiko:** Snapshot-Invalidierung bei Logikänderungen (mit versioniertem Snapshot-Schema mitigierbar).
- **Neue Priorität:** **Hoch**
- **Blockiert zukünftige Features?** **Ja**

### BAR2-002
- **Bezug zu Review 1:** Präzisiert BAR-002
- **Problem:** Workflow-weite Atomarität fehlt (Upload + AdaptiveStats + evtl. Snapshot).
- **Konkreter Vorschlag:**
  - Einführung eines transaktionalen Repository-Workflows je Use-Case (`ExecuteInTransactionAsync`).
  - `AddUpload + UpsertAdaptiveStats + SaveSummarySnapshot` in einer Transaktion.
- **Nutzen:** Deterministenter Zustand, weniger Reparatur-/Backfill-Aufwand.
- **Aufwand:** **M**
- **Risiko:** Refactoring mehrerer Repository-Methoden.
- **Neue Priorität:** **Hoch**
- **Blockiert zukünftige Features?** **Ja**

### BAR2-003
- **Bezug zu Review 1:** Korrigiert BAR-009 (“done” war zu optimistisch)
- **Problem:** DTOs leaken Domänenmodelle.
- **Konkreter Vorschlag:**
  - Einführung dedizierter API-Contracts (Response/Request), keine Domänentypen im API-Namespace.
  - Mapper-Schicht (UseCase→API) als einzige Übersetzungsstelle.
  - Contract-Tests auf JSON-Shape + required/optional-Felder.
- **Nutzen:** Stabiler API-Vertrag, reduzierte Breaking-Change-Gefahr.
- **Aufwand:** **M**
- **Risiko:** Initial Mapping-Overhead.
- **Neue Priorität:** **Hoch**
- **Blockiert zukünftige Features?** **Ja**

### BAR2-004
- **Bezug zu Review 1:** Ergänzt BAR-003
- **Problem:** Fehlercodes/Fehlerursachen nicht vollständig konsistent; fehlende Idempotenzstrategie.
- **Konkreter Vorschlag:**
  - Fehlercode-Matrix pro Endpoint (Validation/Parse/Storage/Conflict/Timeout).
  - Korrekte Zuordnung `upload_storage_failed` im Storage-Fehlerpfad.
  - Idempotency-Key (Header) für Upload/Recalculate + optional Hash-basierte Duplikat-Erkennung.
- **Nutzen:** Resiliente Retries, weniger Doppelverarbeitung, bessere Operability.
- **Aufwand:** **M**
- **Risiko:** API-Kontrakt-Erweiterung.
- **Neue Priorität:** **Hoch**
- **Blockiert zukünftige Features?** **Ja**

### BAR2-005
- **Bezug zu Review 1:** Ergänzt BAR-001
- **Problem:** Controller verletzt Zielarchitektur (eigene Use-Case-Instanziierung, Parsing-Logik, Doppelarbeit).
- **Konkreter Vorschlag:**
  - Entfernen des manuellen Konstruktors; nur DI-Konstruktor.
  - Parsing-/Validierungslogik in Use-Case oder dedizierte Request-Validatoren.
  - Pro Request genau ein Parsing-Pfad.
- **Nutzen:** Klare Layer-Regeln, weniger Hidden Coupling, geringere CPU-Last.
- **Aufwand:** **S-M**
- **Risiko:** Kleine Testanpassungen.
- **Neue Priorität:** **Mittel-Hoch**
- **Blockiert zukünftige Features?** **Nein**

### BAR2-006
- **Bezug zu Review 1:** Korrektur BAR-006
- **Problem:** Migrationsstrategie weiterhin hybrid/inkonsistent.
- **Konkreter Vorschlag:**
  - Klare Regel: **Nur** versionierte SQL-Skripte ändern Schema; `EnsureColumnExists*` mittelfristig entfernen.
  - Baseline-Migration + fortlaufende nummerierte Skripte; Startup führt ausschließlich Runner aus.
- **Nutzen:** Reproduzierbare Deployments, weniger Drift zwischen Umgebungen.
- **Aufwand:** **M**
- **Risiko:** Einmalige Migration der bestehenden Initialisierungslogik.
- **Neue Priorität:** **Mittel**
- **Blockiert zukünftige Features?** **Nein**

### BAR2-007
- **Bezug zu Review 1:** Ergänzt BAR-010
- **Problem:** Fehlende Architektur-/Boundary-Tests.
- **Konkreter Vorschlag:**
  - Architekturschutztests (z. B. “Controller darf nicht auf Repository zugreifen”, “API-DTOs enthalten keine Domain-Typen”).
  - Contract-Tests für kritische Endpunkte inkl. Fehlerfälle.
  - Deterministische Tests für Idempotenz- und Retry-Verhalten.
- **Nutzen:** Frühzeitige Erkennung von Architekturerosion.
- **Aufwand:** **S-M**
- **Risiko:** Test-Setup-Aufwand.
- **Neue Priorität:** **Mittel-Hoch**
- **Blockiert zukünftige Features?** **Nein**

### BAR2-008
- **Bezug zu Review 1:** Ergänzt BAR-008
- **Problem:** Keine Domänenmetriken für Kernpfade (Parse-Zeit, Recalculate-Zeit, Snapshot-Hit/Miss, AdaptiveStats-Lag).
- **Konkreter Vorschlag:**
  - OTel-Metrics/Tracing auf Use-Case-Ebene mit klaren Events.
  - Alerting-Schwellen für Latenz und Fehlercodes.
- **Nutzen:** Performance-Risiken werden sichtbar, bevor sie Feature-Delivery blockieren.
- **Aufwand:** **S**
- **Risiko:** Metric-Cardinality steuern.
- **Neue Priorität:** **Mittel**
- **Blockiert zukünftige Features?** **Nein**

---

## 5) Architektur-Entscheidungen, die jetzt bewusst getroffen werden sollten

1. **Read-Model-Strategie für Session-Daten**
   - Entscheidung: On-demand-Recompute vs. persistiertes Summary-Snapshot.
   - Empfehlung: Snapshot-first mit versioniertem Rebuild-Mechanismus.

2. **Transaktionsgrenze pro Use-Case**
   - Entscheidung: Sind Upload/Recalculate “single atomic business operation”?
   - Empfehlung: Ja, inkl. aller abgeleiteten Persistenzen.

3. **API-Contract-Isolation**
   - Entscheidung: Dürfen API-DTOs Domänentypen referenzieren?
   - Empfehlung: Nein, nur dedizierte API-Contracts.

4. **Idempotenz-Policy für mutierende Endpunkte**
   - Entscheidung: Welche Endpunkte sind retry-safe, mit welchem Schlüssel?
   - Empfehlung: Upload/Recalculate mit Idempotency-Key + Konfliktsemantik.

5. **Migrationsgovernance**
   - Entscheidung: Wer/was darf Schema ändern?
   - Empfehlung: Ausschließlich versionierte Migrationen; kein ad-hoc Ensure im Runtime-Pfad.

---

## 6) Konkrete “Do Not Cross”-Regeln für neue Features

1. **Controller dürfen keine Repositories direkt referenzieren oder Use-Cases manuell instanziieren.**
2. **API-DTOs dürfen keine Typen aus `Models/` verwenden.**
3. **`GET`-Endpoints dürfen keine XML-Parsing- oder BLOB-Recompute-Logik enthalten.**
4. **Jeder mutierende Use-Case muss eine explizite Transaktionsgrenze besitzen (inkl. abgeleiteter Writes).**
5. **Alle neuen Write-Endpoints benötigen definierte Idempotenz-Strategie (Key, Konfliktverhalten, TTL).**
6. **Neue Schemaänderungen ausschließlich über versionierte Migrationen; keine neuen `EnsureColumnExists`-Pfade.**
7. **Jeder neue API-Endpoint benötigt Contract-Tests für Success + Error-Schema.**
8. **Jeder neue Cross-Cutting Concern (Logging/Metrics/Validation) wird in Use-Case-/Middleware-Schicht implementiert, nicht dupliziert in Controllern.**

---

## Fokusliste mit größtem Hebel (Top 5)

1. **BAR2-001 Read-Model/Summary-Snapshot** *(blockiert Feature-Skalierung direkt)*
2. **BAR2-002 Workflow-Atomarität** *(verhindert inkonsistente Daten als Multiplikatorproblem)*
3. **BAR2-003 API-Contract-Isolation** *(verhindert zukünftige API-Blockaden/Breaking Changes)*
4. **BAR2-004 Fehlercode-Konsistenz + Idempotenz** *(stabilisiert Integrationen und Retries)*
5. **BAR2-005 harte Layer-Regeln im Controller/Use-Case-Schnitt** *(senkt strukturelle Erosionsrate)*

Diese fünf Maßnahmen liefern den größten strukturellen Hebel für kommende Features, ohne Rewrite.
