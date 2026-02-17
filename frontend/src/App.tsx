import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type SmoothingTrace = {
  selectedStrategy: string;
  selectedParameters: Record<string, string>;
  rawDistanceMeters: number | null;
  smoothedDistanceMeters: number | null;
  rawDirectionChanges: number;
  baselineDirectionChanges: number;
  smoothedDirectionChanges: number;
  correctedOutlierCount: number;
  analyzedAtUtc: string;
};

type MetricAvailability = {
  state: 'Available' | 'NotMeasured' | 'NotUsable';
  reason: string | null;
};

type FootballCoreMetrics = {
  isAvailable: boolean;
  unavailableReason: string | null;
  distanceMeters: number | null;
  sprintDistanceMeters: number | null;
  sprintCount: number | null;
  maxSpeedMetersPerSecond: number | null;
  highIntensityTimeSeconds: number | null;
  highSpeedDistanceMeters: number | null;
  runningDensityMetersPerMinute: number | null;
  accelerationCount: number | null;
  decelerationCount: number | null;
  heartRateZoneLowSeconds: number | null;
  heartRateZoneMediumSeconds: number | null;
  heartRateZoneHighSeconds: number | null;
  trainingImpulseEdwards: number | null;
  heartRateRecoveryAfter60Seconds: number | null;
  metricAvailability: Record<string, MetricAvailability>;
  thresholds: Record<string, string>;
};

type ActivitySummary = {
  activityStartTimeUtc: string | null;
  durationSeconds: number | null;
  trackpointCount: number;
  heartRateMinBpm: number | null;
  heartRateAverageBpm: number | null;
  heartRateMaxBpm: number | null;
  distanceMeters: number | null;
  hasGpsData: boolean;
  fileDistanceMeters: number | null;
  distanceSource: 'CalculatedFromGps' | 'ProvidedByFile' | 'NotAvailable';
  qualityStatus: 'High' | 'Medium' | 'Low';
  qualityReasons: string[];
  smoothing: SmoothingTrace;
  coreMetrics: FootballCoreMetrics;
};

type UploadRecord = {
  id: string;
  fileName: string;
  uploadedAtUtc: string;
  summary: ActivitySummary;
};

type Locale = 'en' | 'de';
type SortDirection = 'desc' | 'asc';
type CompareMode = 'raw' | 'smoothed';

