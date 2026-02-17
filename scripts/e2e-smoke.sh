#!/usr/bin/env bash
set -euo pipefail

# Story reference: MVP-02, MVP-04
# Ziel:
# - MVP-02: Verifizieren, dass der Upload-Endpunkt erreichbar ist und ein valider TCX-Upload
#   End-to-End durch die API verarbeitet wird.
# - MVP-04: Verifizieren, dass der Upload-Response einen Qualitätsstatus und Klartext-Gründe enthält.

API_URL="${API_URL:-http://localhost:8080}"

for i in {1..40}; do
  if curl -fsS "$API_URL/api/tcx" >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [[ "$i" -eq 40 ]]; then
    echo "API did not become ready in time"
    exit 1
  fi
done

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

upload_response="$(curl -fsS -X POST "$API_URL/api/tcx/upload" \
  -F "file=@/tmp/sample.tcx;type=application/xml")"

echo "$upload_response" | jq -e '.summary.qualityStatus == "Medium" and (.summary.qualityReasons | length) > 0' >/dev/null
curl -fsS "$API_URL/api/tcx" | jq 'length >= 1' | grep true

echo "E2E smoke test passed"
