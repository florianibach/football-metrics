# Backend Architecture Review (R1.5 → R1+)

## 1) Executive Summary

> Hinweis: Authentifizierung/Autorisierung ist in diesem Review absichtlich **nicht** priorisiert und wird laut Vorgabe in einem Folge-Feature behandelt.

- **Stop-the-bleeding #1:** `TcxController` ist ein „God Controller“ (Upload, Parsing-Orchestrierung, Profil-Snapshotting, Recalculation, Session-Metadaten, Response-Mapping) und bremst jede Erweiterung, weil fast jede Änderung denselben großen Hotspot betrifft.
- **Stop-the-bleeding #2:** Mehrere fachlich zusammengehörige DB-Updates laufen ohne Transaktion über separate Repository-Calls; bei Teilfehlern droht inkonsistenter Zustand (z. B. Filter gesetzt, Source/Profil-Snapshot nicht gesetzt).
- **Stop-the-bleeding #3:** API-Fehlerkontrakte sind uneinheitlich (meist Plain-String, teils StatusCode-only), was Frontend-Neubau, API-Governance und Observability erschwert.
- Die **Domänenlogik ist stark zentralisiert in `TcxMetricsExtractor` (1072 LOC)**: gut für Kapselung, aber schlecht für Wartbarkeit/Testfokus, weil viele Regeln/Algorithmen in einem statischen Modul zusammenlaufen.
- Adaptive Schwellenwerte sind funktional sauber gedacht, aber aktuell mit **teurer Berechnung über alle Uploads inkl. XML-Parsing** pro Aufruf; das skaliert mit wachsender Datenmenge schlecht.
- Die Persistenz ist pragmatisch und robust genug für MVP (SQLite + Repositories + `DatabaseInitializer`), aber **Migrationen sind nur additive `ALTER TABLE`-Checks** und nicht versionsgeführt/auditierbar.
- Security-Basics fehlen weitgehend für R1+ (CORS statisch lokal, keine harte Transport-/Input-/Rate-Limits-Strategie, kaum Security-Header-/Payload-Grenzen).
- Positiv: gute Testbasis mit Integrationsfokus (`WebApplicationFactory`) und klaren AC-orientierten Tests, was inkrementelle Härtung ermöglicht.
- Operability ist minimal: Logging vorhanden, aber keine strukturierten Domänen-Events, keine Metrics/Tracing/Health-Readiness; Betrieb bei Incidents wird unnötig teuer.
- Mit 8–10 gezielten Maßnahmen (ohne Rewrite) lässt sich das Backend in 2–6 Wochen deutlich erweiterbarer und betriebssicherer machen.

---

## 2) Backend-Systemüberblick

### Komponenten / Schichten (Ist)

1. **API Layer (ASP.NET Core Controller)**
   - `TcxController` für Uploads, Read-Model, Session-Kontext, Filter-/Unit-Overrides, Recalculate.
   - `ProfileController` für Profil/Threshold-Konfiguration.

2. **Application-/Domain-nahe Services**
   - `TcxUploadFormatAdapter` + Resolver für Format-Erkennung/Parsing.
   - `MetricThresholdResolver` für effektive (adaptive/fixed) Schwellenwerte.
   - `TcxMetricsExtractor` als zentrale Analyse-/Qualitäts-/Kernmetrik-Engine.

3. **Data Access Layer**
   - `TcxUploadRepository`, `UserProfileRepository` (ADO.NET mit `Microsoft.Data.Sqlite`).
   - `SqliteConnectionFactory`, `DatabaseInitializer`.

4. **Deployment/Runtime**
   - Containerbetrieb via `Dockerfile` + `docker-compose`.
   - CI-Workflow mit Backend-/Frontend-Tests, E2E, optional Deploy + ntfy.

### Datenfluss (vereinfacht)

Upload-Request → `TcxController.UploadTcx` → Adapter-Resolver → Parse + Summary → Profil laden + effektive Thresholds berechnen → Upload persistieren (BLOB + Snapshots) → Response mit neu berechneter Summary.

Lesen/Recalculate/Overrides laufen ebenfalls über Controller → Repository → erneute Summary-Bildung aus gespeichertem Raw-BLOB.

---

## 3) Beobachtungen

### Stärken (beibehalten)

