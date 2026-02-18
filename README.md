# Football Metrics

Initiales Monorepo-Setup für eine lokal hostbare WebApp zur Analyse von Amateur-Fußballmetriken auf Basis von Laufuhrdaten (Start mit TCX-Upload).

## Architektur

- **Backend:** ASP.NET Core Web API auf **.NET 10 / C# 14**.
- **Persistenz:** SQLite via Microsoft.Data.Sqlite (ohne Entity Framework), DB-Zugriff über Repository-Abstraktion (`ITcxUploadRepository`) für späteren DB-Wechsel.
- **Frontend (aktuell gewählt):** React + TypeScript + Vite.
- **Containerisierung:** Docker + `docker-compose`.
- **CI/CD:** GitHub Actions mit Backend-Tests, Frontend-Tests, E2E-Smoke-Test, optionalem Render-Deploy und ntfy-Benachrichtigung.

## Frontend-Optionen für spätere Native Apps

### 1) React + Capacitor (**Empfehlung für dieses Setup**)
- Vorteil: Web-App bleibt identisch, Native Shell für Android/iOS über Capacitor.
- Geringe Umstellung vom aktuellen Setup.

### 2) Ionic React
- Vorteil: UI-Komponenten mit mobilem Fokus, sehr schneller Einstieg für App-Feeling.
- Gute Ergänzung zu Capacitor.

### 3) Flutter (Alternative)
- Vorteil: Sehr gute native UX.
- Nachteil: Kein direkter Reuse des aktuellen React-Frontends (mehr Rewrite-Aufwand).

## Lokaler Start

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API (direkt): `http://localhost:8080`
- Backend API (über Frontend-Proxy): `http://localhost:3000/api/...`
- Swagger: `http://localhost:8080/swagger`

## API Endpoints (initial)


Für Frontend-Config gilt: `VITE_API_BASE_URL` sollte auf den API-Pfad inkl. `/api` zeigen (z. B. `/api` oder `http://localhost:8080/api`).
Hinweis: Das Frontend-Nginx proxyt `/api/*` an das Backend und erlaubt Uploads bis 25 MB (`client_max_body_size`), damit der 20 MB TCX-API-Limit korrekt erreicht werden kann.

- `POST /api/tcx/upload` – nimmt eine `.tcx` Datei (max. 20 MB) entgegen, validiert Struktur (XML, Activity, Trackpoint), speichert die Rohdatei unverändert als BLOB inkl. SHA-256-Hash in SQLite und gibt konkrete Fehlerhinweise bei ungültigen Dateien bzw. Speicherfehlern zurück. Zusätzlich enthält die Antwort eine Basiszusammenfassung (Startzeit, Dauer, Trackpunkte, Herzfrequenz min/avg/max, Distanz, GPS-Status). Die Distanz wird bei GPS-Punkten über eine fußballspezifische adaptive Glättung auf GPS-Basis berechnet (Kurzrichtungswechsel werden bevorzugt erhalten, unplausible Ausreißer geglättet); Datei-Distanz bleibt als Referenz erhalten. Die verwendete Glättungsstrategie inkl. Parametern wird im Feld `summary.smoothing` zurückgegeben.
- `GET /api/tcx` – listet hochgeladene Dateien inkl. Basis-Summary (Aktivitätszeitpunkt, Qualitätsstatus) auf.
- `GET /api/tcx/{id}` – liefert die Detaildaten einer einzelnen Session.

## Entwicklung ohne Docker

### Frontend
```bash
cd frontend
npm ci
npm run dev
```

### Backend
```bash
./scripts/bootstrap-dotnet.sh
export PATH="$HOME/.dotnet:$PATH"
cd backend/src/FootballMetrics.Api
dotnet restore
dotnet run
```


## UI Sprache

- Die UI unterstützt Deutsch und Englisch.
- Standard ist die Browsersprache (`de` -> Deutsch, sonst Englisch).
- Fallback ist immer Englisch.
- Nutzer können die Sprache in der Oberfläche manuell umstellen.


## Qualitätslogik (MVP-04)

Die API berechnet für jede hochgeladene TCX-Datei einen Qualitätsstatus `High`, `Medium` oder `Low` und liefert zusätzlich Klartext-Gründe (`qualityReasons`).

Bewertete Signale:
- Anteil fehlender Zeitstempel je Trackpoint
- Anteil fehlender GPS-Koordinaten je Trackpoint
- Anteil fehlender Herzfrequenzwerte je Trackpoint
- Unplausible GPS-Sprünge auf Basis der Segmentgeschwindigkeit (Schwellwert: > 12.5 m/s)