type TranslationKey =
  | 'title'
  | 'subtitle'
  | 'maxFileSize'
  | 'dropzoneText'
  | 'fileInputAriaLabel'
  | 'uploadButton'
  | 'defaultMessage'
  | 'readyMessage'
  | 'uploadFailedPrefix'
  | 'uploadSuccess'
  | 'invalidExtension'
  | 'invalidSize'
  | 'languageLabel'
  | 'languageEnglish'
  | 'languageGerman'
  | 'uploadInProgress'
  | 'summaryTitle'
  | 'metricStartTime'
  | 'metricDuration'
  | 'metricHeartRate'
  | 'metricTrackpoints'
  | 'metricDistance'
  | 'metricGps'
  | 'notAvailable'
  | 'yes'
  | 'no'
  | 'distanceSourceCalculated'
  | 'distanceSourceProvided'
  | 'distanceSourceNotAvailable'
  | 'metricHelpStartTime'
  | 'metricHelpDuration'
  | 'metricHelpHeartRate'
  | 'metricHelpTrackpoints'
  | 'metricHelpDistance'
  | 'metricHelpGps'
  | 'metricQualityStatus'
  | 'metricQualityReasons'
  | 'metricSmoothingStrategy'
  | 'metricSmoothingOutlier'
  | 'compareTitle'
  | 'compareModeLabel'
  | 'compareModeRaw'
  | 'compareModeSmoothed'
  | 'compareDisabledNoGps'
  | 'metricDirectionChanges'
  | 'metricDataChange'
  | 'metricDataChangeHelp'
  | 'qualityStatusHigh'
  | 'qualityStatusMedium'
  | 'qualityStatusLow'
  | 'historyTitle'
  | 'historyEmpty'
  | 'historyColumnFileName'
  | 'historyColumnUploadTime'
  | 'historyColumnActivityTime'
  | 'historyColumnQuality'
  | 'historySortLabel'
  | 'historySortNewest'
  | 'historySortOldest'
  | 'historyOpenDetails'
  | 'detailMissingHeartRateHint'
  | 'detailMissingDistanceHint'
  | 'detailMissingGpsHint'
  | 'coreMetricsTitle'
  | 'coreMetricsUnavailable'
  | 'metricStateNotMeasured'
  | 'metricStateNotUsable'
  | 'metricSprintDistance'
  | 'metricSprintCount'
  | 'metricMaxSpeed'
  | 'metricHighIntensityTime'
  | 'metricCoreThresholds'
  | 'metricHighSpeedDistance'
  | 'metricRunningDensity'
  | 'metricAccelerationCount'
  | 'metricDecelerationCount'
  | 'metricHrZoneLow'
  | 'metricHrZoneMedium'
  | 'metricHrZoneHigh'
  | 'metricTrimpEdwards'
  | 'metricHrRecovery60';

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').trim();
const apiBaseUrl = configuredApiBaseUrl.endsWith('/api') ? configuredApiBaseUrl : `${configuredApiBaseUrl}/api`;
const maxFileSizeInBytes = 20 * 1024 * 1024;

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    title: 'Football Metrics – TCX Upload',
    subtitle: 'Manual upload for amateur football metrics.',
    maxFileSize: 'Maximum file size: 20 MB.',
    dropzoneText: 'Drag & drop a TCX file here or choose one.',
    fileInputAriaLabel: 'Select TCX file',
    uploadButton: 'Upload',
    defaultMessage: 'No file uploaded yet.',
    readyMessage: 'Ready to upload: {fileName}.',
    uploadFailedPrefix: 'Upload failed:',
    uploadSuccess: 'Upload successful: {fileName} at {uploadTime}.',
    invalidExtension: 'Only .tcx files are allowed.',
    invalidSize: 'File is too large (max 20 MB).',
    languageLabel: 'Language',
    languageEnglish: 'English',
    languageGerman: 'German',
    uploadInProgress: 'Upload in progress...',
    summaryTitle: 'Session details',
    metricStartTime: 'Start time',
    metricDuration: 'Duration',
    metricHeartRate: 'Heart rate (min/avg/max)',
    metricTrackpoints: 'Trackpoints',
    metricDistance: 'Distance',
    metricGps: 'GPS data available',
    notAvailable: 'Not available',
    yes: 'Yes',
    no: 'No',
    distanceSourceCalculated: 'calculated from GPS',
    distanceSourceProvided: 'from TCX file',
    distanceSourceNotAvailable: 'not available',
    metricHelpStartTime: 'Local device time.',
    metricHelpDuration: 'Shown in minutes and seconds.',
    metricHelpHeartRate: 'Unit: bpm.',
    metricHelpTrackpoints: 'Number of recorded points.',
    metricHelpDistance: 'Unit: km. Prefer GPS calculation.',
    metricHelpGps: 'Indicates if coordinate points exist.',
    metricQualityStatus: 'Data quality',
    metricQualityReasons: 'Quality reasons',
    metricSmoothingStrategy: 'Smoothing strategy',
    metricSmoothingOutlier: 'Outlier detection',
    compareTitle: 'Raw vs. smoothed comparison',
    compareModeLabel: 'Display mode',
    compareModeRaw: 'Raw data',
    compareModeSmoothed: 'Smoothed data',
    compareDisabledNoGps: 'Comparison is disabled because this session does not contain GPS coordinates.',
    metricDirectionChanges: 'Direction changes',
    metricDataChange: 'Data change due to smoothing',
    metricDataChangeHelp: '{correctedShare}% corrected points ({correctedPoints}/{trackpoints}), distance delta {distanceDelta}',
    qualityStatusHigh: 'high',
    qualityStatusMedium: 'medium',
    qualityStatusLow: 'low',
    historyTitle: 'Upload history',
    historyEmpty: 'No uploaded sessions yet.',
    historyColumnFileName: 'File name',
    historyColumnUploadTime: 'Upload time',
    historyColumnActivityTime: 'Activity time',
    historyColumnQuality: 'Quality status',
    historySortLabel: 'Sort by upload time',
    historySortNewest: 'Newest first',
    historySortOldest: 'Oldest first',
    historyOpenDetails: 'Open details',
    detailMissingHeartRateHint: 'Heart-rate values are missing in this session. The metric is intentionally shown as not available.',
    detailMissingDistanceHint: 'Distance cannot be calculated because GPS points are missing. No fallback chart is rendered.',
    detailMissingGpsHint: 'No GPS coordinates were detected in this file.',
    coreMetricsTitle: 'Football core metrics (v1)',
    coreMetricsUnavailable: 'Core metrics unavailable: {reason}',
    metricStateNotMeasured: 'Not measured',
    metricStateNotUsable: 'Measurement unusable',
    metricSprintDistance: 'Sprint distance',
    metricSprintCount: 'Sprint count',
    metricMaxSpeed: 'Maximum speed',
    metricHighIntensityTime: 'High-intensity time',
    metricCoreThresholds: 'Thresholds',
    metricHighSpeedDistance: 'High-speed distance',
    metricRunningDensity: 'Running density (m/min)',
    metricAccelerationCount: 'Accelerations',
    metricDecelerationCount: 'Decelerations',
    metricHrZoneLow: 'HR zone <70%',
    metricHrZoneMedium: 'HR zone 70-85%',
    metricHrZoneHigh: 'HR zone >85%',
    metricTrimpEdwards: 'TRIMP (Edwards)',
    metricHrRecovery60: 'HR recovery after 60s' 
  },
  de: {
    title: 'Football Metrics – TCX Upload',
    subtitle: 'Manueller Upload für Amateur-Fußballmetriken.',
    maxFileSize: 'Maximale Dateigröße: 20 MB.',
    dropzoneText: 'Ziehe eine TCX-Datei hierher oder wähle eine aus.',
    fileInputAriaLabel: 'TCX-Datei auswählen',
    uploadButton: 'Hochladen',
    defaultMessage: 'Noch keine Datei hochgeladen.',
    readyMessage: 'Bereit zum Hochladen: {fileName}.',
    uploadFailedPrefix: 'Upload fehlgeschlagen:',
    uploadSuccess: 'Upload erfolgreich: {fileName} um {uploadTime}.',
    invalidExtension: 'Nur .tcx-Dateien sind erlaubt.',
    invalidSize: 'Datei ist zu groß (max. 20 MB).',
    languageLabel: 'Sprache',
    languageEnglish: 'Englisch',
    languageGerman: 'Deutsch',
    uploadInProgress: 'Upload läuft...',
    summaryTitle: 'Session-Details',
    metricStartTime: 'Startzeit',
    metricDuration: 'Dauer',
    metricHeartRate: 'Herzfrequenz (min/avg/max)',
    metricTrackpoints: 'Trackpunkte',
    metricDistance: 'Distanz',
    metricGps: 'GPS-Daten vorhanden',
    notAvailable: 'Nicht vorhanden',
    yes: 'Ja',
    no: 'Nein',
    distanceSourceCalculated: 'aus GPS berechnet',
    distanceSourceProvided: 'aus TCX-Datei',
    distanceSourceNotAvailable: 'nicht vorhanden',
    metricHelpStartTime: 'Lokale Gerätezeit.',
    metricHelpDuration: 'Anzeige in Minuten und Sekunden.',
    metricHelpHeartRate: 'Einheit: bpm.',
    metricHelpTrackpoints: 'Anzahl erfasster Punkte.',
    metricHelpDistance: 'Einheit: km. GPS-Berechnung wird bevorzugt.',
    metricHelpGps: 'Zeigt, ob Koordinatenpunkte vorhanden sind.',
    metricQualityStatus: 'Datenqualität',
    metricQualityReasons: 'Qualitätsgründe',
    metricSmoothingStrategy: 'Glättungsstrategie',
    metricSmoothingOutlier: 'Ausreißer-Erkennung',
    compareTitle: 'Vergleich Rohdaten vs. geglättet',
    compareModeLabel: 'Darstellungsmodus',
    compareModeRaw: 'Rohdaten',
    compareModeSmoothed: 'Geglättet',
    compareDisabledNoGps: 'Der Vergleich ist deaktiviert, weil diese Session keine GPS-Koordinaten enthält.',
    metricDirectionChanges: 'Richtungswechsel',
    metricDataChange: 'Datenänderung durch Glättung',
    metricDataChangeHelp: '{correctedShare}% korrigierte Punkte ({correctedPoints}/{trackpoints}), Distanzabweichung {distanceDelta}',
    qualityStatusHigh: 'hoch',
    qualityStatusMedium: 'mittel',
    qualityStatusLow: 'niedrig',
    historyTitle: 'Upload-Historie',
    historyEmpty: 'Noch keine hochgeladenen Sessions.',
    historyColumnFileName: 'Dateiname',
    historyColumnUploadTime: 'Upload-Zeit',
    historyColumnActivityTime: 'Aktivitätszeit',
    historyColumnQuality: 'Qualitätsstatus',
    historySortLabel: 'Nach Upload-Zeit sortieren',
    historySortNewest: 'Neueste zuerst',
    historySortOldest: 'Älteste zuerst',
    historyOpenDetails: 'Details öffnen',
    detailMissingHeartRateHint: 'In dieser Session fehlen Herzfrequenzwerte. Die Metrik wird bewusst als nicht vorhanden angezeigt.',
    detailMissingDistanceHint: 'Die Distanz kann nicht berechnet werden, weil GPS-Punkte fehlen. Es wird kein Platzhalterdiagramm angezeigt.',
    detailMissingGpsHint: 'In dieser Datei wurden keine GPS-Koordinaten erkannt.',
    coreMetricsTitle: 'Fußball-Kernmetriken (v1)',
    coreMetricsUnavailable: 'Kernmetriken nicht verfügbar: {reason}',
    metricStateNotMeasured: 'Nicht gemessen',
    metricStateNotUsable: 'Messung unbrauchbar',
    metricSprintDistance: 'Sprintdistanz',
    metricSprintCount: 'Anzahl Sprints',
    metricMaxSpeed: 'Maximalgeschwindigkeit',
    metricHighIntensityTime: 'Hochintensitätszeit',
    metricCoreThresholds: 'Schwellenwerte',
    metricHighSpeedDistance: 'Hochintensive Laufdistanz',
    metricRunningDensity: 'Laufdichte (m/min)',
    metricAccelerationCount: 'Beschleunigungen',
    metricDecelerationCount: 'Abbremsungen',
    metricHrZoneLow: 'HF-Zone <70%',
    metricHrZoneMedium: 'HF-Zone 70-85%',
    metricHrZoneHigh: 'HF-Zone >85%',
    metricTrimpEdwards: 'TRIMP (Edwards)',
    metricHrRecovery60: 'HF-Erholung nach 60s'
  }
};