- **Klarer technischer Einstieg ohne Framework-Overhead:** schlankes ASP.NET-Setup, einfache DI, gut verständlich.
- **Repository-Abstraktionen vorhanden:** erleichtert inkrementelle Verbesserung trotz SQLite/ADO.NET.
- **Format-Adapter-Konzept bereits eingeführt:** gutes Erweiterungstor für weitere Importformate.
- **Fachliche Transparenz in Responses:** Summary, Smoothing-Trace, Quality-Reasons, Snapshot-Infos unterstützen Nachvollziehbarkeit.
- **Gute Testbasis mit Integrationscharakter:** `WebApplicationFactory`-Tests validieren echte API-Flows statt nur reine Unit-Slices.

### Schwächen / Risiken (konkret)

1. **Controller-Überlastung / fehlende Use-Case-Schicht**
   - Fundstellen: `backend/src/FootballMetrics.Api/Controllers/TcxController.cs`, `backend/src/FootballMetrics.Api/Controllers/ProfileController.cs`
   - Symptom: Parsing, Validierung, Persistenz-Orchestrierung, Snapshoting, Fehlerbehandlung und Response-Mapping liegen direkt in Controllern.

2. **Fehlende Transaktionsgrenzen bei Mehrfach-Updates**
   - Fundstellen: `TcxController` (`UpdateSessionSmoothingFilter`, `UpdateSessionSpeedUnit`, `RecalculateWithCurrentProfile`), `TcxUploadRepository` (separate Update-Methoden)
   - Symptom: inkonsistente Zustände bei Teilfehlern möglich.

3. **Uneinheitliche API-Fehlerverträge**
   - Fundstellen: diverse `BadRequest("...")`/`NotFound()`/`StatusCode(500, "...")` in Controllern
   - Symptom: kein stabiler maschinenlesbarer Fehlercode-Katalog.

4. **Monolithischer, statischer Analysekern (`TcxMetricsExtractor`)**
   - Fundstelle: `backend/src/FootballMetrics.Api/Services/TcxMetricsExtractor.cs` (1072 LOC)
   - Symptom: viele Verantwortlichkeiten in einem Modul (Parsing-nahe Extraktion, Smoothing, Qualitätsbewertung, Core-Metriken, Intervalle).

5. **Skalierungsrisiko bei adaptiven Thresholds**
   - Fundstelle: `MetricThresholdResolver.ResolveEffectiveAsync` lädt alle Uploads (`ListAsync`) und parst je Session XML erneut.
   - Symptom: O(n)-Kosten pro Aufruf mit potenziell teurer CPU/IO.

6. **Schema-Evolution ohne versionierte Migrationen**
   - Fundstelle: `DatabaseInitializer` mit `CREATE TABLE IF NOT EXISTS` + `EnsureColumnExists*`
   - Symptom: Änderungen schwer nachvollziehbar/rollbackbar, bei komplexeren DB-Änderungen riskant.

7. **Security-Lücken für R1+ (ohne Auth-Fokus)**
   - Fundstellen: `Program.cs` (statische lokale CORS-Origins), fehlende Security-Header-/Rate-Limit-/Hardening-Konfiguration auf API-Ebene.
   - Symptom: erhöhte Angriffsfläche bei Input-/Traffic-Missbrauch und inkonsistente Runtime-Härtung.

8. **Operability-Minimum**
   - Fundstellen: `Program.cs`, fehlende Health-/Readiness-Endpunkte; keine Metrics/Tracing-Instrumentierung.
   - Symptom: eingeschränkte Diagnosefähigkeit in Produktion.

9. **Tests stark auf Happy-/Controller-Pfade, weniger auf Domänen-Seams**
   - Fundstellen: `backend/tests/FootballMetrics.Api.Tests/*`
   - Symptom: Kernalgorithmen und Orchestrierungsregeln sind teils schwer isoliert/deterministisch testbar.

10. **Konfigurations-/Env-Strategie noch MVP-nah**
   - Fundstellen: `appsettings*.json`, `Program.cs`, `docker-compose.yml`
   - Symptom: geringe Trennung von dev/prod concerns (z. B. CORS, Security-Policies, Betriebsflags).

---

## 4) Maßnahmenkatalog (priorisiert)