Scoring-Logik (erweiterbar):
- Die Punkte sind **Auffälligkeits-/Risikopunkte** (keine Positivpunkte). Mehr Punkte bedeuten also schlechtere Datenqualität.
- Kleine Auffälligkeit: +1 Punkt (Schwellwert **> 10 %** des Signals)
- Große Auffälligkeit: +2 Punkte (Schwellwert **> 50 %** des Signals)
- Für GPS-Sprünge gilt: 1 Sprung = +1, ab 2 Sprüngen = +2
- 0-1 Punkte: `High` (**hohe Datenqualität**)
- 2-3 Punkte: `Medium` (**mittlere Datenqualität**)
- ab 4 Punkte: `Low` (**niedrige Datenqualität**)

Wenn keine Auffälligkeit erkannt wird, wird ein positiver Grundtext zurückgegeben. Die Logik ist zentral in `TcxMetricsExtractor` kapsuliert und kann in späteren Iterationen um zusätzliche Qualitätsindikatoren erweitert werden.


## E2E Smoke ohne Docker (empfohlen für eingeschränkte Environments)

Wenn `docker` lokal oder in CI nicht verfügbar ist, kann der E2E-Smoke-Test jetzt die API automatisch selbst starten.

### Direkt ausführen
```bash
scripts/e2e-smoke.sh
```

Verhalten des Skripts:
- Nutzt eine bereits laufende API, falls unter `API_URL` erreichbar.
- Startet sonst automatisch die lokale API per `dotnet run` (inkl. .NET-Bootstrap über `scripts/bootstrap-dotnet.sh`, falls nötig).
- Prüft weiterhin MVP-02 + MVP-04 (inkl. `qualityStatus` und `qualityReasons`).

### Nützliche Parameter
```bash
API_URL=http://localhost:8080 scripts/e2e-smoke.sh
AUTO_START_API=0 scripts/e2e-smoke.sh
API_LOG_FILE=/tmp/fm-api-e2e.log scripts/e2e-smoke.sh
```

### Troubleshooting
- **`docker: command not found`**: Für lokale Checks stattdessen `./scripts/check-local.sh` oder direkt `scripts/e2e-smoke.sh` nutzen.
- **`API did not become ready in time`**: Logdatei prüfen (Default: `/tmp/football-metrics-e2e-api.log`), Port-Belegung (`8080`) kontrollieren und bei Bedarf `API_URL` setzen.

## Tests

- Backend Integrationstest: `./scripts/test-backend.sh` (installiert bei Bedarf automatisch .NET SDK 10 lokal in `~/.dotnet`)
- Frontend Unit-Test: `cd frontend && npm test -- --run`
- Frontend Build-Check: `cd frontend && npm run build`
- E2E Smoke-Test: `scripts/e2e-smoke.sh`

Vor jedem Commit/PR müssen alle lokal relevanten Checks grün sein (Backend, Frontend und E2E bei betroffenen Änderungen).

Empfohlener Sammelcheck:
```bash
./scripts/check-local.sh
```

## Raspberry Pi Hinweise

- Für Raspberry Pi bevorzugt `linux/arm64` Images bauen (z. B. via `docker buildx`).
- SQLite ist für den Start gut geeignet; durch Repository-Schicht kann später auf PostgreSQL o.ä. gewechselt werden.


## Session-Liste (MVP-05)

- Das Frontend zeigt unterhalb des Upload-Formulars eine Upload-Historie als Tabelle.
- Angezeigt werden je Session mindestens: Dateiname, Upload-Zeit, Aktivitätszeitpunkt und Qualitätsstatus.
- Standard-Sortierung ist neueste Uploads zuerst; optional ist Umschalten auf älteste zuerst möglich.
- Über den Button **Open details / Details öffnen** wird die Session als Detailansicht eingeblendet.

## Session-Detailseite (MVP-06)

- Die Detailansicht zeigt Basiskennzahlen je Session: Startzeit, Dauer, Distanz, Herzfrequenz (min/avg/max), Trackpunkte, GPS-Status und Qualitätsinformationen.
- Jede angezeigte Metrik besitzt ein Info-Element (`ⓘ` als Tooltip via `title`) mit Zweck, vereinfachter Interpretation und Einheit.
- Bei quality-gated Kernmetriken enthalten relevante Erklärungstexte zusätzlich, wann Werte nicht verfügbar sind (z. B. unzureichende GPS- oder HF-Qualität), ohne diesen Hinweis bei nicht betroffenen Metriken zu wiederholen.
- Für Kernmetriken sind die Hilfetexte interpretierbarer formuliert; bei TRIMP und HF-Erholung ist zusätzlich eine grobe Einordnung (niedrig/mittel/hoch) enthalten.
- Bei fehlenden Werten werden Metriken klar als **Not available / Nicht vorhanden** markiert.
- Zusätzlich werden verständliche Hinweise eingeblendet, warum Herzfrequenz- oder Distanzwerte fehlen (z. B. keine GPS-Koordinaten).
- Die Detailansicht wurde responsiv erweitert, damit Historie und Session-Daten auf Mobile und Desktop lesbar bleiben.




