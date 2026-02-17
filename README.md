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

- `POST /api/tcx/upload` – nimmt eine `.tcx` Datei (max. 20 MB) entgegen, validiert Struktur (XML, Activity, Trackpoint), speichert die Rohdatei unverändert als BLOB inkl. SHA-256-Hash in SQLite und gibt konkrete Fehlerhinweise bei ungültigen Dateien bzw. Speicherfehlern zurück. Zusätzlich enthält die Antwort eine Basiszusammenfassung (Startzeit, Dauer, Trackpunkte, Herzfrequenz min/avg/max, Distanz, GPS-Status). Die Distanz wird bei GPS-Punkten primär per Haversine aus Koordinaten berechnet; Datei-Distanz bleibt als Referenz erhalten.
- `GET /api/tcx` – listet hochgeladene Dateien auf.

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
- Kleine Auffälligkeit: +1 Punkt (Schwellwert **> 10 %** des Signals)
- Große Auffälligkeit: +2 Punkte (Schwellwert **> 50 %** des Signals)
- Für GPS-Sprünge gilt: 1 Sprung = +1, ab 2 Sprüngen = +2
- 0-1 Punkte: `High`
- 2-3 Punkte: `Medium`
- ab 4 Punkte: `Low`

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
