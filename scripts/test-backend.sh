#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP_SCRIPT="$REPO_ROOT/scripts/bootstrap-dotnet.sh"

if ! command -v dotnet >/dev/null 2>&1; then
  "$BOOTSTRAP_SCRIPT"
  export PATH="$HOME/.dotnet:$PATH"
fi

dotnet test "$REPO_ROOT/backend/tests/FootballMetrics.Api.Tests/FootballMetrics.Api.Tests.csproj"