> Priorisierung nach: (1) Risiko/Fehleranfälligkeit, (2) Impact auf Erweiterbarkeit, (3) Aufwand.

### BAR-001 — Use-Case-Schicht zwischen Controller und Repositories einziehen
- **Kategorie:** Architektur
- **Problem:** Controller enthalten Orchestrierung + Fachlogik + Mapping (`TcxController`, `ProfileController`).
- **Vorschlag:** Pro kritischem Flow einen Application-Service/Use-Case einführen (z. B. `UploadSessionUseCase`, `RecalculateSessionUseCase`, `UpdateProfileUseCase`), Controller nur für I/O und HTTP-Details.
- **Nutzen:** Höhere Erweiterbarkeit, bessere Testbarkeit, geringere Merge-Konflikte.
- **Aufwand:** **M** (3–5 PT)
- **Risiko/Trade-offs:** Kurzfristig mehr Klassen/Boilerplate.
- **Abhängigkeiten/Reihenfolge:** Startmaßnahme für viele Folgepunkte.
- **Quick Win:** **Nein**

### BAR-002 — Transaktionale Repository-Operationen für Multi-Step-Updates
- **Kategorie:** Data Access
- **Problem:** Mehrere `Update*Async`-Aufrufe ohne gemeinsame Transaktion (z. B. Recalculate-Flow).
- **Vorschlag:** Repository-Methoden zu atomaren Kommandos bündeln (z. B. `UpdateSessionPreferencesAndSnapshotsAsync(...)`), intern `BEGIN/COMMIT/ROLLBACK`.
- **Nutzen:** Verhindert inkonsistente Datenzustände; reduziert Incident-Risiko.
- **Aufwand:** **S-M** (1–3 PT)
- **Risiko/Trade-offs:** API der Repositories ändert sich gezielt.
- **Abhängigkeiten/Reihenfolge:** Direkt nach/parallel zu BAR-001.
- **Quick Win:** **Ja**

### BAR-003 — Einheitliches Error Contract (`ProblemDetails` + Error Codes)
- **Kategorie:** API
- **Problem:** Heterogene Fehlerantworten (Strings/Status-only).
- **Vorschlag:** Globales Exception-/Validation-Handling via Middleware/Filter; standardisierte `ProblemDetails` mit `errorCode`, `traceId`, `details`.
- **Nutzen:** Stabiler API-Vertrag für neues Frontend, bessere Diagnostik & Monitoring.
- **Aufwand:** **S-M** (2–3 PT)
- **Risiko/Trade-offs:** Frontend/API-Consumer müssen ggf. auf neuen Fehlervertrag migrieren.
- **Abhängigkeiten/Reihenfolge:** Früh in Phase 0/1.
- **Quick Win:** **Ja**

### BAR-004 — `TcxMetricsExtractor` modularisieren (ohne Rewrite)
- **Kategorie:** Code-Struktur
- **Problem:** 1072 LOC statischer Multi-Responsibility-Kern.
- **Vorschlag:** In klar abgegrenzte Services zerlegen (z. B. `TrackpointParser`, `SmoothingService`, `QualityAssessmentService`, `CoreMetricsService`, `IntervalAggregationService`), orchestriert durch dünnen Facade-Service.
- **Nutzen:** Hohe Wartbarkeit, gezielte Tests, schnellere Feature-Erweiterung.
- **Aufwand:** **L** (6–10 PT inkrementell)
- **Risiko/Trade-offs:** Regression-Risiko bei algorithmischen Pfaden (mit Golden-Master-Tests mitigieren).
- **Abhängigkeiten/Reihenfolge:** Nach BAR-001/003 starten.
- **Quick Win:** **Nein**

### BAR-005 — Adaptive Thresholds: Vorberechnete Session-Stats statt Vollscan
- **Kategorie:** Performance
- **Problem:** `MetricThresholdResolver` parst bei jedem Resolve alle Upload-BLOBs.
- **Vorschlag:** Bei Upload/Recalculate sessionweite Adaptive-Stats persistieren (z. B. `ObservedMaxSpeedMps`, `ObservedMaxHeartRateBpm`) und Resolver nur Aggregatabfrage fahren.
- **Nutzen:** Massive Laufzeitreduktion bei wachsender Datenbasis.
- **Aufwand:** **M** (3–5 PT)
- **Risiko/Trade-offs:** Schemaerweiterung + Backfill für Alt-Daten nötig.
- **Abhängigkeiten/Reihenfolge:** Nach BAR-002/006.
- **Quick Win:** **Nein**