const metricExplanations: Record<Locale, Record<string, string>> = {
  en: {
    startTime: 'Purpose: anchors session timing. Interpretation: reference timestamp for all values. Unit: local date/time.',
    duration: 'Purpose: shows total load window. Interpretation: longer sessions can increase accumulated load. Unit: minutes and seconds.',
    heartRate: 'Purpose: summarizes cardiovascular intensity. Interpretation: higher avg/max indicates stronger effort. Unit: bpm.',
    trackpoints: 'Purpose: indicates sampling density. Interpretation: more points usually support more stable calculations. Unit: count.',
    distance: 'Purpose: quantifies covered ground. Interpretation: higher value means more movement volume. Unit: km and m.',
    gps: 'Purpose: indicates if location-based metrics can be computed. Interpretation: without GPS, running/sprint metrics can be unavailable. Unit: yes/no.',
    qualityStatus: 'Purpose: summarizes data reliability. Interpretation: high quality means stronger confidence in metrics. Unit: categorical status.',
    qualityReasons: 'Purpose: explains quality drivers. Interpretation: reasons clarify why metrics are trustworthy or limited. Unit: text reasons.',
    dataChange: 'Purpose: shows smoothing impact. Interpretation: larger deltas indicate stronger correction of raw data. Unit: percent and meters.',
    smoothingStrategy: 'Purpose: makes preprocessing transparent. Interpretation: selected method influences downstream metric values. Unit: strategy name.',
    smoothingOutlier: 'Purpose: documents outlier handling. Interpretation: threshold/mode defines when points are corrected. Unit: mode and m/s threshold.',
    directionChanges: 'Purpose: captures directional variability. Interpretation: higher value can indicate more stop-and-go movement. Unit: count.',
    sprintDistance: 'Purpose: measures high-speed running volume. Interpretation: higher value means more sprint load. Unit: km and m. Unavailable when GPS quality is insufficient.',
    sprintCount: 'Purpose: counts sprint events. Interpretation: higher value indicates more repeated high-intensity actions. Unit: count. Unavailable when GPS quality is insufficient.',
    maxSpeed: 'Purpose: captures peak running speed. Interpretation: higher value shows top speed reached in session. Unit: m/s. Unavailable when GPS quality is insufficient.',
    highIntensityTime: 'Purpose: tracks time at high movement intensity. Interpretation: more time means larger intense workload. Unit: minutes and seconds. Unavailable when GPS quality is insufficient.',
    highSpeedDistance: 'Purpose: tracks distance above high-speed threshold. Interpretation: higher value means more sustained fast running. Unit: km and m. Unavailable when GPS quality is insufficient.',
    runningDensity: 'Purpose: normalizes movement volume over time. Interpretation: higher m/min indicates denser running activity. Unit: meters per minute. Unavailable when GPS quality is insufficient.',
    accelerationCount: 'Purpose: counts explosive speed-ups. Interpretation: more accelerations can increase neuromuscular load. Unit: count. Unavailable when GPS quality is insufficient.',
    decelerationCount: 'Purpose: counts braking actions. Interpretation: more decelerations can increase eccentric load. Unit: count. Unavailable when GPS quality is insufficient.',
    hrZoneLow: 'Purpose: tracks low-intensity heart-rate exposure. Interpretation: higher time indicates larger easy-load share. Unit: minutes and seconds. Unavailable when heart-rate quality is insufficient.',
    hrZoneMedium: 'Purpose: tracks moderate-intensity heart-rate exposure. Interpretation: reflects sustained submaximal work. Unit: minutes and seconds. Unavailable when heart-rate quality is insufficient.',
    hrZoneHigh: 'Purpose: tracks high-intensity heart-rate exposure. Interpretation: higher time reflects stronger cardiovascular stress. Unit: minutes and seconds. Unavailable when heart-rate quality is insufficient.',
    trimpEdwards: 'Purpose: estimates internal load from heart-rate zones. Interpretation: higher TRIMP means higher cardio training stress. Unit: score. Unavailable when heart-rate quality is insufficient.',
    hrRecovery60: 'Purpose: indicates short-term recovery capacity. Interpretation: larger drop after effort often indicates better recovery response. Unit: bpm drop after 60s. Unavailable when heart-rate quality is insufficient.',
    coreThresholds: 'Purpose: documents active metric thresholds. Interpretation: values define how speed/intensity events are classified. Unit: parameter values.'
  },
  de: {
    startTime: 'Zweck: zeitliche Einordnung der Session. Interpretation: Referenzzeitpunkt für alle Werte. Einheit: lokales Datum/Uhrzeit.',
    duration: 'Zweck: zeigt das gesamte Belastungsfenster. Interpretation: längere Sessions erhöhen oft die kumulierte Last. Einheit: Minuten und Sekunden.',
    heartRate: 'Zweck: fasst die kardiovaskuläre Intensität zusammen. Interpretation: höhere Ø/Max-Werte stehen meist für höhere Belastung. Einheit: bpm.',
    trackpoints: 'Zweck: zeigt die Datendichte. Interpretation: mehr Punkte ermöglichen meist stabilere Berechnungen. Einheit: Anzahl.',
    distance: 'Zweck: quantifiziert die zurückgelegte Strecke. Interpretation: höherer Wert bedeutet mehr Bewegungsvolumen. Einheit: km und m.',
    gps: 'Zweck: zeigt, ob ortsbasierte Metriken berechenbar sind. Interpretation: ohne GPS können Lauf-/Sprintmetriken fehlen. Einheit: Ja/Nein.',
    qualityStatus: 'Zweck: fasst die Datenzuverlässigkeit zusammen. Interpretation: hohe Qualität bedeutet mehr Vertrauen in die Metriken. Einheit: kategorialer Status.',
    qualityReasons: 'Zweck: erklärt Treiber der Datenqualität. Interpretation: Gründe zeigen, warum Metriken belastbar oder eingeschränkt sind. Einheit: Textgründe.',
    dataChange: 'Zweck: zeigt den Effekt der Glättung. Interpretation: größere Abweichungen bedeuten stärkere Korrektur der Rohdaten. Einheit: Prozent und Meter.',
    smoothingStrategy: 'Zweck: macht die Vorverarbeitung transparent. Interpretation: die Methode beeinflusst nachgelagerte Metrikwerte. Einheit: Strategiename.',
    smoothingOutlier: 'Zweck: dokumentiert die Ausreißerbehandlung. Interpretation: Modus/Schwelle definieren, wann Punkte korrigiert werden. Einheit: Modus und m/s-Schwelle.',
    directionChanges: 'Zweck: erfasst Richtungsvariabilität. Interpretation: höhere Werte können mehr Stop-and-Go anzeigen. Einheit: Anzahl.',
    sprintDistance: 'Zweck: misst hochintensives Laufvolumen. Interpretation: höherer Wert bedeutet mehr Sprintbelastung. Einheit: km und m. Nicht verfügbar bei unzureichender GPS-Qualität.',
    sprintCount: 'Zweck: zählt Sprintaktionen. Interpretation: höherer Wert steht für mehr wiederholte Hochintensitätsaktionen. Einheit: Anzahl. Nicht verfügbar bei unzureichender GPS-Qualität.',
    maxSpeed: 'Zweck: erfasst die Spitzengeschwindigkeit. Interpretation: höherer Wert zeigt das erreichte Toptempo. Einheit: m/s. Nicht verfügbar bei unzureichender GPS-Qualität.',
    highIntensityTime: 'Zweck: misst Zeit in hoher Bewegungsintensität. Interpretation: mehr Zeit bedeutet höhere intensive Arbeitslast. Einheit: Minuten und Sekunden. Nicht verfügbar bei unzureichender GPS-Qualität.',
    highSpeedDistance: 'Zweck: misst Distanz oberhalb der High-Speed-Schwelle. Interpretation: höherer Wert bedeutet mehr anhaltend schnelles Laufen. Einheit: km und m. Nicht verfügbar bei unzureichender GPS-Qualität.',
    runningDensity: 'Zweck: normiert Bewegungsvolumen über die Zeit. Interpretation: höhere m/min bedeuten dichtere Laufaktivität. Einheit: Meter pro Minute. Nicht verfügbar bei unzureichender GPS-Qualität.',
    accelerationCount: 'Zweck: zählt explosive Beschleunigungen. Interpretation: mehr Beschleunigungen erhöhen oft die neuromuskuläre Last. Einheit: Anzahl. Nicht verfügbar bei unzureichender GPS-Qualität.',
    decelerationCount: 'Zweck: zählt Bremsaktionen. Interpretation: mehr Abbremsungen erhöhen oft die exzentrische Last. Einheit: Anzahl. Nicht verfügbar bei unzureichender GPS-Qualität.',
    hrZoneLow: 'Zweck: misst HF-Exposition in niedriger Intensität. Interpretation: mehr Zeit bedeutet höheren Anteil lockerer Belastung. Einheit: Minuten und Sekunden. Nicht verfügbar bei unzureichender HF-Qualität.',
    hrZoneMedium: 'Zweck: misst HF-Exposition in mittlerer Intensität. Interpretation: zeigt den Anteil dauerhaft submaximaler Arbeit. Einheit: Minuten und Sekunden. Nicht verfügbar bei unzureichender HF-Qualität.',
    hrZoneHigh: 'Zweck: misst HF-Exposition in hoher Intensität. Interpretation: mehr Zeit steht für stärkeren kardiovaskulären Stress. Einheit: Minuten und Sekunden. Nicht verfügbar bei unzureichender HF-Qualität.',
    trimpEdwards: 'Zweck: schätzt die interne Belastung über HF-Zonen. Interpretation: höherer TRIMP bedeutet höheren kardialen Trainingsstress. Einheit: Score. Nicht verfügbar bei unzureichender HF-Qualität.',
    hrRecovery60: 'Zweck: zeigt kurzfristige Erholungsfähigkeit. Interpretation: größerer Pulsabfall nach Belastung spricht oft für bessere Erholung. Einheit: bpm-Abfall nach 60 s. Nicht verfügbar bei unzureichender HF-Qualität.',
    coreThresholds: 'Zweck: dokumentiert aktive Metrik-Schwellenwerte. Interpretation: Werte definieren die Klassifikation von Tempo-/Intensitätsereignissen. Einheit: Parameterwerte.'
  }
};



