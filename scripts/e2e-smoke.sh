#!/usr/bin/env bash
set -euo pipefail

# Story reference: MVP-02, MVP-04, R1-01, R1-03, R1-07
# Ziel:
# - MVP-02: Verifizieren, dass der Upload-Endpunkt erreichbar ist und ein valider TCX-Upload
#   End-to-End durch die API verarbeitet wird.
# - MVP-04: Verifizieren, dass der Upload-Response einen Qualitätsstatus und Klartext-Gründe enthält.
# - R1-01: Verifizieren, dass die API pro Analyselauf eine nachvollziehbare Smoothing-Trace
#   (Strategie + Parameter + Outlier-Korrektur) im Response zurückliefert.
# - R1-03: Verifizieren, dass football core metrics inkl. quality-gated Struktur im Upload-Response
#   vorhanden sind (coreMetrics + thresholds).

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${API_URL:-http://localhost:8080}"
AUTO_START_API="${AUTO_START_API:-1}"
API_PID=""
API_LOG_FILE="${API_LOG_FILE:-/tmp/football-metrics-e2e-api.log}"

cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_api() {
  for i in {1..40}; do
    if curl -fsS "$API_URL/api/v1/tcx" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  return 1
}

start_api_if_needed() {
  if wait_for_api; then
    echo "Using already running API at $API_URL"
    return 0
  fi

  if [[ "$AUTO_START_API" != "1" ]]; then
    echo "API not reachable at $API_URL and AUTO_START_API is disabled."
    return 1
  fi

  echo "API not reachable at $API_URL. Attempting local API start via dotnet run ..."

  if ! command -v dotnet >/dev/null 2>&1; then
    "$REPO_ROOT/scripts/bootstrap-dotnet.sh"
    export PATH="$HOME/.dotnet:$PATH"
  fi

  local api_hostport="${API_URL#http://}"
  api_hostport="${api_hostport#https://}"
  api_hostport="${api_hostport%%/*}"
  local api_port="${api_hostport##*:}"
  if [[ "$api_port" == "$api_hostport" ]]; then
    api_port="8080"
  fi

  dotnet run --project "$REPO_ROOT/backend/src/FootballMetrics.Api/FootballMetrics.Api.csproj" --urls "http://0.0.0.0:${api_port}" >"$API_LOG_FILE" 2>&1 &
  API_PID="$!"

  if ! wait_for_api; then
    echo "API did not become ready in time. Check logs: $API_LOG_FILE"
    return 1
  fi

  echo "Started local API for smoke test (pid=$API_PID)."
}

start_api_if_needed

cat > /tmp/sample.tcx <<'TCX'
<TrainingCenterDatabase>
  <Activities>
    <Activity>
      <Lap>
        <Track>
          <Trackpoint>
            <Time>2026-02-16T10:00:00Z</Time>
            <Position>
              <LatitudeDegrees>50.0</LatitudeDegrees>
              <LongitudeDegrees>7.0</LongitudeDegrees>
            </Position>
            <HeartRateBpm><Value>120</Value></HeartRateBpm>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-02-16T10:00:01Z</Time>
            <Position>
              <LatitudeDegrees>50.01</LatitudeDegrees>
              <LongitudeDegrees>7.01</LongitudeDegrees>
            </Position>
            <HeartRateBpm><Value>121</Value></HeartRateBpm>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-02-16T10:00:02Z</Time>
            <Position>
              <LatitudeDegrees>50.02</LatitudeDegrees>
              <LongitudeDegrees>7.02</LongitudeDegrees>
            </Position>
            <HeartRateBpm><Value>122</Value></HeartRateBpm>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
TCX

upload_response="$(curl -fsS -X POST "$API_URL/api/v1/tcx/upload" \
  -F "file=@/tmp/sample.tcx;type=application/xml")"

echo "$upload_response" | jq -e '.summary.qualityStatus == "Medium" and (.summary.qualityReasons | length) > 0' >/dev/null

# R1-01/R1-07 validation: smoothing trace exists and includes selected strategy + parameters + outlier count
echo "$upload_response" | jq -e '
  (
    .summary.smoothing.selectedStrategy == "AdaptiveMedian"
    or .summary.smoothing.selectedStrategy == "FootballAdaptiveMedian"
  )
  and ((.summary.smoothing.selectedParameters.EffectiveOutlierSpeedThresholdMps | tonumber) >= 6)
  and ((.summary.smoothing.selectedParameters.EffectiveOutlierSpeedThresholdMps | tonumber) <= 12.5)
  and ((.summary.smoothing.correctedOutlierCount | type) == "number")
' >/dev/null


# R1-03 / R1.5-11 validation: core metrics payload exists and carries threshold keys
# (Smoke: checks structure + representative fields, not full metric correctness)
echo "$upload_response" | jq -e '
  (.summary.coreMetrics | type) == "object"
  and (.summary.coreMetrics.isAvailable | type) == "boolean"
  and (
    (
      (.summary.coreMetrics.thresholds.MaxSpeedMps | tonumber) >= 4
      and (.summary.coreMetrics.thresholds.MaxHeartRateBpm | tonumber) >= 120
      and (.summary.coreMetrics.thresholds.SprintSpeedPercentOfMaxSpeed | tonumber) >= 70
      and (.summary.coreMetrics.thresholds.HighIntensitySpeedPercentOfMaxSpeed | tonumber) >= 40
      and ((.summary.coreMetrics.thresholds.SprintSpeedThresholdMps | tonumber) >= (.summary.coreMetrics.thresholds.HighIntensitySpeedThresholdMps | tonumber))
    )
    or
    (
      # backward-compatible fallback for older threshold schema
      ((.summary.coreMetrics.thresholds.SprintSpeedThresholdMps | tonumber) == 7)
      and ((.summary.coreMetrics.thresholds.HighIntensitySpeedThresholdMps | tonumber) == 5.5)
    )
  )
  and ((.summary.coreMetrics.thresholds.AccelerationThresholdMps2 | tonumber) == 2)
  and ((.summary.coreMetrics.thresholds.DecelerationThresholdMps2 | tonumber) == -2)
' >/dev/null
curl -fsS "$API_URL/api/v1/tcx" | jq 'length >= 1' | grep true

echo "E2E smoke test passed"
