# R1-05 – TCX Mapping ins kanonische Activity-Modell

Die Upload-Pipeline nutzt für TCX-Dateien den Adapter `TcxUploadFormatAdapter` und überführt die extrahierten Werte in ein kanonisches Activity-Modell (`CanonicalActivity`).

## Kanonisches Modell

`CanonicalActivity` enthält aktuell die für R1 benötigten Felder:

- `SourceFormat`
- `ActivityStartTimeUtc`
- `DurationSeconds`
- `TrackpointCount`
- `HasGpsData`
- `HeartRateMinBpm`
- `HeartRateAverageBpm`
- `HeartRateMaxBpm`
- `DistanceMeters`
- `QualityStatus`

## TCX -> CanonicalActivity Mapping

| TCX-Quelle / Berechnung | CanonicalActivity-Feld | Hinweis |
|---|---|---|
| Root-Dokument `TrainingCenterDatabase` (validiert) | `SourceFormat = "TCX"` | Adapterkennung für zukünftige Formate |
| `TcxMetricsExtractor.Extract(...).ActivityStartTimeUtc` | `ActivityStartTimeUtc` | Startzeit der Aktivität |
| `TcxMetricsExtractor.Extract(...).DurationSeconds` | `DurationSeconds` | Dauer in Sekunden |
| `TcxMetricsExtractor.Extract(...).TrackpointCount` | `TrackpointCount` | Anzahl Trackpoints |
| `TcxMetricsExtractor.Extract(...).HasGpsData` | `HasGpsData` | GPS vorhanden ja/nein |
| `TcxMetricsExtractor.Extract(...).HeartRateMinBpm` | `HeartRateMinBpm` | optional |
| `TcxMetricsExtractor.Extract(...).HeartRateAverageBpm` | `HeartRateAverageBpm` | optional |
| `TcxMetricsExtractor.Extract(...).HeartRateMaxBpm` | `HeartRateMaxBpm` | optional |
| `TcxMetricsExtractor.Extract(...).DistanceMeters` | `DistanceMeters` | GPS-basiert oder Datei-Distanz gemäß Extraktor |
| `TcxMetricsExtractor.Extract(...).QualityStatus` | `QualityStatus` | `High` / `Medium` / `Low` |

## Erweiterbarkeit

- Weitere Formate (z. B. FIT/GPX) können über zusätzliche `IUploadFormatAdapter`-Implementierungen ergänzt werden.
- Die Controller-Logik bleibt unverändert, solange neue Adapter `UploadParseResult` + `CanonicalActivity` liefern.