### BAR-006 — Leichtgewichtiges Migrationskonzept einführen
- **Kategorie:** Data Access / DX
- **Problem:** Kein versionsgeführtes DB-Migrationsmodell.
- **Vorschlag:** Minimaler Migration-Runner mit `SchemaVersions`-Tabelle und sequenziellen SQL-Skripten (ohne Technologiewechsel).
- **Nutzen:** Nachvollziehbare Schema-Evolution, weniger Überraschungen bei Deployments.
- **Aufwand:** **M** (2–4 PT)
- **Risiko/Trade-offs:** Einmaliger Umstellungsaufwand.
- **Abhängigkeiten/Reihenfolge:** Vor größeren Schema-Änderungen (z. B. BAR-005) erledigen.
- **Quick Win:** **Ja**

### BAR-007 — Security-Härtung für R1+ (Auth explizit ausgenommen)
- **Kategorie:** Security
- **Problem:** API-Härtung ist minimal (CORS statisch, keine klaren Security-Header, keine Rate-Limits für Upload/Traffic-Spitzen).
- **Vorschlag:** Schrittweise: (1) CORS per Environment-Konfiguration, (2) Security Headers, (3) Request-/Rate-Limits für Upload, (4) restriktivere Payload-/Timeout-Limits, (5) Dependency-Vulnerability-Checks in CI.
- **Nutzen:** Geringeres Missbrauchsrisiko, stabilerer Betrieb unter Last/Fehltraffic.
- **Aufwand:** **M** (3–5 PT)
- **Risiko/Trade-offs:** Einfluss auf lokale Dev-Flows, braucht klaren Rollout mit sinnvollen Defaults.
- **Abhängigkeiten/Reihenfolge:** Früh in Stabilisierung.
- **Quick Win:** **Ja** (CORS/RateLimit/SecurityHeaders)

### BAR-008 — Observability-Baseline (Health, Metrics, Tracing)
- **Kategorie:** Observability
- **Problem:** Keine Readiness/Liveness-Endpunkte, kein Telemetrie-Standard.
- **Vorschlag:** `/health/live`, `/health/ready`, strukturierte Logs mit Korrelations-ID, OpenTelemetry für Requests/DB-Calls, zentrale Error-Counter.
- **Nutzen:** Schnellere Fehleranalyse, bessere Betriebsfähigkeit.
- **Aufwand:** **S-M** (2–4 PT)
- **Risiko/Trade-offs:** Mehr Telemetriedaten/Config-Aufwand.
- **Abhängigkeiten/Reihenfolge:** Parallel zu BAR-003 möglich.
- **Quick Win:** **Ja**

### BAR-009 — API-Kontrakt absichern (Versionierung + DTO-Entkopplung)
- **Kategorie:** API
- **Problem:** Controller-Response nutzt stark interne Modellstrukturen; Versionierung fehlt.
- **Vorschlag:** API-Versionierungsstrategie (`/api/v1`), explizite DTOs getrennt von Persistenz-/Domain-Modellen, Contract-Tests für kritische Endpunkte.
- **Nutzen:** Stabilität für Frontend-Neubau und spätere Breaking-Changes.
- **Aufwand:** **M** (3–5 PT)
- **Risiko/Trade-offs:** Initialer Mapping-Aufwand.
- **Abhängigkeiten/Reihenfolge:** Nach BAR-001/003, vor größeren Features.
- **Quick Win:** **Nein**

### BAR-010 — Teststrategie schärfen: Golden-Master + deterministische Kernlogiktests
- **Kategorie:** Tests
- **Problem:** Gute Integrationsabdeckung, aber zentrale Algorithmen sind schwer isoliert regressionssicher.
- **Vorschlag:** Golden-Master-Testdatensätze für `TcxMetricsExtractor`-Outputs, gezielte Property-/Boundary-Tests für Smoothing/Quality/Threshold-Regeln, Transaktions-/Fehlerpfadtests für neue Use-Cases.
- **Nutzen:** Sichere Evolution trotz wachsender Komplexität.
- **Aufwand:** **M** (3–5 PT)
- **Risiko/Trade-offs:** Testdatenpflege.
- **Abhängigkeiten/Reihenfolge:** Eng gekoppelt mit BAR-004.
- **Quick Win:** **Teilweise**