type MetricListItemProps = {
  label: string;
  value: string | number;
  helpText: string;
};

function MetricListItem({ label, value, helpText }: MetricListItemProps) {
  return (
    <li>
      <strong>{label}:</strong> {value} <span className="metric-help" role="note" aria-label={`${label} explanation`} title={helpText}>ⓘ</span>
    </li>
  );
}

function resolveInitialLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function formatLocalDateTime(dateText: string): string {
  return new Date(dateText).toLocaleString();
}

function formatDuration(durationSeconds: number | null, locale: Locale, notAvailable: string): string {
  if (durationSeconds === null) {
    return notAvailable;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return locale === 'de' ? `${minutes} min ${seconds} s` : `${minutes} min ${seconds} s`;
}

function formatDistance(distanceMeters: number | null, locale: Locale, notAvailable: string): string {
  if (distanceMeters === null) {
    return notAvailable;
  }

  return `${(distanceMeters / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} km`;
}

function formatDistanceComparison(distanceMeters: number | null, locale: Locale, notAvailable: string): string {
  if (distanceMeters === null) {
    return notAvailable;
  }

  return `${(distanceMeters / 1000).toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km (${distanceMeters.toLocaleString(locale, { maximumFractionDigits: 1 })} m)`;
}


function formatDistanceDeltaMeters(distanceDeltaMeters: number | null, locale: Locale, notAvailable: string): string {
  if (distanceDeltaMeters === null) {
    return notAvailable;
  }

  if (distanceDeltaMeters > 0 && distanceDeltaMeters < 0.001) {
    return '< 0.001 m';
  }

  return `${distanceDeltaMeters.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m`;
}

function formatHeartRate(summary: ActivitySummary, notAvailable: string): string {
  if (summary.heartRateMinBpm === null || summary.heartRateAverageBpm === null || summary.heartRateMaxBpm === null) {
    return notAvailable;
  }

  return `${summary.heartRateMinBpm}/${summary.heartRateAverageBpm}/${summary.heartRateMaxBpm} bpm`;
}

function hasCompleteHeartRate(summary: ActivitySummary): boolean {
  return summary.heartRateMinBpm !== null && summary.heartRateAverageBpm !== null && summary.heartRateMaxBpm !== null;
}

function formatSpeedMetersPerSecond(value: number | null, notAvailableText: string): string {
  if (value === null) {
    return notAvailableText;
  }

  return `${value.toFixed(2)} m/s`;
}


function formatNumber(value: number | null, locale: Locale, notAvailable: string, digits = 1): string {
  if (value === null) {
    return notAvailable;
  }

  return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatThresholds(thresholds: Record<string, string>): string {
  return Object.entries(thresholds)
    .map(([key, value]) => `${key}=${value}`)
    .join(' | ');
}

function formatMetricStatus(metricKey: string, coreMetrics: FootballCoreMetrics, t: Record<TranslationKey, string>): string | null {
  const status = coreMetrics.metricAvailability?.[metricKey];
  if (!status || status.state === 'Available') {
    return null;
  }

  const label = status.state === 'NotMeasured' ? t.metricStateNotMeasured : t.metricStateNotUsable;
  return status.reason ? `${label}: ${status.reason}` : label;
}

function qualityStatusText(status: ActivitySummary['qualityStatus'], t: Record<TranslationKey, string>): string {
  switch (status) {
    case 'High':
      return t.qualityStatusHigh;
    case 'Medium':
      return t.qualityStatusMedium;
    default:
      return t.qualityStatusLow;
  }
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

function getFileValidationMessage(file: File | null, locale: Locale): string | null {
  if (!file) {
    return null;
  }

  if (!file.name.toLowerCase().endsWith('.tcx')) {
    return translations[locale].invalidExtension;
  }

  if (file.size > maxFileSizeInBytes) {
    return translations[locale].invalidSize;
  }

  return null;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSession, setSelectedSession] = useState<UploadRecord | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [message, setMessage] = useState<string>(translations[resolveInitialLocale()].defaultMessage);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>('smoothed');

  const t = translations[locale];
  const metricHelp = metricExplanations[locale];
  const validationMessage = useMemo(() => getFileValidationMessage(selectedFile, locale), [selectedFile, locale]);
  const canSubmit = useMemo(
    () => !!selectedFile && !validationMessage && !isUploading,
    [selectedFile, validationMessage, isUploading]
  );

  const sortedHistory = useMemo(() => {
    const directionFactor = sortDirection === 'desc' ? -1 : 1;
    return [...uploadHistory].sort((a, b) => {
      const aTime = new Date(a.uploadedAtUtc).getTime();
      const bTime = new Date(b.uploadedAtUtc).getTime();
      return (aTime - bTime) * directionFactor;
    });
  }, [uploadHistory, sortDirection]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const response = await fetch(`${apiBaseUrl}/tcx`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as UploadRecord[];
        if (!cancelled) {
          setUploadHistory(payload);
          if (payload.length > 0) {
            setSelectedSession(payload[0]);
          }
        }
      } catch {
        // Intentionally ignore: upload still works and user gets feedback on action.
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  function onLocaleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    setLocale(nextLocale);
    setMessage(translations[nextLocale].defaultMessage);
  }

  function handleFileSelection(file: File | null) {
    if (isUploading) {
      return;
    }

    setSelectedFile(file);

    const fileError = getFileValidationMessage(file, locale);
    if (fileError) {
      setMessage(fileError);
      return;
    }

    if (file) {
      setMessage(interpolate(t.readyMessage, { fileName: file.name }));
    }
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelection(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);

    if (isUploading) {
      return;
    }

    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    handleFileSelection(droppedFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || validationMessage || isUploading) {
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploading(true);
    setMessage(t.uploadInProgress);

    try {
      const response = await fetch(`${apiBaseUrl}/tcx/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessage(`${t.uploadFailedPrefix} ${errorText}`);
        return;
      }

      const payload = (await response.json()) as UploadRecord;
      const uploadTime = formatLocalDateTime(payload.uploadedAtUtc);
      setMessage(interpolate(t.uploadSuccess, { fileName: payload.fileName, uploadTime }));
      setSelectedSession(payload);
      setCompareMode('smoothed');
      setUploadHistory((previous) => [payload, ...previous.filter((item) => item.id !== payload.id)]);
      setSelectedFile(null);
    } catch {
      setMessage(`${t.uploadFailedPrefix} Network error.`);
    } finally {
      setIsUploading(false);
    }
  }

  const distanceSourceText = (source: ActivitySummary['distanceSource']) => {
    switch (source) {
      case 'CalculatedFromGps':
        return t.distanceSourceCalculated;
      case 'ProvidedByFile':
        return t.distanceSourceProvided;
      default:
        return t.distanceSourceNotAvailable;
    }
  };

  const showMissingHeartRateHint = selectedSession ? !hasCompleteHeartRate(selectedSession.summary) : false;
  const showMissingDistanceHint = selectedSession ? selectedSession.summary.distanceMeters === null : false;
  const showMissingGpsHint = selectedSession ? !selectedSession.summary.hasGpsData : false;

  const activeDistanceMeters = selectedSession
    ? compareMode === 'raw'
      ? selectedSession.summary.smoothing.rawDistanceMeters
      : selectedSession.summary.smoothing.smoothedDistanceMeters ?? selectedSession.summary.distanceMeters
    : null;

  const activeDirectionChanges = selectedSession
    ? compareMode === 'raw'
      ? selectedSession.summary.smoothing.rawDirectionChanges
      : selectedSession.summary.smoothing.smoothedDirectionChanges
    : null;

  const dataChangeMetric = selectedSession
    ? (() => {
      const correctedShare = selectedSession.summary.trackpointCount > 0
        ? ((selectedSession.summary.smoothing.correctedOutlierCount / selectedSession.summary.trackpointCount) * 100).toFixed(1)
        : '0.0';
      const distanceDeltaMeters =
        selectedSession.summary.smoothing.rawDistanceMeters !== null && selectedSession.summary.smoothing.smoothedDistanceMeters !== null
          ? Math.abs(selectedSession.summary.smoothing.smoothedDistanceMeters - selectedSession.summary.smoothing.rawDistanceMeters)
          : null;
      const distanceDelta = distanceDeltaMeters === null
        ? t.notAvailable
        : formatDistanceDeltaMeters(distanceDeltaMeters, locale, t.notAvailable);

      return interpolate(t.metricDataChangeHelp, {
        correctedShare,
        correctedPoints: String(selectedSession.summary.smoothing.correctedOutlierCount),
        trackpoints: String(selectedSession.summary.trackpointCount),
        distanceDelta
      });
    })()
    : '';

  return (
    <main className="container">
      <div className="language-switcher">
        <label htmlFor="language-selector">{t.languageLabel}</label>
        <select id="language-selector" value={locale} onChange={onLocaleChange}>
          <option value="en">{t.languageEnglish}</option>
          <option value="de">{t.languageGerman}</option>
        </select>
      </div>
      <h1>{t.title}</h1>
      <p className="subtitle">{t.subtitle}</p>
      <p className="subtitle">{t.maxFileSize}</p>
      <form onSubmit={handleSubmit}>
        <label
          className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
        >
          <span>{t.dropzoneText}</span>
          <input type="file" accept=".tcx" onChange={onFileInputChange} aria-label={t.fileInputAriaLabel} disabled={isUploading} />
        </label>
        <button type="submit" disabled={!canSubmit}>
          {t.uploadButton}
        </button>
      </form>
      <p>{validationMessage ?? message}</p>

      <section>
        <h2>{t.historyTitle}</h2>
        <div className="history-controls">
          <label htmlFor="history-sort-selector">{t.historySortLabel}</label>
          <select id="history-sort-selector" value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}>
            <option value="desc">{t.historySortNewest}</option>
            <option value="asc">{t.historySortOldest}</option>
          </select>
        </div>

        {sortedHistory.length === 0 ? (
          <p>{t.historyEmpty}</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>{t.historyColumnFileName}</th>
                <th>{t.historyColumnUploadTime}</th>
                <th>{t.historyColumnActivityTime}</th>
                <th>{t.historyColumnQuality}</th>
                <th>{t.historyOpenDetails}</th>
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((record) => (
                <tr key={record.id}>
                  <td>{record.fileName}</td>
                  <td>{formatLocalDateTime(record.uploadedAtUtc)}</td>
                  <td>{record.summary.activityStartTimeUtc ? formatLocalDateTime(record.summary.activityStartTimeUtc) : t.notAvailable}</td>
                  <td>{qualityStatusText(record.summary.qualityStatus, t)}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setSelectedSession(record);
                        setCompareMode('smoothed');
                      }}
                    >
                      {t.historyOpenDetails}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selectedSession && (
        <section className="session-details" aria-live="polite">
          <h2>{t.summaryTitle}</h2>
          <p><strong>{t.historyColumnFileName}:</strong> {selectedSession.fileName}</p>
          <div className="comparison-controls">
            <h3>{t.compareTitle}</h3>
            <label htmlFor="comparison-mode-selector">{t.compareModeLabel}</label>
            <select
              id="comparison-mode-selector"
              value={compareMode}
              disabled={!selectedSession.summary.hasGpsData}
              onChange={(event) => setCompareMode(event.target.value as CompareMode)}
            >
              <option value="raw">{t.compareModeRaw}</option>
              <option value="smoothed">{t.compareModeSmoothed}</option>
            </select>
            {!selectedSession.summary.hasGpsData && <p className="comparison-disabled-hint">{t.compareDisabledNoGps}</p>}
          </div>
          <ul className="metrics-list">
            <MetricListItem label={t.metricStartTime} value={selectedSession.summary.activityStartTimeUtc ? formatLocalDateTime(selectedSession.summary.activityStartTimeUtc) : t.notAvailable} helpText={`${metricHelp.startTime} ${t.metricHelpStartTime}`} />
            <MetricListItem label={t.metricDuration} value={formatDuration(selectedSession.summary.durationSeconds, locale, t.notAvailable)} helpText={`${metricHelp.duration} ${t.metricHelpDuration}`} />
            <MetricListItem label={t.metricHeartRate} value={formatHeartRate(selectedSession.summary, t.notAvailable)} helpText={`${metricHelp.heartRate} ${t.metricHelpHeartRate}`} />
            <MetricListItem label={t.metricTrackpoints} value={selectedSession.summary.trackpointCount} helpText={`${metricHelp.trackpoints} ${t.metricHelpTrackpoints}`} />
            <MetricListItem label={t.metricDistance} value={`${formatDistanceComparison(activeDistanceMeters, locale, t.notAvailable)} — ${distanceSourceText(selectedSession.summary.distanceSource)}`} helpText={`${metricHelp.distance} ${t.metricHelpDistance}`} />
            <MetricListItem label={t.metricDirectionChanges} value={activeDirectionChanges ?? 0} helpText={metricHelp.directionChanges} />
            <MetricListItem label={t.metricGps} value={selectedSession.summary.hasGpsData ? t.yes : t.no} helpText={`${metricHelp.gps} ${t.metricHelpGps}`} />
            <MetricListItem label={t.metricQualityStatus} value={qualityStatusText(selectedSession.summary.qualityStatus, t)} helpText={metricHelp.qualityStatus} />
            <MetricListItem label={t.metricQualityReasons} value={selectedSession.summary.qualityReasons.join(' | ')} helpText={metricHelp.qualityReasons} />
            <MetricListItem label={t.metricDataChange} value={dataChangeMetric} helpText={metricHelp.dataChange} />
            <MetricListItem label={t.metricSmoothingStrategy} value={selectedSession.summary.smoothing.selectedStrategy} helpText={metricHelp.smoothingStrategy} />
            <MetricListItem label={t.metricSmoothingOutlier} value={`${selectedSession.summary.smoothing.selectedParameters.OutlierDetectionMode ?? 'NotAvailable'} (threshold: ${selectedSession.summary.smoothing.selectedParameters.EffectiveOutlierSpeedThresholdMps ?? '12.5'} m/s)`} helpText={metricHelp.smoothingOutlier} />
          </ul>
          <div className="core-metrics-section">
            <h3>{t.coreMetricsTitle}</h3>
            {!selectedSession.summary.coreMetrics.isAvailable && (
              <p>{t.coreMetricsUnavailable.replace('{reason}', selectedSession.summary.coreMetrics.unavailableReason ?? t.notAvailable)}</p>
            )}
            <ul className="metrics-list">
              <MetricListItem label={t.metricDistance} value={`${formatDistanceComparison(selectedSession.summary.coreMetrics.distanceMeters, locale, t.notAvailable)}${(() => { const status = formatMetricStatus('distanceMeters', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.distance} />
              <MetricListItem label={t.metricSprintDistance} value={`${formatDistanceComparison(selectedSession.summary.coreMetrics.sprintDistanceMeters, locale, t.notAvailable)}${(() => { const status = formatMetricStatus('sprintDistanceMeters', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.sprintDistance} />
              <MetricListItem label={t.metricSprintCount} value={`${selectedSession.summary.coreMetrics.sprintCount ?? t.notAvailable}${(() => { const status = formatMetricStatus('sprintCount', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.sprintCount} />
              <MetricListItem label={t.metricMaxSpeed} value={`${formatSpeedMetersPerSecond(selectedSession.summary.coreMetrics.maxSpeedMetersPerSecond, t.notAvailable)}${(() => { const status = formatMetricStatus('maxSpeedMetersPerSecond', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.maxSpeed} />
              <MetricListItem label={t.metricHighIntensityTime} value={`${formatDuration(selectedSession.summary.coreMetrics.highIntensityTimeSeconds, locale, t.notAvailable)}${(() => { const status = formatMetricStatus('highIntensityTimeSeconds', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.highIntensityTime} />
              <MetricListItem label={t.metricHighSpeedDistance} value={`${formatDistanceComparison(selectedSession.summary.coreMetrics.highSpeedDistanceMeters, locale, t.notAvailable)}${(() => { const status = formatMetricStatus('highSpeedDistanceMeters', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.highSpeedDistance} />
              <MetricListItem label={t.metricRunningDensity} value={`${formatNumber(selectedSession.summary.coreMetrics.runningDensityMetersPerMinute, locale, t.notAvailable, 2)}${(() => { const status = formatMetricStatus('runningDensityMetersPerMinute', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.runningDensity} />
              <MetricListItem label={t.metricAccelerationCount} value={`${selectedSession.summary.coreMetrics.accelerationCount ?? t.notAvailable}${(() => { const status = formatMetricStatus('accelerationCount', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.accelerationCount} />
              <MetricListItem label={t.metricDecelerationCount} value={`${selectedSession.summary.coreMetrics.decelerationCount ?? t.notAvailable}${(() => { const status = formatMetricStatus('decelerationCount', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.decelerationCount} />
              <MetricListItem label={t.metricHrZoneLow} value={`${formatDuration(selectedSession.summary.coreMetrics.heartRateZoneLowSeconds, locale, t.notAvailable)}${(() => { const status = formatMetricStatus('heartRateZoneLowSeconds', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.hrZoneLow} />
              <MetricListItem label={t.metricHrZoneMedium} value={`${formatDuration(selectedSession.summary.coreMetrics.heartRateZoneMediumSeconds, locale, t.notAvailable)}${(() => { const status = formatMetricStatus('heartRateZoneMediumSeconds', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.hrZoneMedium} />
              <MetricListItem label={t.metricHrZoneHigh} value={`${formatDuration(selectedSession.summary.coreMetrics.heartRateZoneHighSeconds, locale, t.notAvailable)}${(() => { const status = formatMetricStatus('heartRateZoneHighSeconds', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.hrZoneHigh} />
              <MetricListItem label={t.metricTrimpEdwards} value={`${formatNumber(selectedSession.summary.coreMetrics.trainingImpulseEdwards, locale, t.notAvailable, 1)}${(() => { const status = formatMetricStatus('trainingImpulseEdwards', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.trimpEdwards} />
              <MetricListItem label={t.metricHrRecovery60} value={`${selectedSession.summary.coreMetrics.heartRateRecoveryAfter60Seconds ?? t.notAvailable}${(() => { const status = formatMetricStatus('heartRateRecoveryAfter60Seconds', selectedSession.summary.coreMetrics, t); return status ? ` — ${status}` : ''; })()}`} helpText={metricHelp.hrRecovery60} />
              <MetricListItem label={t.metricCoreThresholds} value={formatThresholds(selectedSession.summary.coreMetrics.thresholds)} helpText={metricHelp.coreThresholds} />
            </ul>
          </div>
          {(showMissingHeartRateHint || showMissingDistanceHint || showMissingGpsHint) && (
            <div className="detail-hints" role="status">
              {showMissingHeartRateHint && <p>{t.detailMissingHeartRateHint}</p>}
              {showMissingDistanceHint && <p>{t.detailMissingDistanceHint}</p>}
              {showMissingGpsHint && <p>{t.detailMissingGpsHint}</p>}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
