# Football Metrics

Initiales Monorepo-Setup für eine lokal hostbare WebApp zur Analyse von Amateur-Fußballmetriken auf Basis von Laufuhrdaten (Start mit TCX-Upload).

## Architektur

- **Backend:** ASP.NET Core Web API auf **.NET 10 / C# 14**.
- **Persistenz:** SQLite via EF Core, DB-Zugriff über Repository-Abstraktion (`ITcxUploadRepository`) für späteren DB-Wechsel.
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

- `POST /api/tcx/upload` – nimmt eine `.tcx` Datei entgegen.
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
cd backend/src/FootballMetrics.Api
dotnet restore
dotnet run
```

## Tests

- Backend Integrationstest: `backend/tests/FootballMetrics.Api.Tests`
- Frontend Unit-Test: `frontend/src/App.test.tsx`
- E2E Smoke-Test: `scripts/e2e-smoke.sh`

## Raspberry Pi Hinweise

- Für Raspberry Pi bevorzugt `linux/arm64` Images bauen (z. B. via `docker buildx`).
- SQLite ist für den Start gut geeignet; durch Repository-Schicht kann später auf PostgreSQL o.ä. gewechselt werden.