---

## 5) Roadmap-Vorschlag in Phasen

## Phase 0: Quick Wins (1–3 Tage)

1. **BAR-003** Fehlervertrag (`ProblemDetails` + `errorCode`).
2. **BAR-008** Health-Endpunkte + Korrelations-ID im Logging.
3. **BAR-002 (Teil 1)** atomare Update-Methode für Recalculate-Flow.
4. **BAR-006 (Start)** `SchemaVersions`-Tabelle + erster Migration-Slot.

**Ergebnis:** Sofort weniger Betriebsrisiko und klarere API-Leitplanken.

## Phase 1: Stabilisierung (1–2 Wochen)

1. **BAR-001** Einführung Use-Case-Schicht für Upload/Recalculate/Profile.
2. **BAR-002 (vollständig)** alle Mehrfach-Updates transaktional.
3. **BAR-007 (Baseline)** CORS env-gesteuert, Security-Headers, Upload-Ratelimit, CI-Vulnerability-Check.
4. **BAR-009 (Start)** API v1-Namespace + DTO-Entkopplung für Kernendpunkte.

**Ergebnis:** Stabiler Kern für kommende Features, reduzierte Kopplung.

## Phase 2: Erweiterbarkeit & Leitplanken (2–6 Wochen)

1. **BAR-004** modulare Zerlegung `TcxMetricsExtractor` (inkrementell, testgetrieben).
2. **BAR-005** persistierte Adaptive-Stats + Resolver-Optimierung.
3. **BAR-010** Golden-Master/Regressionssuite für Analysepfade.
4. **BAR-009 (Abschluss)** Contract-Tests + saubere Versionierungsdokumentation.

**Ergebnis:** Gute Feature-Geschwindigkeit bei kontrolliertem Risiko.

---

## 6) Guardrails für kommende Backend-Features

### Konkrete Regeln

1. **Keine Businesslogik in Controllern** – nur HTTP-Parsing, Statuscodes, Delegation.
2. **Domain/Application kennt keine Infrastrukturdetails** – Repository/Adapter nur hinter Interfaces.
3. **Validierung am Rand + fachliche Invarianten im Use-Case/Domain-Service**.
4. **Mehrschrittige Persistenz immer atomar (Transaktion)**.
5. **Fehler immer über standardisierten Error Contract** (`ProblemDetails` + `errorCode`).
6. **Jeder neue Endpoint mit explizitem Request/Response-DTO + Contract-Test**.
7. **Konfigurierbarkeit über `IOptions` + env-spezifische Settings, keine hardcodierten Origins/Flags**.
8. **Neue Metrik-/Analyse-Logik nur in dedizierten Services + Golden-Master-Testfall**.
9. **Observability-by-default:** strukturierter Log, `traceId`, Messpunkte für Laufzeit/Fehler.
10. **Schemaänderungen nur via versionierte Migrationen**.

### Optional: Mini-ADR-Template

```md
# ADR-XXX: <Titel>
- Status: Proposed | Accepted | Deprecated
- Kontext:
- Entscheidung:
- Alternativen:
- Konsequenzen (positiv/negativ):
- Rollout / Migrationsplan:
- Messkriterien (woran erkennen wir Erfolg?):
```

---

## Konkrete nächste 5–10 Maßnahmen (empfohlene Reihenfolge)

1. BAR-003 (Error Contract)
2. BAR-002 (Transaktionaler Recalculate-Flow)
3. BAR-008 (Health + Correlation Logging)
4. BAR-006 (Migration-Framework light)
5. BAR-001 (Use-Case-Schicht für Upload/Recalculate)
6. BAR-007 (Security-Härtung ohne Auth)
7. BAR-009 (API v1 + DTO-Entkopplung)
8. BAR-004 (Extractor modularisieren)
9. BAR-010 (Golden-Master-Teststrategie)
10. BAR-005 (Adaptive-Stats-Optimierung)

Damit sind zuerst die risikoreichsten Bremsklötze adressiert, bevor tiefergehende Strukturarbeit und Performance-Optimierung folgen.
