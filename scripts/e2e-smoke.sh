#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"

for i in {1..40}; do
  if curl -fsS "$API_URL/swagger/index.html" >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [[ "$i" -eq 40 ]]; then
    echo "API did not become ready in time"
    exit 1
  fi
done

echo '<TrainingCenterDatabase></TrainingCenterDatabase>' > /tmp/sample.tcx

curl -fsS -X POST "$API_URL/api/tcx/upload" \
  -F "file=@/tmp/sample.tcx;type=application/xml"

curl -fsS "$API_URL/api/tcx" | jq 'length >= 1' | grep true

echo "E2E smoke test passed"
