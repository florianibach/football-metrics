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
- Backend API: `http://localhost:8080`
- Swagger: `http://localhost:8080/swagger`

## API Endpoints (initial)

- `POST /api/tcx/upload` – nimmt eine `.tcx` Datei (max. 20 MB) entgegen, validiert Struktur (XML, Activity, Trackpoint) und gibt konkrete Fehlerhinweise bei ungültigen Dateien zurück.
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