## Vergleich Rohdaten vs. geglättet (R1-02)

- In der Session-Detailansicht kann zwischen **Rohdaten** und **Geglättet** umgeschaltet werden (sofern GPS-Daten vorhanden sind).
- Die Umschaltung beeinflusst die angezeigte Distanz und Richtungswechsel-Anzahl auf Basis der vorhandenen `summary.smoothing`-Trace; die Distanz wird dafür mit höherer Präzision (km + Meter) angezeigt, damit Unterschiede zwischen Raw und Smoothed sichtbar bleiben.
- Eine zusätzliche Kennzahl zeigt transparent die Datenveränderung durch die Glättung (Anteil korrigierter Punkte + Distanzabweichung in Metern mit 3 Nachkommastellen, damit auch sehr kleine Deltas sichtbar sind).
- Bei Sessions ohne GPS ist der Vergleich deaktiviert und wird in der UI verständlich begründet.

## Glättungsfilter pro Session auswählbar (R1-07)

- In der Session-Detailansicht kann je Session ein Glättungsfilter gewählt werden: `Raw`, `AdaptiveMedian`, `Savitzky-Golay`, `Butterworth`.
- Die Auswahl wird per API (`PUT /api/tcx/{id}/smoothing-filter`) pro Session persistiert und bei `GET /api/tcx` sowie `GET /api/tcx/{id}` wieder ausgeliefert.
- Die gewählte Filterstrategie wird im Analyseprotokoll unter `summary.smoothing.selectedStrategy` nachvollziehbar angezeigt.
- Für Sessions ohne GPS ist die Filterauswahl deaktiviert; die UI zeigt eine verständliche Begründung.

## Filter-Erklärung und empfohlener Standard (R1-08)

- In den Session-Details ergänzt die UI eine **Filter-Hilfe** mit Produktempfehlung: **AdaptiveMedian** ist als empfohlener Standard markiert.
- Für jeden Filter (`Raw`, `AdaptiveMedian`, `Savitzky-Golay`, `Butterworth`) gibt es eine Kurzbeschreibung mit Zweck, Stärken, Grenzen und typischer Nutzung.
- Die UI weist transparent darauf hin, dass sich beim Filterwechsel angezeigte Kennzahlen (z. B. Distanz, Richtungswechsel, abgeleitete Metriken) ändern können.
- Alle Texte sind konsistent in **Deutsch/Englisch** lokalisiert und direkt im Bereich der Filterauswahl erreichbar.


## Profil-Default für Glättungsfilter (R1.5-08)

- Im Profil kann ein bevorzugter Standard-Glättungsfilter gesetzt werden (`Raw`, `AdaptiveMedian`, `Savitzky-Golay`, `Butterworth`).
- Neue Uploads übernehmen diesen Profil-Default automatisch als initial aktiven Session-Filter.
- Die Session-Filterauswahl bleibt pro Session manuell überschreibbar (`PUT /api/tcx/{id}/smoothing-filter`).
- Die API liefert transparent die Herkunft des aktiven Filters über `selectedSmoothingFilterSource` mit `ProfileDefault` oder `ManualOverride`; die UI zeigt diese Herkunft in der Session-Detailansicht an.

## Adaptive vs. fixe Schwellen im Profil (R1.5-10)

- In den Profileinstellungen kann pro Schwelle ein Modus gewählt werden: `Fixed` oder `Adaptive`.
- Für adaptive Schwellen berechnet das Backend den aktuell wirksamen Wert als Maximum über alle vorhandenen Sessions des Nutzers (Datenbasis: gespeicherte Session-Rohdaten).
- In der Session-Ansicht werden Schwellen transparent mit Wert, Modus und Quelle (`...Source=Fixed|Adaptive`) angezeigt.
- Validierung verhindert widersprüchliche Konfigurationen (Sprint- und High-Intensity-Schwelle können nicht gleichzeitig adaptiv sein).

## Fußball-Kernmetriken (R1-03)

