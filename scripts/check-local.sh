#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PID=""

cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

"$REPO_ROOT/scripts/test-backend.sh"
(
  cd "$REPO_ROOT/frontend"
  npm test -- --run
  npm run build
)

if ! command -v dotnet >/dev/null 2>&1; then
  export PATH="$HOME/.dotnet:$PATH"
fi

dotnet run --project "$REPO_ROOT/backend/src/FootballMetrics.Api/FootballMetrics.Api.csproj" --urls http://0.0.0.0:8080 >/tmp/football-metrics-api.log 2>&1 &
API_PID="$!"

"$REPO_ROOT/scripts/e2e-smoke.sh"

echo "All local checks passed (backend + frontend + e2e)."