- Die API liefert unter `summary.coreMetrics` die v1-Kernmetriken: Distanz, Sprintdistanz, Anzahl Sprints, Maximalgeschwindigkeit, Hochintensitätszeit und Anzahl hochintensiver Läufe.
- Initiale Schwellwerte sind dokumentiert und im Payload transparent enthalten:
  - `SprintSpeedThresholdMps = 7.0`
  - `HighIntensitySpeedThresholdMps = 5.5`
- Quality-Gating: Die Kernmetriken werden aktuell nur bei `qualityStatus = High` berechnet.
- Bei unzureichender Qualität liefert die API einen verständlichen Hinweis in `summary.coreMetrics.unavailableReason`, statt numerischer Werte.
- Die UI zeigt die Kernmetriken in der Session-Detailansicht an und blendet bei Quality-Gating den Hinweistext ein.

- Ergänzt um weitere Fußball-Metriken aus `analysis/Auswertung von GPS- und Herzfrequenzdaten im Amateurfußball.pdf` (R1-03 Erweiterung):
  - `highSpeedDistanceMeters` (hochintensive Laufdistanz)
  - `highIntensityRunCount` (Anzahl hochintensive Läufe)
  - `runningDensityMetersPerMinute` (Laufdichte)
  - `accelerationCount` / `decelerationCount` (neuromuskuläre Last)
  - Herzfrequenzzonenzeit `<70%`, `70-85%`, `>85%` (auf Basis session-interner HFmax)
  - `trainingImpulseEdwards` (TRIMP)
  - `heartRateRecoveryAfter60Seconds` (HF-Erholung)

## GPS-/Nicht-GPS-Fallbacklogik in Metriken (R1-04)

- Kernmetriken verwenden nun eine per-Metrik-Verfügbarkeit (`summary.coreMetrics.metricAvailability`) mit den Zuständen:
  - `Available`
  - `NotMeasured` (z. B. GPS nicht aufgezeichnet)
  - `NotUsable` (Messung vorhanden, aber nicht zuverlässig nutzbar)
- Bei Sessions ohne GPS werden HF-basierte Metriken weiterhin berechnet (u. a. HF-Zonenzeiten, TRIMP, HF-Erholung), sofern ausreichend HR+Zeitdaten vorliegen.
- GPS-abhängige Metriken (z. B. Distanz, Sprintanzahl, Maximalgeschwindigkeit) liefern in diesem Fall keine irreführenden Nullwerte, sondern bleiben `null` und werden über `metricAvailability` transparent begründet.
- Die UI zeigt für nicht verfügbare Kernmetriken nun explizit den Unterschied zwischen **Nicht gemessen** und **Messung unbrauchbar** inklusive Grundtext.


## Upload-Pipeline Format-Adapter (R1-05)

- Der Upload nutzt eine Adapter-/Strategie-Schnittstelle (`IUploadFormatAdapter`) pro Dateityp und einen Resolver (`IUploadFormatAdapterResolver`) für die Dateiendung.
- Aktuell ist in der UI und im Backend weiterhin nur **TCX** freigeschaltet (`.tcx`).
- Nicht unterstützte Endungen werden mit klarer Fehlermeldung abgelehnt; gleichzeitig wird die Endung strukturiert als potenzielles zukünftiges Format geloggt.
- Das aktuelle TCX-Mapping ins kanonische Activity-Modell ist dokumentiert unter `analysis/releases/R1-05_TCX_to_Canonical_Activity_Mapping.md`.

## GPS-Glättung (R1-01)

- Es werden zwei Logiken unterschieden:
  - **Baseline-Glättung** (indirekt über Vergleichskennzahl): gröberer Richtungswechsel-Schwellenwert (65°) zur Referenz.
  - **FootballAdaptiveMedian**: adaptive Median-Glättung mit lokalen Fenstern (3 bzw. 5 Punkte), die schnelle Richtungswechsel (>= 25°) möglichst erhält.
- Unplausible Ausreißer werden über eine robuste, session-adaptive Schwellwertlogik erkannt (`clamp(Median + 6*MAD*1.4826, 6.0, 12.5) m/s`) und lokal korrigiert.
- Für jeden Analyselauf liefert die API eine nachvollziehbare Trace unter `summary.smoothing`, u. a. mit:
  - `selectedStrategy`, `selectedParameters` (inkl. `OutlierDetectionMode` und effektiver Schwelle)
  - `rawDistanceMeters`, `smoothedDistanceMeters`
  - `rawDirectionChanges`, `baselineDirectionChanges`, `smoothedDirectionChanges`
  - `correctedOutlierCount`, `analyzedAtUtc`
