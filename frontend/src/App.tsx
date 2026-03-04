import { ChangeEvent, DragEvent, FormEvent, PointerEvent, ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFileValidationMessage as getFileValidationMessageBase } from './utils/fileValidation';
import { formatDistance, formatDistanceComparison, formatDistanceDeltaMeters, formatDuration, formatSecondsMmSs, toDateInputValue } from './utils/formatting';
import { normalizeLocaleTag, resolveInitialLocale } from './utils/locale';
import { convertSpeedFromMetersPerSecond, convertSpeedToMetersPerSecond, convertSpeedToUnitValue, formatBandTriplet, formatBpmDrop, formatDistanceMetersOnly, formatHeartRateAverage, formatNumber, formatSignedNumber, formatSpeed } from './utils/metricsFormatting';
import { translations } from './i18n/translations';
import { HrZoneBar, HrZonesKpiCard, KpiCard, KpiCardComparisonDelta, KpiCardDeltaRow, MetricListItem } from './components/kpi';

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
  state: 'Available' | 'NotMeasured' | 'NotUsable' | 'AvailableWithWarning';
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
  highIntensityRunCount: number | null;
  highSpeedDistanceMeters: number | null;
  runningDensityMetersPerMinute: number | null;
  accelerationCount: number | null;
  decelerationCount: number | null;
  moderateAccelerationCount: number | null;
  highAccelerationCount: number | null;
  veryHighAccelerationCount: number | null;
  moderateDecelerationCount: number | null;
  highDecelerationCount: number | null;
  veryHighDecelerationCount: number | null;
  directionChanges: number | null;
  moderateDirectionChangeCount: number | null;
  highDirectionChangeCount: number | null;
  veryHighDirectionChangeCount: number | null;
  heartRateZoneLowSeconds: number | null;
  heartRateZoneMediumSeconds: number | null;
  heartRateZoneHighSeconds: number | null;
  trainingImpulseEdwards: number | null;
  heartRateRecoveryAfter60Seconds: number | null;
  metricAvailability: Record<string, MetricAvailability>;
  thresholds: Record<string, string>;
};

type IntervalAggregate = {
  windowMinutes: number;
  windowIndex: number;
  windowStartUtc: string;
  windowDurationSeconds: number;
  coreMetrics: FootballCoreMetrics;
};

type GpsTrackpoint = {
  latitude: number;
  longitude: number;
  elapsedSeconds: number | null;
  heartRateBpm?: number | null;
};

type HeartRateSample = {
  elapsedSeconds: number;
  heartRateBpm: number;
};

type DataAvailability = {
  mode: 'Dual' | 'HeartRateOnly' | 'GpsOnly' | 'NotAvailable';
  gpsStatus: 'Available' | 'NotMeasured' | 'NotUsable' | 'AvailableWithWarning';
  gpsReason: string | null;
  heartRateStatus: 'Available' | 'NotMeasured' | 'NotUsable' | 'AvailableWithWarning';
  heartRateReason: string | null;
  gpsQualityStatus?: 'High' | 'Medium' | 'Low' | null;
  gpsQualityReasons?: string[] | null;
  heartRateQualityStatus?: 'High' | 'Medium' | 'Low' | null;
  heartRateQualityReasons?: string[] | null;
};



type SprintPhase = {
  runId?: string;
  startElapsedSeconds: number;
  durationSeconds: number;
  distanceMeters: number;
  topSpeedMetersPerSecond: number;
  pointIndices: number[];
  parentRunId: string;
};

type DetectedRun = {
  runId?: string;
  runType: 'sprint' | 'highIntensity';
  startElapsedSeconds: number;
  durationSeconds: number;
  distanceMeters: number;
  topSpeedMetersPerSecond: number;
  pointIndices: number[];
  parentRunId?: string | null;
  sprintPhases?: SprintPhase[];
};

type MechanicalEvent = {
  eventId?: string;
  eventType: 'acceleration' | 'deceleration' | 'highIntensityDirectionChange';
  intensity: 'moderate' | 'high' | 'veryHigh';
  startElapsedSeconds: number;
  durationSeconds: number;
  distanceMeters: number;
  pointIndices: number[];
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
  dataAvailability?: DataAvailability | null;
  gpsTrackpoints: GpsTrackpoint[];
  heartRateSamples?: HeartRateSample[];
  smoothing: SmoothingTrace;
  coreMetrics: FootballCoreMetrics;
  intervalAggregates: IntervalAggregate[];
  detectedRuns?: DetectedRun[];
  accelerations?: MechanicalEvent[];
  decelerations?: MechanicalEvent[];
  highIntensityDirectionChanges?: MechanicalEvent[];
};

type SessionType = 'Training' | 'Match' | 'Rehab' | 'Athletics' | 'Other';

type SessionContext = {
  sessionType: SessionType;
  matchResult: string | null;
  competition: string | null;
  opponentName: string | null;
  opponentLogoUrl: string | null;
};

type PlayerPosition = 'Goalkeeper' | 'CentreBack' | 'FullBack' | 'DefensiveMidfielder' | 'CentralMidfielder' | 'AttackingMidfielder' | 'Winger' | 'Striker';

type MetricThresholdProfile = {
  maxSpeedMps: number;
  maxSpeedMode: 'Fixed' | 'Adaptive';
  maxHeartRateBpm: number;
  maxHeartRateMode: 'Fixed' | 'Adaptive';
  sprintSpeedPercentOfMaxSpeed: number;
  highIntensitySpeedPercentOfMaxSpeed: number;
  moderateAccelerationThresholdMps2: number;
  highAccelerationThresholdMps2: number;
  veryHighAccelerationThresholdMps2: number;
  moderateDecelerationThresholdMps2: number;
  highDecelerationThresholdMps2: number;
  veryHighDecelerationThresholdMps2: number;
  accelDecelMinimumSpeedMps: number;
  codModerateThresholdDegrees: number;
  codHighThresholdDegrees: number;
  codVeryHighThresholdDegrees: number;
  codMinimumSpeedMps: number;
  codConsecutiveSamplesRequired: number;
  effectiveMaxSpeedMps: number;
  effectiveMaxHeartRateBpm: number;
  version: number;
  updatedAtUtc: string;
};

type SpeedUnit = 'km/h' | 'mph' | 'm/s' | 'min/km';
type MainPage = 'sessions' | 'upload' | 'profile' | 'session';
type SessionSubpage = 'analysis' | 'segments' | 'segmentEdit' | 'compare' | 'sessionSettings' | 'technicalInfo';
type SessionAnalysisTab = 'overview' | 'timeline' | 'peakDemand' | 'segments' | 'heatmap';
type TimelineMode = 'instant' | 'rolling';
type TimelineTrackKey = 'distance' | 'runningDensity' | 'speed' | 'highSpeedDistance' | 'mechanicalLoad' | 'heartRateAvg' | 'trimp';
type RouteState = { mainPage: MainPage; sessionSubpage: SessionSubpage; sessionId: string | null; segmentId: string | null; analysisTab: SessionAnalysisTab | null };


type ProfileRecalculationJob = {
  id: string;
  status: 'Running' | 'Completed' | 'Failed';
  trigger: 'ProfileUpdated' | 'Manual';
  requestedAtUtc: string;
  completedAtUtc: string | null;
  profileThresholdVersion: number;
  totalSessions: number;
  updatedSessions: number;
  failedSessions: number;
  errorMessage: string | null;
};

type UserProfile = {
  primaryPosition: PlayerPosition;
  secondaryPosition: PlayerPosition | null;
  metricThresholds: MetricThresholdProfile;
  defaultSmoothingFilter: SmoothingFilter;
  preferredSpeedUnit: SpeedUnit;
  preferredAggregationWindowMinutes: 1 | 2 | 5;
  comparisonSessionsCount: number;
  preferredTheme: 'light' | 'dark';
  preferredLocale: Locale | null;
  latestRecalculationJob?: ProfileRecalculationJob | null;
};

type AppliedProfileSnapshot = {
  thresholdVersion: number;
  thresholdUpdatedAtUtc: string;
  smoothingFilter: SmoothingFilter;
  capturedAtUtc: string;
};

type SessionRecalculationEntry = {
  recalculatedAtUtc: string;
  previousProfile: AppliedProfileSnapshot;
  newProfile: AppliedProfileSnapshot;
};

type SessionSegment = {
  id: string;
  label: string;
  category?: SegmentCategory;
  startSecond: number;
  endSecond: number;
  notes?: string | null;
};


type SegmentChangeEntry = {
  version: number;
  changedAtUtc: string;
  action: string;
  notes: string | null;
  segmentsSnapshot: SessionSegment[];
};


type ComparisonMetric = {
  averageLastN: number | null;
  best: number | null;
  isAvailable: boolean;
  availabilityReason: string | null;
};

type SessionComparisonContext = {
  comparisonSessionsCount: number;
  sessionType: SessionType;
  overview: Record<string, ComparisonMetric>;
  peak: Record<string, Record<1 | 2 | 5, ComparisonMetric>>;
  segmentOverviewByCategory: Record<string, Record<string, ComparisonMetric>>;
  segmentPeakByCategory: Record<string, Record<string, Record<1 | 2 | 5, ComparisonMetric>>>;
};

type UploadRecord = {
  id: string;
  fileName: string;
  uploadedAtUtc: string;
  summary: ActivitySummary;
  sessionContext: SessionContext;
  selectedSmoothingFilterSource: 'ProfileDefault' | 'ManualOverride' | 'ProfileRecalculation';
  selectedSpeedUnitSource: 'ProfileDefault' | 'ManualOverride' | 'ProfileRecalculation';
  selectedSpeedUnit: SpeedUnit;
  appliedProfileSnapshot: AppliedProfileSnapshot;
  recalculationHistory: SessionRecalculationEntry[];
  segments: SessionSegment[];
  segmentChangeHistory: SegmentChangeEntry[];
  isDetailed: boolean;
  comparisonContext?: SessionComparisonContext | null;
};


type CompareMetricDefinition = {
  key: string;
  label: string;
  getter: (record: UploadRecord) => number | string | null;
  formatter: (value: number | string | null, locale: Locale, notAvailable: string) => string;
};

type SessionComparisonCell = {
  formattedValue: string;
  deltaText: string;
  deltaPercentText: string;
};

type Locale = 'en' | 'de';
type SortDirection = 'desc' | 'asc';
type CompareMode = 'raw' | 'smoothed';
type SmoothingFilter = 'Raw' | 'AdaptiveMedian' | 'Savitzky-Golay' | 'Butterworth';
type TranslationKey = keyof typeof translations.en;

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').trim();
const normalizedApiBaseUrl = configuredApiBaseUrl.replace(/\/+$/, '');
const apiBaseUrl = normalizedApiBaseUrl.endsWith('/api/v1')
  ? normalizedApiBaseUrl
  : normalizedApiBaseUrl.endsWith('/api')
    ? `${normalizedApiBaseUrl}/v1`
    : `${normalizedApiBaseUrl}/api/v1`;
const maxFileSizeInBytes = 20 * 1024 * 1024;

const playerPositions: PlayerPosition[] = ['Goalkeeper', 'CentreBack', 'FullBack', 'DefensiveMidfielder', 'CentralMidfielder', 'AttackingMidfielder', 'Winger', 'Striker'];

const playerPositionLabels: Record<Locale, Record<PlayerPosition, string>> = {
  en: {
    Goalkeeper: 'Goalkeeper',
    CentreBack: 'Centre-back',
    FullBack: 'Full-back',
    DefensiveMidfielder: 'Defensive midfielder',
    CentralMidfielder: 'Central midfielder',
    AttackingMidfielder: 'Attacking midfielder',
    Winger: 'Winger',
    Striker: 'Striker'
  },
  de: {
    Goalkeeper: 'Torwart',
    CentreBack: 'Innenverteidiger',
    FullBack: 'Außenverteidiger',
    DefensiveMidfielder: 'Defensives Mittelfeld',
    CentralMidfielder: 'Zentrales Mittelfeld',
    AttackingMidfielder: 'Offensives Mittelfeld',
    Winger: 'Flügel',
    Striker: 'Stürmer'
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
    directionChanges: 'Purpose: captures Change of Direction (COD) actions and directional variability. Interpretation: higher values can indicate more stop-and-go movement and cutting actions. Unit: count.',
    sprintDistance: 'Purpose: measures high-intensity running distance above a defined speed threshold. Interpretation: this is a key indicator for intensive load (sprints and fast tempo runs), not just total movement volume. Very low values usually mean little sprint exposure, while high values indicate repeated sprint load and stronger external stress. Unit: km and m. If unavailable, GPS quality was not sufficient.',
    sprintCount: 'Purpose: counts how often the athlete enters the sprint zone above the configured speed threshold. Interpretation: this metric represents high-intensity actions and sprint stress; orientation for typical amateur sessions: 0-2 low, 3-6 moderate, >6 high. Read it together with sprint distance to distinguish many short sprint actions from fewer but longer high-speed phases. Unit: count. If unavailable, GPS quality was not sufficient.',
    maxSpeed: 'Purpose: captures the highest measured speed during the unit and reflects current sprint capability. Interpretation: <6.0 m/s is rather low, 6.0-7.5 m/s typical, and >7.5 m/s very high for many amateur players. Track this over time as a performance marker and combine it with high-speed distance to see whether top speed is reached only briefly or repeatedly. Unit: m/s. If unavailable, GPS quality was not sufficient.',
    highIntensityTime: 'Purpose: tracks the total time spent above the high-intensity speed threshold. Interpretation: more time means larger intense workload and generally higher cardiovascular and muscular demand. If this value is high while sprint count is low, the session likely contained longer sustained fast runs instead of many short maximal actions. Unit: minutes and seconds. If unavailable, GPS quality was not sufficient.',
    highIntensityRunCount: 'Purpose: counts how often a high-intensity running phase starts above the high-intensity threshold. Interpretation: it indicates repeated high-tempo bouts and complements high-intensity time by separating many short bouts from fewer long ones. Read together with high-speed distance to classify the running profile of the session. Unit: count. If unavailable, GPS quality was not sufficient.',
    highSpeedDistance: 'Purpose: tracks distance covered above the high-speed threshold. Interpretation: higher values suggest sustained fast running capacity and game-like repeated high-tempo phases, not only isolated short sprints. Combined with max speed, it helps distinguish between a single speed peak and consistent fast running performance. Unit: km and m. If unavailable, GPS quality was not sufficient.',
    runningDensity: 'Purpose: normalizes distance by time (meters per minute) and allows relative intensity comparison across different session durations. Interpretation: a shorter drill can be more intensive per minute even if total distance is lower. Use this metric when comparing short vs. long formats to avoid misleading conclusions from absolute distance only. Unit: meters per minute. If unavailable, GPS quality was not sufficient.',
    accelerationCount: 'Purpose: counts explosive speed-ups that exceed the configured acceleration threshold. Interpretation: more accelerations often mean greater neuromuscular load from repeated bursts and direction-driven actions. In combination with deceleration count, this metric helps identify stop-and-go sessions that can feel harder than pure distance suggests. Unit: count. If unavailable, GPS quality was not sufficient.',
    decelerationCount: 'Purpose: counts braking actions that exceed the configured deceleration threshold. Interpretation: high counts indicate frequent stopping/cutting actions and can increase eccentric muscle stress, especially in hamstrings and quadriceps. Together with acceleration count, it is a strong signal for mechanical load and potential fatigue risk despite moderate total distance. Unit: count. If unavailable, GPS quality was not sufficient.',
    hrZoneLow: 'Purpose: tracks time in the low heart-rate zone (<70% of session-specific HRmax reference). Interpretation: higher time indicates a larger easy-load share and usually better recovery character within the session. This is useful to verify whether a planned low-intensity session actually stayed easy enough. Unit: minutes and seconds. If unavailable, heart-rate quality was not sufficient.',
    hrZoneMedium: 'Purpose: tracks time in the moderate heart-rate zone (70-85%). Interpretation: this zone reflects sustained submaximal work and is typically linked to aerobic conditioning load. Rising values over several sessions can indicate strong base-work phases, especially when high-zone time remains controlled. Unit: minutes and seconds. If unavailable, heart-rate quality was not sufficient.',
    hrZoneHigh: 'Purpose: tracks time in the high heart-rate zone (>85% HRmax). Interpretation: this zone is especially relevant because it indicates very high intensity and match-like physiological stress. Persistently high values across sessions should be balanced with recovery-focused days to avoid overload. Unit: minutes and seconds. If unavailable, heart-rate quality was not sufficient.',
    trimpEdwards: 'Purpose: estimates internal training load via weighted time in heart-rate zones (Edwards/TRIMP concept). Interpretation: rough orientation for amateur sessions is <40 low load, 40-80 moderate, 80-120 high, and >120 very high. Most useful is the trend over weeks: sharp TRIMP spikes can indicate abrupt load increases and elevated fatigue risk. Unit: score. If unavailable, heart-rate quality was not sufficient.',
    hrRecovery60: 'Purpose: indicates short-term autonomic recovery after effort by measuring heart-rate drop after 60 seconds. Interpretation: rough orientation is <12 bpm drop rather weak, 12-20 moderate, and >20 good recovery response. Track this trend over time under similar conditions; falling recovery values can be an early sign of fatigue, stress, or insufficient regeneration. Unit: bpm drop after 60s. If unavailable, heart-rate quality was not sufficient.',
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
    directionChanges: 'Zweck: erfasst Change of Direction (COD)-Aktionen und Richtungsvariabilität. Interpretation: höhere Werte können mehr Stop-and-Go und Richtungswechsel anzeigen. Einheit: Anzahl.',
    sprintDistance: 'Zweck: misst die hochintensive Laufdistanz oberhalb einer definierten Geschwindigkeitsschwelle. Interpretation: sie ist ein zentraler Indikator für intensive Belastung (Sprints/Tempoläufe) und nicht nur für allgemeines Laufvolumen. Sehr niedrige Werte deuten meist auf wenige Sprintphasen hin, hohe Werte auf ausgeprägte Sprintbelastung und stärkere äußere Last. Einheit: km und m. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    sprintCount: 'Zweck: zählt, wie oft ein Spieler den Sprintbereich oberhalb der konfigurierten Geschwindigkeitsschwelle erreicht. Interpretation: die Metrik steht für hochintensive Aktionen und Sprintstress; Orientierung für typische Amateur-Sessions: 0-2 niedrig, 3-6 mittel, >6 hoch. Gemeinsam mit der Sprintdistanz lässt sich unterscheiden, ob eher viele kurze oder wenige längere Sprintphasen vorlagen. Einheit: Anzahl. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    maxSpeed: 'Zweck: erfasst die höchste gemessene Geschwindigkeit der Einheit und damit das aktuelle Sprintvermögen. Interpretation: <6,0 m/s eher niedrig, 6,0-7,5 m/s typisch und >7,5 m/s für viele Amateurspieler sehr hoch. Über die Zeit ist der Wert ein Performance-Marker; in Kombination mit High-Speed-Distanz sieht man, ob Top-Speed nur kurz oder wiederholt erreicht wurde. Einheit: m/s. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    highIntensityTime: 'Zweck: misst die Gesamtzeit oberhalb der High-Intensity-Schwelle. Interpretation: mehr Zeit bedeutet eine höhere intensive Arbeitslast und in der Regel stärkere kardiale sowie muskuläre Beanspruchung. Ist der Wert hoch, aber Anzahl Sprints niedrig, spricht das häufig für längere schnelle Läufe statt vieler kurzer Maximalaktionen. Einheit: Minuten und Sekunden. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    highIntensityRunCount: 'Zweck: zählt, wie oft eine hochintensive Laufphase oberhalb der High-Intensity-Schwelle beginnt. Interpretation: die Metrik zeigt wiederholte Tempobouts und ergänzt die Hochintensitätszeit, indem viele kurze von wenigen langen Phasen unterschieden werden können. Zusammen mit der High-Speed-Distanz lässt sich das Belastungsprofil der Einheit besser einordnen. Einheit: Anzahl. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    highSpeedDistance: 'Zweck: misst die Distanz oberhalb der High-Speed-Schwelle. Interpretation: höhere Werte sprechen für mehr anhaltend schnelles Laufen und wiederholte Tempophasen, nicht nur einzelne kurze Sprints. Zusammen mit Maximalgeschwindigkeit hilft die Metrik zu unterscheiden, ob nur ein Speed-Peak erreicht wurde oder dauerhaft schnell gelaufen wurde. Einheit: km und m. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    runningDensity: 'Zweck: setzt Distanz ins Verhältnis zur Zeit (Meter pro Minute) und erlaubt damit einen relativen Intensitätsvergleich über unterschiedlich lange Sessions. Interpretation: eine kurze Spielform kann pro Minute intensiver sein als eine längere Einheit, obwohl die Gesamtdistanz niedriger ist. Die Kennzahl hilft daher, kurze vs. lange Formate fair zu vergleichen. Einheit: Meter pro Minute. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    accelerationCount: 'Zweck: zählt explosive Beschleunigungen oberhalb der konfigurierten Beschleunigungsschwelle. Interpretation: hohe Werte bedeuten viele Antritte und meist höhere neuromuskuläre Belastung durch wiederholte Belastungsspitzen. In Verbindung mit Abbremsungen lässt sich gut erkennen, ob eine Session stark stop-and-go geprägt war. Einheit: Anzahl. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    decelerationCount: 'Zweck: zählt Bremsaktionen oberhalb der konfigurierten Abbrems-Schwelle. Interpretation: hohe Werte bedeuten viele Stopp-/Abbremsbewegungen und können die exzentrische muskuläre Last erhöhen. Zusammen mit Beschleunigungen ist dies ein starker Hinweis auf mechanische Belastung und mögliche Ermüdung trotz moderater Gesamtdistanz. Einheit: Anzahl. Falls nicht verfügbar, war die GPS-Qualität zu gering.',
    hrZoneLow: 'Zweck: misst die Zeit in niedriger Herzfrequenzintensität (<70% der sessionbasierten HFmax-Referenz). Interpretation: mehr Zeit bedeutet einen höheren Anteil lockerer Belastung und meist einen stärkeren Erholungscharakter der Einheit. Damit lässt sich prüfen, ob eine geplante lockere Session wirklich im gewünschten Intensitätsbereich blieb. Einheit: Minuten und Sekunden. Falls nicht verfügbar, war die HF-Qualität zu gering.',
    hrZoneMedium: 'Zweck: misst die Zeit in mittlerer Herzfrequenzintensität (70-85%). Interpretation: die Zone steht typischerweise für dauerhafte submaximale Arbeit und aerobe Belastung. Wenn dieser Anteil über mehrere Einheiten steigt und die High-Zone stabil bleibt, spricht das häufig für strukturiertes Ausdauertraining. Einheit: Minuten und Sekunden. Falls nicht verfügbar, war die HF-Qualität zu gering.',
    hrZoneHigh: 'Zweck: misst die Zeit in hoher Herzfrequenzintensität (>85% HFmax). Interpretation: diese Zone ist besonders relevant, weil sie sehr hohe Intensität und wettkampfnahen physiologischen Stress anzeigt. Bleibt dieser Anteil über viele Sessions hoch, sollte bewusst mit Regenerationstagen gegengesteuert werden, um Überlastung zu vermeiden. Einheit: Minuten und Sekunden. Falls nicht verfügbar, war die HF-Qualität zu gering.',
    trimpEdwards: 'Zweck: schätzt die interne Trainingsbelastung über gewichtete Zeiten in Herzfrequenzzonen (Edwards/TRIMP-Konzept). Interpretation: grobe Orientierung für Amateur-Sessions: <40 niedrig, 40-80 mittel, 80-120 hoch, >120 sehr hoch. Am aussagekräftigsten ist der Verlauf über Wochen; deutliche TRIMP-Spitzen können auf abrupte Laststeigerungen und erhöhtes Ermüdungsrisiko hinweisen. Einheit: Score. Falls nicht verfügbar, war die HF-Qualität zu gering.',
    hrRecovery60: 'Zweck: zeigt die kurzfristige autonome Erholung nach Belastung über den Herzfrequenzabfall nach 60 Sekunden. Interpretation: grobe Orientierung: <12 bpm Abfall eher schwach, 12-20 mittel, >20 gut. Besonders aussagekräftig ist der Trend unter ähnlichen Bedingungen; sinkende Werte können auf Müdigkeit, Stress oder unzureichende Regeneration hindeuten. Einheit: bpm-Abfall nach 60 s. Falls nicht verfügbar, war die HF-Qualität zu gering.',
    coreThresholds: 'Zweck: dokumentiert aktive Metrik-Schwellenwerte. Interpretation: Werte definieren die Klassifikation von Tempo-/Intensitätsereignissen. Einheit: Parameterwerte.'
  }
};



type NumericMetricGetter = (record: UploadRecord) => number | null;

function calculateKpiComparison(
  selected: UploadRecord | null,
  history: UploadRecord[],
  metricGetter: NumericMetricGetter
): { averageLastFive: number | null; bestSeason: number | null } {
  if (!selected) {
    return { averageLastFive: null, bestSeason: null };
  }

  const comparableValues = history
    .filter((record) => record.id !== selected.id && record.sessionContext.sessionType === selected.sessionContext.sessionType)
    .map(metricGetter)
    .filter((value): value is number => value !== null);

  const lastFive = comparableValues.slice(0, 5);
  const averageLastFive = lastFive.length > 0
    ? lastFive.reduce((sum, value) => sum + value, 0) / lastFive.length
    : null;

  const bestSeason = comparableValues.length > 0
    ? Math.max(...comparableValues)
    : null;

  return { averageLastFive, bestSeason };
}



type PeakComparisonMetricKey = 'distance' | 'highSpeedDistance' | 'mechanicalLoad' | 'trimp' | 'heartRateAvg';
type PeakMetricValues = Record<PeakComparisonMetricKey, number | null>;

function toPeakComparisonValues(record: UploadRecord, windowMinutes: 1 | 2 | 5): PeakMetricValues {
  const durationFromSummary = Math.max(0, Math.floor(record.summary.durationSeconds ?? 0));
  const gpsPoints = record.summary.gpsTrackpoints
    .filter((point): point is GpsTrackpoint & { elapsedSeconds: number } => point.elapsedSeconds !== null)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

  const maxElapsedGps = gpsPoints.length > 0 ? Math.max(...gpsPoints.map((point) => Math.floor(point.elapsedSeconds))) : 0;
  const hrSamples = (record.summary.heartRateSamples ?? []).slice().sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  const maxElapsedHr = hrSamples.length > 0 ? Math.max(...hrSamples.map((sample) => Math.floor(sample.elapsedSeconds))) : 0;
  const durationSeconds = Math.max(1, durationFromSummary, maxElapsedGps, maxElapsedHr);

  const distanceDelta = new Array<number>(durationSeconds + 1).fill(0);
  const highSpeedDistanceDelta = new Array<number>(durationSeconds + 1).fill(0);
  const accelBySecond = new Array<number>(durationSeconds + 1).fill(0);
  const decelBySecond = new Array<number>(durationSeconds + 1).fill(0);
  const codBySecond = new Array<number>(durationSeconds + 1).fill(0);
  const hrSumBySecond = new Array<number>(durationSeconds + 1).fill(0);
  const hrCountBySecond = new Array<number>(durationSeconds + 1).fill(0);
  const trimpDeltaBySecond = new Array<number>(durationSeconds + 1).fill(0);

  const toSecond = (elapsed: number) => Math.max(0, Math.min(durationSeconds, Math.floor(elapsed)));
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const distanceMetersBetween = (first: GpsTrackpoint, second: GpsTrackpoint) => {
    const dLat = toRadians(second.latitude - first.latitude);
    const dLon = toRadians(second.longitude - first.longitude);
    const lat1 = toRadians(first.latitude);
    const lat2 = toRadians(second.latitude);
    const a = (Math.sin(dLat / 2) ** 2)
      + (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2));
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371000 * c;
  };

  const highSpeedThresholdRaw = record.summary.coreMetrics.thresholds.HighIntensitySpeedThresholdMps;
  const parsedThreshold = highSpeedThresholdRaw ? Number(highSpeedThresholdRaw) : Number.NaN;
  const highSpeedThreshold = Number.isFinite(parsedThreshold) ? parsedThreshold : (7 / 3.6);

  for (let index = 1; index < gpsPoints.length; index += 1) {
    const previous = gpsPoints[index - 1];
    const current = gpsPoints[index];
    const elapsed = current.elapsedSeconds - previous.elapsedSeconds;
    if (elapsed <= 0) {
      continue;
    }

    const distanceMeters = distanceMetersBetween(previous, current);
    const speedMps = distanceMeters / elapsed;
    const second = toSecond(current.elapsedSeconds);
    distanceDelta[second] += distanceMeters;
    if (speedMps >= highSpeedThreshold) {
      highSpeedDistanceDelta[second] += distanceMeters;
    }
  }

  const addEvents = (events: MechanicalEvent[] | undefined, target: number[]) => {
    (events ?? []).forEach((event) => {
      const second = toSecond(event.startElapsedSeconds);
      target[second] += 1;
    });
  };
  addEvents(record.summary.accelerations, accelBySecond);
  addEvents(record.summary.decelerations, decelBySecond);
  addEvents(record.summary.highIntensityDirectionChanges, codBySecond);

  hrSamples.forEach((sample) => {
    const second = toSecond(sample.elapsedSeconds);
    hrSumBySecond[second] += sample.heartRateBpm;
    hrCountBySecond[second] += 1;
  });

  for (let second = 0; second <= durationSeconds; second += 1) {
    if (hrCountBySecond[second] === 0 && second > 0 && hrCountBySecond[second - 1] > 0) {
      hrSumBySecond[second] = hrSumBySecond[second - 1] / hrCountBySecond[second - 1];
      hrCountBySecond[second] = 1;
    }
    if (hrCountBySecond[second] > 0) {
      const avgHr = hrSumBySecond[second] / hrCountBySecond[second];
      const zoneWeight = avgHr < 120 ? 1 : avgHr < 140 ? 2 : avgHr < 160 ? 3 : avgHr < 180 ? 4 : 5;
      trimpDeltaBySecond[second] = zoneWeight / 60;
    }
  }

  const prefix = (arr: number[]) => {
    const out = new Array<number>(arr.length + 1).fill(0);
    for (let i = 0; i < arr.length; i += 1) {
      out[i + 1] = out[i] + arr[i];
    }
    return out;
  };

  const distancePrefix = prefix(distanceDelta);
  const highSpeedPrefix = prefix(highSpeedDistanceDelta);
  const accelPrefix = prefix(accelBySecond);
  const decelPrefix = prefix(decelBySecond);
  const codPrefix = prefix(codBySecond);
  const hrSumPrefix = prefix(hrSumBySecond);
  const hrCountPrefix = prefix(hrCountBySecond);
  const trimpPrefix = prefix(trimpDeltaBySecond);

  const rollingWindowSeconds = windowMinutes * 60;
  let maxDistance = 0;
  let maxHighSpeedDistance = 0;
  let maxMechanicalLoad = 0;
  let maxTrimp = 0;
  let maxHeartRateAvg: number | null = null;

  for (let second = 0; second <= durationSeconds; second += 1) {
    const rangeStart = Math.max(0, second - rollingWindowSeconds + 1);
    const sumOverRange = (pref: number[]) => pref[second + 1] - pref[rangeStart];

    maxDistance = Math.max(maxDistance, sumOverRange(distancePrefix));
    maxHighSpeedDistance = Math.max(maxHighSpeedDistance, sumOverRange(highSpeedPrefix));
    maxMechanicalLoad = Math.max(maxMechanicalLoad, sumOverRange(accelPrefix) + sumOverRange(decelPrefix) + sumOverRange(codPrefix));
    maxTrimp = Math.max(maxTrimp, sumOverRange(trimpPrefix));

    const hrCount = sumOverRange(hrCountPrefix);
    if (hrCount > 0) {
      const hrAvg = sumOverRange(hrSumPrefix) / hrCount;
      maxHeartRateAvg = maxHeartRateAvg === null ? hrAvg : Math.max(maxHeartRateAvg, hrAvg);
    }
  }

  return {
    distance: maxDistance > 0 ? maxDistance : null,
    highSpeedDistance: maxHighSpeedDistance > 0 ? maxHighSpeedDistance : null,
    mechanicalLoad: maxMechanicalLoad > 0 ? maxMechanicalLoad : null,
    trimp: maxTrimp > 0 ? maxTrimp : null,
    heartRateAvg: maxHeartRateAvg
  };
}

type CachedAppearancePreferences = {
  preferredTheme: 'light' | 'dark';
  preferredLocale: Locale | null;
};

const appearanceCacheKey = 'football-metrics.profile-appearance';

function loadCachedAppearancePreferences(): CachedAppearancePreferences | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(appearanceCacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedAppearancePreferences>;
    const preferredTheme = parsed.preferredTheme === 'light' || parsed.preferredTheme === 'dark' ? parsed.preferredTheme : null;
    const preferredLocale = parsed.preferredLocale === 'de' || parsed.preferredLocale === 'en' ? parsed.preferredLocale : null;

    if (!preferredTheme) {
      return null;
    }

    return { preferredTheme, preferredLocale };
  } catch {
    return null;
  }
}

function persistAppearancePreferences(profile: Pick<UserProfile, 'preferredTheme' | 'preferredLocale'>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(appearanceCacheKey, JSON.stringify({
      preferredTheme: profile.preferredTheme,
      preferredLocale: profile.preferredLocale
    }));
  } catch {
    // Intentionally ignore storage failures.
  }
}

function formatLocalDateTime(dateText: string): string {
  return new Date(dateText).toLocaleString();
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

function calculatePercent(part: number | null | undefined, total: number): number {
  if (part === null || part === undefined || total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (part / total) * 100));
}

function speedUnitSuffix(unit: SpeedUnit): string {
  if (unit === 'km/h') return ' km/h';
  if (unit === 'mph') return ' mph';
  if (unit === 'min/km') return ' min/km';
  return ' m/s';
}

function formatSpeedComparisonDelta(
  valueMetersPerSecond: number | null | undefined,
  averageMetersPerSecond: number | null | undefined,
  locale: Locale,
  unit: SpeedUnit
): KpiCardComparisonDelta | null {
  if (valueMetersPerSecond === null || valueMetersPerSecond === undefined || averageMetersPerSecond === null || averageMetersPerSecond === undefined) {
    return null;
  }

  const convertedValue = convertSpeedToUnitValue(valueMetersPerSecond, unit);
  const convertedAverage = convertSpeedToUnitValue(averageMetersPerSecond, unit);
  if (convertedValue === null || convertedAverage === null) {
    return null;
  }

  const digits = unit === 'm/s' ? 2 : (unit === 'min/km' ? 2 : 1);
  const rawDiff = convertedValue - convertedAverage;
  const precisionThreshold = 1 / Math.pow(10, digits);
  const diff = Math.abs(rawDiff) < precisionThreshold ? 0 : rawDiff;

  return {
    value: diff === 0
      ? `±${(0).toLocaleString(normalizeLocaleTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits })}${speedUnitSuffix(unit)}`
      : `${formatSignedNumber(diff, locale, digits)}${speedUnitSuffix(unit)}`,
    tone: diff === 0 ? 'neutral' : (diff > 0 ? 'positive' : 'negative')
  };
}

function formatComparisonDelta(
  value: number | null | undefined,
  average: number | null | undefined,
  locale: Locale,
  digits = 1,
  suffix = '',
  direction: 'higher' | 'lower' | 'neutral' = 'higher'
): KpiCardComparisonDelta | null {
  if (value === null || value === undefined || average === null || average === undefined) {
    return null;
  }

  const precisionThreshold = 1 / Math.pow(10, digits);
  const rawDiff = value - average;
  const diff = Math.abs(rawDiff) < precisionThreshold ? 0 : rawDiff;
  const tone = diff === 0
    ? 'neutral'
    : direction === 'neutral'
      ? 'neutral'
      : direction === 'higher'
        ? (diff > 0 ? 'positive' : 'negative')
        : (diff < 0 ? 'positive' : 'negative');

  const formatted = diff === 0
    ? `±${(0).toLocaleString(normalizeLocaleTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`
    : `${formatSignedNumber(diff, locale, digits)}${suffix}`;

  return {
    value: formatted,
    tone
  };
}

function formatDurationDelta(
  durationSeconds: number | null | undefined,
  averageSeconds: number | null | undefined,
  direction: 'higher' | 'lower' | 'neutral' = 'lower'
): KpiCardComparisonDelta | null {
  if (durationSeconds === null || durationSeconds === undefined || averageSeconds === null || averageSeconds === undefined) {
    return null;
  }

  const rawDiff = Math.round(durationSeconds - averageSeconds);
  const diff = Math.abs(rawDiff) < 1 ? 0 : rawDiff;
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60).toString().padStart(2, '0');
  const seconds = Math.floor(absDiff % 60).toString().padStart(2, '0');
  const prefix = diff > 0 ? '+' : diff < 0 ? '-' : '±';
  const tone = diff === 0
    ? 'neutral'
    : direction === 'neutral'
      ? 'neutral'
      : direction === 'higher'
        ? (diff > 0 ? 'positive' : 'negative')
        : (diff < 0 ? 'positive' : 'negative');

  return {
    value: `${prefix}${minutes}:${seconds}`,
    tone
  };
}


type CodDetectionInput = {
  moderateThresholdDegrees: number;
  highThresholdDegrees: number;
  veryHighThresholdDegrees: number;
  minSpeedMps: number;
  consecutiveSamplesRequired: number;
  minStepDistanceMeters?: number;
};

type CodBandCounts = {
  moderate: number;
  high: number;
  veryHigh: number;
  total: number;
};

function computeCodBandCounts(
  points: Array<GpsTrackpoint & { elapsedSeconds: number }>,
  config: CodDetectionInput
): CodBandCounts {
  if (points.length < 3) {
    return { moderate: 0, high: 0, veryHigh: 0, total: 0 };
  }

  const ordered = [...points].sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  let consecutive = 0;
  let inEvent = false;
  let eventDirection: number | null = null;
  let highestBand: 'moderate' | 'high' | 'veryHigh' | null = null;

  const counts: CodBandCounts = { moderate: 0, high: 0, veryHigh: 0, total: 0 };

  const classifyBand = (delta: number): 'moderate' | 'high' | 'veryHigh' | null => {
    if (delta >= config.veryHighThresholdDegrees) return 'veryHigh';
    if (delta >= config.highThresholdDegrees) return 'high';
    if (delta >= config.moderateThresholdDegrees) return 'moderate';
    return null;
  };

  const bandPriority = (band: 'moderate' | 'high' | 'veryHigh') => (band === 'veryHigh' ? 3 : band === 'high' ? 2 : 1);

  for (let index = 1; index < ordered.length - 1; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const next = ordered[index + 1];

    const incoming = calculateBearingDegrees(previous, current);
    const outgoing = calculateBearingDegrees(current, next);
    if (incoming === null || outgoing === null) {
      consecutive = 0; inEvent = false; eventDirection = null; highestBand = null;
      continue;
    }

    const signedTurn = calculateSignedDeltaDegrees(incoming, outgoing);
    const deltaAngle = Math.abs(signedTurn);

    const incomingStepDistance = haversineMeters(previous.latitude, previous.longitude, current.latitude, current.longitude);
    const outgoingStepDistance = haversineMeters(current.latitude, current.longitude, next.latitude, next.longitude);

    const incomingDeltaSeconds = current.elapsedSeconds - previous.elapsedSeconds;
    const outgoingDeltaSeconds = next.elapsedSeconds - current.elapsedSeconds;
    if (incomingDeltaSeconds <= 0 || outgoingDeltaSeconds <= 0) {
      consecutive = 0; inEvent = false; eventDirection = null; highestBand = null;
      continue;
    }

    const incomingSpeed = incomingStepDistance / incomingDeltaSeconds;
    const outgoingSpeed = outgoingStepDistance / outgoingDeltaSeconds;

    const minStepDistance = config.minStepDistanceMeters ?? 0;
    const isSpeedValid = incomingSpeed >= config.minSpeedMps && outgoingSpeed >= config.minSpeedMps;
    const isStepDistanceValid = incomingStepDistance >= minStepDistance && outgoingStepDistance >= minStepDistance;
    const band = classifyBand(deltaAngle);

    if (!isSpeedValid || !isStepDistanceValid || !band) {
      consecutive = 0; inEvent = false; eventDirection = null; highestBand = null;
      continue;
    }

    const direction = Math.sign(signedTurn) || 1;
    if (consecutive === 0 || eventDirection === direction) {
      eventDirection = direction;
      highestBand = !highestBand || bandPriority(band) > bandPriority(highestBand) ? band : highestBand;
      consecutive += 1;
    } else {
      eventDirection = direction;
      highestBand = band;
      consecutive = 1;
      inEvent = false;
    }

    if (!inEvent && consecutive >= Math.max(1, config.consecutiveSamplesRequired)) {
      const classified = highestBand ?? band;
      counts[classified] += 1;
      counts.total += 1;
      inEvent = true;
    }
  }

  return counts;
}

function calculateBearingDegrees(from: GpsTrackpoint, to: GpsTrackpoint): number | null {
  if (!Number.isFinite(from.latitude) || !Number.isFinite(from.longitude) || !Number.isFinite(to.latitude) || !Number.isFinite(to.longitude)) {
    return null;
  }

  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function calculateSignedDeltaDegrees(firstBearing: number, secondBearing: number): number {
  return (secondBearing - firstBearing + 540) % 360 - 180;
}

function haversineMeters(lat1Deg: number, lon1Deg: number, lat2Deg: number, lon2Deg: number): number {
  const earthRadius = 6_371_000;
  const lat1 = (lat1Deg * Math.PI) / 180;
  const lat2 = (lat2Deg * Math.PI) / 180;
  const deltaLat = ((lat2Deg - lat1Deg) * Math.PI) / 180;
  const deltaLon = ((lon2Deg - lon1Deg) * Math.PI) / 180;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}
function formatThresholds(thresholds: Record<string, string>): string {
  return Object.entries(thresholds)
    .map(([key, value]) => `${key}=${value}`)
    .join(' | ');
}

function formatMetricStatus(metricKey: string, coreMetrics: FootballCoreMetrics, t: Record<TranslationKey, string>): string | null {
  const status = coreMetrics.metricAvailability?.[metricKey];
  if (!status || status.state === 'Available' || status.state === 'AvailableWithWarning') {
    return null;
  }

  const label = status.state === 'NotMeasured'
    ? t.metricStateNotMeasured
    : (status.state === 'AvailableWithWarning' ? t.metricStateAvailableWithWarning : t.metricStateNotUsable);
  return status.reason ? `${label}: ${status.reason}` : label;
}

function withMetricStatus(value: string, metricKey: string, coreMetrics: FootballCoreMetrics, t: Record<TranslationKey, string>): string {
  const status = formatMetricStatus(metricKey, coreMetrics, t);
  return status ? `${value} — ${status}` : value;
}

function combineMetricAvailability(states: Array<MetricAvailability['state']>): MetricAvailability['state'] {
  if (states.some((state) => state === 'AvailableWithWarning')) {
    return 'AvailableWithWarning';
  }

  if (states.some((state) => state === 'Available')) {
    return 'Available';
  }

  if (states.some((state) => state === 'NotUsable')) {
    return 'NotUsable';
  }

  return 'NotMeasured';
}

function isMetricAvailableForAggregation(metricAvailability: Record<string, MetricAvailability>, metricKey: string): boolean {
  const status = metricAvailability[metricKey]?.state;
  return status === 'Available' || status === 'AvailableWithWarning';
}

function hasAvailableWithWarning(coreMetrics: FootballCoreMetrics, keys: string[]): boolean {
  return keys.some((key) => coreMetrics.metricAvailability?.[key]?.state === 'AvailableWithWarning');
}

function sessionTypeText(sessionType: SessionType, t: Record<TranslationKey, string>): string {
  switch (sessionType) {
    case 'Match': return t.sessionTypeMatch;
    case 'Rehab': return t.sessionTypeRehab;
    case 'Athletics': return t.sessionTypeAthletics;
    case 'Other': return t.sessionTypeOther;
    default: return t.sessionTypeTraining;
  }
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


function resolveDataAvailability(summary: ActivitySummary): DataAvailability {
  if (summary.dataAvailability) {
    return summary.dataAvailability;
  }

  const hasHeartRateData = summary.heartRateAverageBpm !== null || summary.heartRateMinBpm !== null || summary.heartRateMaxBpm !== null;
  const gpsStatus: DataAvailability['gpsStatus'] = summary.hasGpsData
    ? (summary.qualityStatus === 'Low' ? 'NotUsable' : (summary.qualityStatus === 'Medium' ? 'AvailableWithWarning' : 'Available'))
    : 'NotMeasured';

  const mode: DataAvailability['mode'] = summary.hasGpsData
    ? (hasHeartRateData ? 'Dual' : 'GpsOnly')
    : (hasHeartRateData ? 'HeartRateOnly' : 'NotAvailable');

  return {
    mode,
    gpsStatus,
    gpsReason: gpsStatus === 'NotMeasured'
      ? 'GPS not present in this session.'
      : (gpsStatus === 'NotUsable'
        ? `GPS unusable because quality is ${summary.qualityStatus}.`
        : (gpsStatus === 'AvailableWithWarning' ? `GPS available with warning because quality is ${summary.qualityStatus}.` : null)),
    heartRateStatus: hasHeartRateData ? 'Available' : 'NotMeasured',
    heartRateReason: hasHeartRateData ? null : 'Heart-rate data not present in this session.',
    gpsQualityStatus: summary.qualityStatus,
    gpsQualityReasons: summary.qualityReasons,
    heartRateQualityStatus: summary.qualityStatus,
    heartRateQualityReasons: summary.qualityReasons
  };
}

function normalizeUploadRecord(record: UploadRecord): UploadRecord {
  const normalizedSegments = (record.segments ?? []).map((segment) => ({
    ...segment,
    category: (segmentCategoryOptions.find((option) => option === segment.category) ?? 'Other'),
    notes: segment.notes ?? null
  }));

  const segments = normalizedSegments;

  return {
    ...record,
    segments,
    segmentChangeHistory: record.segmentChangeHistory ?? [],
    isDetailed: record.isDetailed ?? true,
    summary: {
      ...record.summary,
      dataAvailability: resolveDataAvailability(record.summary)
    }
  };
}

function dataModeText(mode: DataAvailability['mode'], t: Record<TranslationKey, string>): string {
  switch (mode) {
    case 'Dual':
      return t.dataModeDual;
    case 'HeartRateOnly':
      return t.dataModeHeartRateOnly;
    case 'GpsOnly':
      return t.dataModeGpsOnly;
    default:
      return t.dataModeNotAvailable;
  }
}

function availabilityText(status: DataAvailability['gpsStatus'], t: Record<TranslationKey, string>): string {
  switch (status) {
    case 'Available':
      return t.availabilityAvailable;
    case 'NotMeasured':
      return t.availabilityNotMeasured;
    case 'AvailableWithWarning':
      return t.availabilityAvailableWithWarning;
    default:
      return t.availabilityNotUsable;
  }
}



function trimpPerMinute(summary: ActivitySummary): number | null {
  const trimp = summary.coreMetrics.trainingImpulseEdwards;
  if (trimp === null || summary.durationSeconds <= 0) {
    return null;
  }

  return trimp / (summary.durationSeconds / 60);
}

function dataAvailabilitySummaryText(summary: ActivitySummary, t: Record<TranslationKey, string>): string {
  const availability = resolveDataAvailability(summary);
  const gps = `GPS data: ${availabilityText(availability.gpsStatus, t)}${availability.gpsReason ? ` (${availability.gpsReason})` : ''}`;
  const hr = `HR data: ${availabilityText(availability.heartRateStatus, t)}${availability.heartRateReason ? ` (${availability.heartRateReason})` : ''}`;
  return `${dataModeText(availability.mode, t)} — ${gps} | ${hr}`;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

function getFileValidationMessage(file: File | null, locale: Locale): string | null {
  return getFileValidationMessageBase(file, {
    invalidExtensionMessage: translations[locale].invalidExtension,
    invalidSizeMessage: translations[locale].invalidSize,
    maxFileSizeInBytes
  });
}

const smoothingFilterOptions: SmoothingFilter[] = ['Raw', 'AdaptiveMedian', 'Savitzky-Golay', 'Butterworth'];
const segmentCategoryOptions = ['Other', 'Aufwärmen', 'Spielform', 'Torschuss', 'Athletik', 'Cooldown', '1. Halbzeit', '2. Halbzeit', 'Halbzeit Pause'] as const;

type SegmentCategory = typeof segmentCategoryOptions[number];

function segmentCategoryLabel(category: SegmentCategory, t: Record<TranslationKey, string>): string {
  switch (category) {
    case 'Aufwärmen': return t.segmentCategoryWarmup;
    case 'Spielform': return t.segmentCategoryGameForm;
    case 'Torschuss': return t.segmentCategoryFinishing;
    case 'Athletik': return t.segmentCategoryAthletics;
    case 'Cooldown': return t.segmentCategoryCooldown;
    case '1. Halbzeit': return t.segmentCategoryFirstHalf;
    case '2. Halbzeit': return t.segmentCategorySecondHalf;
    case 'Halbzeit Pause': return t.segmentCategoryHalfTimeBreak;
    default: return t.segmentCategoryOther;
  }
}

function getFilterLabel(filter: SmoothingFilter, t: Record<TranslationKey, string>): string {
  switch (filter) {
    case 'Raw':
      return t.filterRaw;
    case 'Savitzky-Golay':
      return t.filterSavitzkyGolay;
    case 'Butterworth':
      return t.filterButterworth;
    default:
      return t.filterAdaptiveMedian;
  }
}

function getFilterDescriptionKey(filter: SmoothingFilter): TranslationKey {
  switch (filter) {
    case 'Raw':
      return 'filterDescriptionRaw';
    case 'Savitzky-Golay':
      return 'filterDescriptionSavitzkyGolay';
    case 'Butterworth':
      return 'filterDescriptionButterworth';
    default:
      return 'filterDescriptionAdaptiveMedian';
  }
}

function resolveRouteFromPath(pathname: string): RouteState {
  if (pathname === '/uploads') {
    return { mainPage: 'upload', sessionSubpage: 'analysis', sessionId: null, segmentId: null, analysisTab: null };
  }

  if (pathname === '/profiles') {
    return { mainPage: 'profile', sessionSubpage: 'analysis', sessionId: null, segmentId: null, analysisTab: null };
  }

  if (pathname === '/') {
    return { mainPage: 'sessions', sessionSubpage: 'analysis', sessionId: null, segmentId: null, analysisTab: null };
  }

  if (pathname === '/sessions') {
    return { mainPage: 'sessions', sessionSubpage: 'analysis', sessionId: null, segmentId: null, analysisTab: null };
  }

  const tabQuery = new URLSearchParams(window.location.search).get('tab');
  const analysisTab = tabQuery === 'timeline' || tabQuery === 'peakDemand' || tabQuery === 'segments' || tabQuery === 'heatmap' || tabQuery === 'overview'
    ? tabQuery
    : null;

  const segmentAnalysisRouteMatch = pathname.match(/^\/sessions\/([^/]+)\/segments\/([^/]+)$/);
  if (segmentAnalysisRouteMatch) {
    return {
      mainPage: 'session',
      sessionSubpage: 'analysis',
      sessionId: decodeURIComponent(segmentAnalysisRouteMatch[1]),
      segmentId: decodeURIComponent(segmentAnalysisRouteMatch[2]),
      analysisTab
    };
  }

  const sessionRouteMatch = pathname.match(/^\/sessions\/([^/]+)(?:\/(segments|segments-edit|compare|settings|technical-info))?$/);
  if (sessionRouteMatch) {
    const subpage = sessionRouteMatch[2] === 'segments-edit'
      ? 'segmentEdit'
      : sessionRouteMatch[2] === 'settings'
        ? 'sessionSettings'
        : sessionRouteMatch[2] === 'technical-info'
          ? 'technicalInfo'
          : (sessionRouteMatch[2] as SessionSubpage | undefined);

    return {
      mainPage: 'session',
      sessionSubpage: subpage ?? 'analysis',
      sessionId: decodeURIComponent(sessionRouteMatch[1]),
      segmentId: null,
      analysisTab
    };
  }

  return { mainPage: 'sessions', sessionSubpage: 'analysis', sessionId: null, segmentId: null, analysisTab: null };
}

function getPathForRoute(mainPage: MainPage, sessionSubpage: SessionSubpage, sessionId: string | null, segmentId: string | null, analysisTab: SessionAnalysisTab | null): string {
  if (mainPage === 'upload') {
    return '/uploads';
  }

  if (mainPage === 'profile') {
    return '/profiles';
  }

  if (mainPage === 'session') {
    if (!sessionId) {
      return '/sessions';
    }

    const encodedSessionId = encodeURIComponent(sessionId);

    if (sessionSubpage === 'segments') {
      return `/sessions/${encodedSessionId}/segments`;
    }

    if (sessionSubpage === 'segmentEdit') {
      return `/sessions/${encodedSessionId}/segments-edit`;
    }

    if (sessionSubpage === 'compare') {
      return `/sessions/${encodedSessionId}/compare`;
    }

    if (sessionSubpage === 'sessionSettings') {
      return `/sessions/${encodedSessionId}/settings`;
    }

    if (sessionSubpage === 'technicalInfo') {
      return `/sessions/${encodedSessionId}/technical-info`;
    }

    if (sessionSubpage === 'analysis' && segmentId) {
      const base = `/sessions/${encodedSessionId}/segments/${encodeURIComponent(segmentId)}`;
      return analysisTab && analysisTab !== 'overview' ? `${base}?tab=${analysisTab}` : base;
    }

    const base = `/sessions/${encodedSessionId}`;
    return analysisTab && analysisTab !== 'overview' ? `${base}?tab=${analysisTab}` : base;
  }

  return '/sessions';
}

export function App() {
  const initialRoute = resolveRouteFromPath(window.location.pathname);
  const shouldAutoOpenFirstSession = window.location.pathname === '/';
  const browserLocale = resolveInitialLocale();
  const cachedAppearancePreferences = loadCachedAppearancePreferences();
  const initialLocale = cachedAppearancePreferences?.preferredLocale ?? browserLocale;
  const initialTheme = cachedAppearancePreferences?.preferredTheme ?? 'dark';
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSession, setSelectedSession] = useState<UploadRecord | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [compareOpponentSessionId, setCompareOpponentSessionId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sessionTypeFilters, setSessionTypeFilters] = useState<SessionType[]>([]);
  const [qualityStatusFilter, setQualityStatusFilter] = useState<'All' | ActivitySummary['qualityStatus']>('All');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [isHistoryFilterSidebarOpen, setIsHistoryFilterSidebarOpen] = useState(false);
  const [draftSortDirection, setDraftSortDirection] = useState<SortDirection>('desc');
  const [draftSessionTypeFilters, setDraftSessionTypeFilters] = useState<SessionType[]>([]);
  const [draftQualityStatusFilter, setDraftQualityStatusFilter] = useState<'All' | ActivitySummary['qualityStatus']>('All');
  const [draftDateFromFilter, setDraftDateFromFilter] = useState('');
  const [draftDateToFilter, setDraftDateToFilter] = useState('');
  const [isMetricInfoSidebarOpen, setIsMetricInfoSidebarOpen] = useState(false);
  const [activeMetricInfo, setActiveMetricInfo] = useState<{ label: string; helpText: string } | null>(null);
  const [showUploadQualityStep, setShowUploadQualityStep] = useState(false);
  const [message, setMessage] = useState<string>(translations[browserLocale].defaultMessage);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSessionDetailLoading, setIsSessionDetailLoading] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>('smoothed');
  const [selectedFilter, setSelectedFilter] = useState<SmoothingFilter>('AdaptiveMedian');
  const [aggregationWindowMinutes, setAggregationWindowMinutes] = useState<1 | 2 | 5>(5);
  const [peakDemandWindowMinutes, setPeakDemandWindowMinutes] = useState<1 | 2 | 5>(5);
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('rolling');
  const [timelineDensity, setTimelineDensity] = useState<'standard' | 'compact'>('compact');
  const [timelineCursorSecond, setTimelineCursorSecond] = useState(0);
  const [timelineCursorLocked, setTimelineCursorLocked] = useState(false);
  const [timelineScrollTarget, setTimelineScrollTarget] = useState<TimelineTrackKey | null>(null);
  const [timelineHighlightedWindow, setTimelineHighlightedWindow] = useState<{ startSecond: number; endSecond: number } | null>(null);
  const [timelineHighlightedPeakLabel, setTimelineHighlightedPeakLabel] = useState<string | null>(null);
  const [sessionContextForm, setSessionContextForm] = useState<SessionContext>({
    sessionType: 'Training',
    matchResult: null,
    competition: null,
    opponentName: null,
    opponentLogoUrl: null
  });
  const [segmentForm, setSegmentForm] = useState({ category: 'Other', label: '', startSecond: '0', endSecond: '300', notes: '' });
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [mergeForm, setMergeForm] = useState({ sourceSegmentId: '', targetSegmentId: '', label: '', notes: '' });
  const [splitForm, setSplitForm] = useState({ segmentId: '', splitSecond: '', leftLabel: '', rightLabel: '', notes: '' });
  const [segmentEditorsOpen, setSegmentEditorsOpen] = useState({ edit: false, merge: false, split: false });
  const [segmentActionError, setSegmentActionError] = useState<string | null>(null);
  const [segmentCursorSecond, setSegmentCursorSecond] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [analysisScope, setAnalysisScope] = useState<'session' | 'segment'>('session');
  const [profileForm, setProfileForm] = useState<UserProfile>({
    primaryPosition: 'CentralMidfielder',
    secondaryPosition: null,
    metricThresholds: {
      maxSpeedMps: 8.0,
      maxSpeedMode: 'Adaptive',
      maxHeartRateBpm: 190,
      maxHeartRateMode: 'Adaptive',
      sprintSpeedPercentOfMaxSpeed: 90,
      highIntensitySpeedPercentOfMaxSpeed: 70,
      moderateAccelerationThresholdMps2: 1.0,
      highAccelerationThresholdMps2: 1.8,
      veryHighAccelerationThresholdMps2: 2.5,
      moderateDecelerationThresholdMps2: -1.0,
      highDecelerationThresholdMps2: -1.8,
      veryHighDecelerationThresholdMps2: -2.5,
      accelDecelMinimumSpeedMps: 10 / 3.6,
      effectiveMaxSpeedMps: 8.0,
      effectiveMaxHeartRateBpm: 190,
      version: 1,
      updatedAtUtc: new Date().toISOString()
    },
    defaultSmoothingFilter: 'AdaptiveMedian',
    preferredSpeedUnit: 'km/h',
    preferredAggregationWindowMinutes: 5,
    comparisonSessionsCount: 5,
    preferredTheme: 'dark',
    preferredLocale: null
  });
  const [profileValidationMessage, setProfileValidationMessage] = useState<string | null>(null);
  const [latestProfileRecalculationJob, setLatestProfileRecalculationJob] = useState<ProfileRecalculationJob | null>(null);
  const [profileRecalculationToast, setProfileRecalculationToast] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeSessionSubpage, setActiveSessionSubpage] = useState<SessionSubpage>(initialRoute.sessionSubpage);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<SessionAnalysisTab>(initialRoute.analysisTab ?? 'overview');
  const [activeMainPage, setActiveMainPage] = useState<MainPage>(initialRoute.mainPage);
  const [activeSessionIdFromRoute, setActiveSessionIdFromRoute] = useState<string | null>(initialRoute.sessionId);
  const [activeSegmentIdFromRoute, setActiveSegmentIdFromRoute] = useState<string | null>(initialRoute.segmentId);
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [isInitialDataHydrated, setIsInitialDataHydrated] = useState(false);
  const [isSessionMenuVisible, setIsSessionMenuVisible] = useState(false);
  const shouldGateInitialRender = import.meta.env.MODE !== 'test' || (globalThis as { __ENABLE_INITIAL_HYDRATION_GATE__?: boolean }).__ENABLE_INITIAL_HYDRATION_GATE__ === true;
  const [analysisAccordionState, setAnalysisAccordionState] = useState<Record<AnalysisAccordionKey, boolean>>(() => {
    const expandedByDefault = import.meta.env.MODE === 'test';

    return {
      overviewVolume: true,
      overviewSpeed: true,
      overviewMechanical: true,
      overviewInternal: true,
      intervalAggregation: expandedByDefault,
      gpsHeatmap: expandedByDefault,
      gpsRunsMap: expandedByDefault,
      sessionContext: true,
      processingSettings: expandedByDefault,
      displaySettings: expandedByDefault,
      recalculationHistory: expandedByDefault,
      qualityDetails: expandedByDefault,
      thresholds: expandedByDefault,
      dangerZone: expandedByDefault
    };
  });

  const t = useMemo(() => {
    const localizedTranslations = translations[locale];

    return new Proxy(localizedTranslations, {
      get(target, property: string) {
        const key = property as TranslationKey;
        return target[key] ?? translations.en[key] ?? '';
      }
    }) as Record<TranslationKey, string>;
  }, [locale]);
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

  const defaultDateBounds = useMemo(() => {
    if (uploadHistory.length === 0) {
      return { from: '', to: '' };
    }

    const timestamps = uploadHistory.map((record) => new Date(record.summary.activityStartTimeUtc ?? record.uploadedAtUtc).getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    return {
      from: toDateInputValue(new Date(minTimestamp)),
      to: toDateInputValue(new Date(maxTimestamp))
    };
  }, [uploadHistory]);

  const filteredHistory = useMemo(() => sortedHistory.filter((record) => {
    const isSessionTypeMatch = sessionTypeFilters.length === 0 || sessionTypeFilters.includes(record.sessionContext.sessionType);
    const isQualityMatch = qualityStatusFilter === 'All' || record.summary.qualityStatus === qualityStatusFilter;
    const activityDate = record.summary.activityStartTimeUtc ? new Date(record.summary.activityStartTimeUtc) : new Date(record.uploadedAtUtc);

    const isAfterDateFrom = dateFromFilter
      ? activityDate >= new Date(`${dateFromFilter}T00:00:00`)
      : true;
    const isBeforeDateTo = dateToFilter
      ? activityDate <= new Date(`${dateToFilter}T23:59:59.999`)
      : true;

    return isSessionTypeMatch && isQualityMatch && isAfterDateFrom && isBeforeDateTo;
  }), [sortedHistory, sessionTypeFilters, qualityStatusFilter, dateFromFilter, dateToFilter]);

  const availableSessionTypes = useMemo(() => {
    const types = new Set<SessionType>();
    uploadHistory.forEach((record) => types.add(record.sessionContext.sessionType));
    return Array.from(types);
  }, [uploadHistory]);

  const activeHistoryFilterCount =
    (availableSessionTypes.length > 0 && sessionTypeFilters.length !== availableSessionTypes.length ? 1 : 0)
    + (qualityStatusFilter !== 'All' ? 1 : 0)
    + (dateFromFilter && dateFromFilter !== defaultDateBounds.from ? 1 : 0)
    + (dateToFilter && dateToFilter !== defaultDateBounds.to ? 1 : 0)
    + (sortDirection !== 'desc' ? 1 : 0);

  useEffect(() => {
    const onPopState = () => {
      const route = resolveRouteFromPath(window.location.pathname);
      setActiveMainPage(route.mainPage);
      setActiveSessionSubpage(route.sessionSubpage);
      setActiveSessionIdFromRoute(route.sessionId);
      setActiveSegmentIdFromRoute(route.segmentId);
      setActiveAnalysisTab(route.analysisTab ?? 'overview');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!isHistoryFilterSidebarOpen) {
      return;
    }

    setDraftSortDirection(sortDirection);
    setDraftSessionTypeFilters(sessionTypeFilters);
    setDraftQualityStatusFilter(qualityStatusFilter);
    setDraftDateFromFilter(dateFromFilter);
    setDraftDateToFilter(dateToFilter);
  }, [isHistoryFilterSidebarOpen, sortDirection, sessionTypeFilters, qualityStatusFilter, dateFromFilter, dateToFilter]);

  useEffect(() => {
    if (!defaultDateBounds.from || !defaultDateBounds.to) {
      return;
    }

    setDateFromFilter((current) => current || defaultDateBounds.from);
    setDateToFilter((current) => current || defaultDateBounds.to);
    setDraftDateFromFilter((current) => current || defaultDateBounds.from);
    setDraftDateToFilter((current) => current || defaultDateBounds.to);
    if (availableSessionTypes.length > 0) {
      setSessionTypeFilters((current) => current.length === 0 ? availableSessionTypes : current);
      setDraftSessionTypeFilters((current) => current.length === 0 ? availableSessionTypes : current);
    }
  }, [defaultDateBounds, availableSessionTypes]);

  useEffect(() => {
    const onOpenMetricHelp = (event: Event) => {
      const customEvent = event as CustomEvent<{ label: string; helpText: string }>;
      setActiveMetricInfo(customEvent.detail);
      setIsMetricInfoSidebarOpen(true);
    };

    window.addEventListener('metric-help-open', onOpenMetricHelp as EventListener);
    return () => window.removeEventListener('metric-help-open', onOpenMetricHelp as EventListener);
  }, []);

  useEffect(() => {
    if (!selectedSession || !compareOpponentSessionId) {
      return;
    }

    const stillValid = compareOpponentSessionId === selectedSession.id
      || sortedHistory.some((record) => record.id === compareOpponentSessionId && record.sessionContext.sessionType === selectedSession.sessionContext.sessionType);
    if (!stillValid) {
      setCompareOpponentSessionId(null);
    }
  }, [selectedSession, compareOpponentSessionId, sortedHistory]);

  useEffect(() => {
    const nextPath = getPathForRoute(
      activeMainPage,
      activeSessionSubpage,
      activeSessionIdFromRoute ?? selectedSession?.id ?? null,
      activeMainPage === 'session' && activeSessionSubpage === 'analysis' && analysisScope === 'segment' ? selectedSegmentId : null,
      activeMainPage === 'session' && activeSessionSubpage === 'analysis' ? activeAnalysisTab : null
    );
    const currentPathWithQuery = `${window.location.pathname}${window.location.search}`;

    if (currentPathWithQuery !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  }, [activeMainPage, activeSessionSubpage, activeSessionIdFromRoute, analysisScope, selectedSegmentId, selectedSession?.id, activeAnalysisTab]);

  useEffect(() => {
    if (activeMainPage === 'session' && !selectedSession) {
      setActiveMainPage('sessions');
    }
  }, [activeMainPage, selectedSession]);


  useEffect(() => {
    if (selectedSession) {
      setActiveSessionIdFromRoute(selectedSession.id);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    if (!activeSegmentIdFromRoute) {
      setAnalysisScope('session');
      return;
    }

    const segmentExists = selectedSession.segments.some((segment) => segment.id === activeSegmentIdFromRoute);
    if (!segmentExists) {
      setAnalysisScope('session');
      return;
    }

    setSelectedSegmentId(activeSegmentIdFromRoute);
    setAnalysisScope('segment');
    setActiveSessionSubpage('analysis');
  }, [activeSegmentIdFromRoute, selectedSession]);

  useEffect(() => {
    if (!selectedSession) {
      setSelectedSegmentId(null);
      return;
    }

    setSegmentCursorSecond(0);

    setSelectedSegmentId((current) => {
      if (current && selectedSession.segments.some((segment) => segment.id === current)) {
        return current;
      }

      return selectedSession.segments[0]?.id ?? null;
    });
  }, [selectedSession]);


  useEffect(() => {
    if (activeMainPage !== 'session' || !activeSessionIdFromRoute || uploadHistory.length === 0) {
      return;
    }

    if (selectedSession?.id === activeSessionIdFromRoute) {
      return;
    }

    const matchedSession = uploadHistory.find((item) => item.id === activeSessionIdFromRoute);
    if (!matchedSession) {
      setActiveMainPage('sessions');
      return;
    }

    setSelectedSession(matchedSession);
    setSelectedFilter(matchedSession.summary.smoothing.selectedStrategy as SmoothingFilter);
    setSessionContextForm(matchedSession.sessionContext);
    setIsSessionMenuVisible(true);
    setShowUploadQualityStep(false);

    if (!matchedSession.isDetailed) {
      void loadSessionDetailsById(matchedSession.id);
    }
  }, [activeMainPage, activeSessionIdFromRoute, selectedSession?.id, uploadHistory]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const response = await fetch(`${apiBaseUrl}/tcx`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as UploadRecord[];
        let profilePayload: UserProfile | null = null;
        try {
          const profileResponse = await fetch(`${apiBaseUrl}/profile`);
          profilePayload = profileResponse.ok ? (await profileResponse.json()) as UserProfile : null;
        } catch {
          profilePayload = null;
        }

        if (!cancelled) {
          if (profilePayload && typeof profilePayload.primaryPosition === 'string') {
            setProfileForm({
              primaryPosition: profilePayload.primaryPosition as PlayerPosition,
              secondaryPosition: (profilePayload.secondaryPosition as PlayerPosition | null) ?? null,
              metricThresholds: profilePayload.metricThresholds as MetricThresholdProfile,
              defaultSmoothingFilter: (profilePayload.defaultSmoothingFilter as SmoothingFilter) ?? 'AdaptiveMedian',
              preferredSpeedUnit: (profilePayload.preferredSpeedUnit as SpeedUnit) ?? 'km/h',
              preferredAggregationWindowMinutes: (profilePayload.preferredAggregationWindowMinutes as 1 | 2 | 5) ?? 5,
              comparisonSessionsCount: Number(profilePayload.comparisonSessionsCount ?? 5),
              preferredTheme: (profilePayload.preferredTheme as 'light' | 'dark') ?? 'dark',
              preferredLocale: (profilePayload.preferredLocale as Locale | null) ?? null
            });
            setTheme((profilePayload.preferredTheme as 'light' | 'dark') ?? 'dark');
            setLocale((profilePayload.preferredLocale as Locale | null) ?? browserLocale);
            setAggregationWindowMinutes((profilePayload.preferredAggregationWindowMinutes as 1 | 2 | 5) ?? 5);
            setLatestProfileRecalculationJob(profilePayload.latestRecalculationJob ?? null);
            persistAppearancePreferences({
              preferredTheme: (profilePayload.preferredTheme as 'light' | 'dark') ?? 'dark',
              preferredLocale: (profilePayload.preferredLocale as Locale | null) ?? null
            });
          }
          const normalizedPayload = payload.map(normalizeUploadRecord);
          setUploadHistory(normalizedPayload);

          if (normalizedPayload.length === 0) {
            if (initialRoute.mainPage === 'session') {
              setActiveMainPage('sessions');
            }
            return;
          }

          const routeSession = activeSessionIdFromRoute
            ? normalizedPayload.find((item) => item.id === activeSessionIdFromRoute) ?? null
            : null;

          const preferredSession = routeSession ?? normalizedPayload[0];
          setSelectedSession(preferredSession);
          setSelectedFilter(preferredSession.summary.smoothing.selectedStrategy as SmoothingFilter);
          setSessionContextForm(preferredSession.sessionContext);
          setShowUploadQualityStep(false);
          setCompareOpponentSessionId(normalizedPayload.find((item) => item.id !== preferredSession.id)?.id ?? null);

          if (initialRoute.mainPage === 'session') {
            setIsSessionMenuVisible(true);
            setActiveMainPage('session');
            setActiveSessionIdFromRoute(preferredSession.id);
            if (!preferredSession.isDetailed) {
              void loadSessionDetailsById(preferredSession.id);
            }
          } else if (initialRoute.mainPage === 'sessions' && shouldAutoOpenFirstSession) {
            setIsSessionMenuVisible(true);
            setActiveMainPage('session');
            setActiveSessionIdFromRoute(preferredSession.id);
            if (!preferredSession.isDetailed) {
              void loadSessionDetailsById(preferredSession.id);
            }
          } else {
            setIsSessionMenuVisible(false);
          }
        }
      } catch {
        // Intentionally ignore: upload still works and user gets feedback on action.
      } finally {
        if (!cancelled) {
          setIsInitialDataHydrated(true);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

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



  async function loadSessionDetailsById(sessionId: string): Promise<UploadRecord | null> {
    setIsSessionDetailLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/tcx/${sessionId}`);
      if (!response.ok) {
        return null;
      }

      const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
      setUploadHistory((previous) => previous.map((item) => (item.id === payload.id ? payload : item)));
      setSelectedSession((current) => (current && current.id === payload.id ? payload : current));
      setSelectedFilter(payload.summary.smoothing.selectedStrategy as SmoothingFilter);
      setSessionContextForm(payload.sessionContext);
      return payload;
    } finally {
      setIsSessionDetailLoading(false);
    }
  }

  function openSessionDetails(session: UploadRecord) {
    setSelectedSession(session);
    setCompareMode('smoothed');
    setSelectedFilter(session.summary.smoothing.selectedStrategy as SmoothingFilter);
    setSessionContextForm(session.sessionContext);
    setShowUploadQualityStep(false);
    setAnalysisScope('session');
    setActiveSessionSubpage('analysis');
    setActiveAnalysisTab('overview');
    setActiveSessionIdFromRoute(session.id);
    setActiveMainPage('session');
    setIsSessionMenuVisible(true);

    if (!session.isDetailed) {
      void loadSessionDetailsById(session.id);
    }
  }

  function applyUpdatedSession(payload: UploadRecord) {
    setSelectedSession(payload);
    setUploadHistory((previous) => previous.map((item) => (item.id === payload.id ? payload : item)));
    setSelectedFilter(payload.summary.smoothing.selectedStrategy as SmoothingFilter);
    setSessionContextForm(payload.sessionContext);
    setActiveSessionIdFromRoute(payload.id);
    setActiveMainPage('session');
    setShowUploadQualityStep(false);
    setIsSessionMenuVisible(true);
    setSelectedSegmentId((current) => {
      if (current && payload.segments.some((segment) => segment.id === current)) {
        return current;
      }

      return payload.segments[0]?.id ?? null;
    });
  }

  function resetSegmentForms() {
    setSegmentForm({ category: 'Other', label: '', startSecond: '0', endSecond: '300', notes: '' });
    setEditingSegmentId(null);
    setMergeForm({ sourceSegmentId: '', targetSegmentId: '', label: '', notes: '' });
    setSplitForm({ segmentId: '', splitSecond: '', leftLabel: '', rightLabel: '', notes: '' });
    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });
  }


  async function extractApiError(response: Response): Promise<string>
  {
    try
    {
      const payload = await response.json() as { detail?: string; title?: string };
      return payload.detail ?? payload.title ?? response.statusText;
    }
    catch
    {
      const text = await response.text();
      return text || response.statusText;
    }
  }

  async function onFilterChange(event: ChangeEvent<HTMLSelectElement>) {
    const filter = event.target.value as SmoothingFilter;
    setSelectedFilter(filter);

    if (!selectedSession) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}/smoothing-filter`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter })
    });

    if (!response.ok) {
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
  }


  async function onSpeedUnitChange(event: ChangeEvent<HTMLSelectElement>) {
    const speedUnit = event.target.value as SpeedUnit;

    if (!selectedSession) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}/speed-unit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speedUnit })
    });

    if (!response.ok) {
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
  }

  async function onRecalculateWithCurrentProfile() {
    if (!selectedSession) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}/recalculate`, { method: 'POST' });
    if (!response.ok) {
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
    setSelectedFilter(payload.summary.smoothing.selectedStrategy as SmoothingFilter);
    setSessionContextForm(payload.sessionContext);
    setActiveSessionIdFromRoute(payload.id);
    setActiveMainPage('session');
    setAggregationWindowMinutes(profileForm.preferredAggregationWindowMinutes);
    setMessage(t.sessionRecalculateSuccess);
  }


  async function onSaveSessionContext() {
    if (!selectedSession) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}/session-context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionContextForm)
    });

    if (!response.ok) {
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
      setSessionContextForm(payload.sessionContext);
      setActiveSessionIdFromRoute(payload.id);
      setActiveSessionSubpage('analysis');
      setActiveMainPage('session');
      setIsSessionMenuVisible(true);
    setMessage(t.sessionContextSaveSuccess);
  }


  async function onSaveSegment() {
    if (!selectedSession) {
      return;
    }

    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });

    if (!segmentForm.category.trim() || !segmentForm.label.trim() || segmentForm.startSecond.trim() === '' || segmentForm.endSecond.trim() === '') {
      setSegmentActionError(t.segmentValidationRequired);
      return;
    }

    const startSecond = Number(segmentForm.startSecond);
    const endSecond = Number(segmentForm.endSecond);
    if (Number.isNaN(startSecond) || Number.isNaN(endSecond) || startSecond < 0 || endSecond <= startSecond) {
      setSegmentActionError(t.segmentValidationRange);
      return;
    }

    const endpoint = editingSegmentId
      ? `${apiBaseUrl}/tcx/${selectedSession.id}/segments/${editingSegmentId}`
      : `${apiBaseUrl}/tcx/${selectedSession.id}/segments`;

    const body = editingSegmentId
      ? {
        category: segmentForm.category.trim(),
        label: segmentForm.label.trim(),
        startSecond,
        endSecond,
        notes: segmentForm.notes.trim() || null
      }
      : {
        category: segmentForm.category.trim(),
        label: segmentForm.label.trim(),
        startSecond,
        endSecond,
        notes: segmentForm.notes.trim() || null
      };

    const response = await fetch(endpoint, {
      method: editingSegmentId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await extractApiError(response);
      setSegmentActionError(`${t.segmentErrorPrefix} ${detail}`);
      setMessage(`${t.segmentErrorPrefix} ${detail}`);
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
    resetSegmentForms();
    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });
    setMessage(editingSegmentId ? t.segmentUpdateSuccess : t.segmentCreateSuccess);
  }

  function onEditSegment(segment: SessionSegment) {
    setEditingSegmentId(segment.id);
    setSegmentForm({
      category: segment.category ?? 'Other',
      label: segment.label,
      startSecond: String(segment.startSecond),
      endSecond: String(segment.endSecond),
      notes: segment.notes ?? ''
    });
    setSegmentEditorsOpen({ edit: true, merge: false, split: false });
    setSplitForm((current) => ({ ...current, segmentId: segment.id }));
  }

  async function onDeleteSegment(segmentId: string) {
    if (!selectedSession) {
      return;
    }

    const reasonQuery = segmentForm.notes.trim() ? `?notes=${encodeURIComponent(segmentForm.notes.trim())}` : '';
    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}/segments/${segmentId}${reasonQuery}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const detail = await extractApiError(response);
      setSegmentActionError(`${t.segmentErrorPrefix} ${detail}`);
      setMessage(`${t.segmentErrorPrefix} ${detail}`);
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });
    setMessage(t.segmentDeleteSuccess);
  }

  async function onMergeSegments() {
    if (!selectedSession) {
      return;
    }

    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });

    if (!mergeForm.sourceSegmentId || !mergeForm.targetSegmentId) {
      setSegmentActionError(t.segmentValidationMergeSelection);
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}/segments/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceSegmentId: mergeForm.sourceSegmentId,
        targetSegmentId: mergeForm.targetSegmentId,
        label: mergeForm.label.trim() || null,
        notes: mergeForm.notes.trim() || null
      })
    });

    if (!response.ok) {
      const detail = await extractApiError(response);
      setSegmentActionError(`${t.segmentErrorPrefix} ${detail}`);
      setMessage(`${t.segmentErrorPrefix} ${detail}`);
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });
    setMergeForm({ sourceSegmentId: '', targetSegmentId: '', label: '', notes: '' });
    setMessage(t.segmentMergeSuccess);
  }


  function onSetSegmentBoundaryFromCursor(boundary: 'start' | 'end') {
    if (!selectedSegment) {
      return;
    }

    setEditingSegmentId(selectedSegment.id);
    setSegmentCursorSecond((currentSecond) => {
      if (currentSecond < selectedSegment.startSecond) {
        return selectedSegment.startSecond;
      }
      if (currentSecond > selectedSegment.endSecond) {
        return selectedSegment.endSecond;
      }
      return currentSecond;
    });
    setSegmentForm((current) => {
      const currentStart = Number(current.startSecond);
      const currentEnd = Number(current.endSecond);
      const cursor = Math.max(selectedSegment.startSecond, Math.min(Math.floor(segmentCursorSecond), selectedSegment.endSecond));

      if (boundary === 'start') {
        const fallbackEnd = Number.isFinite(currentEnd) ? currentEnd : selectedSegment.endSecond;
        const boundedStart = Math.min(cursor, Math.max(selectedSegment.startSecond, fallbackEnd - 1));
        return { ...current, startSecond: String(boundedStart) };
      }

      const fallbackStart = Number.isFinite(currentStart) ? currentStart : selectedSegment.startSecond;
      const boundedEnd = Math.max(cursor, Math.min(selectedSegment.endSecond, fallbackStart + 1));
      return { ...current, endSecond: String(boundedEnd) };
    });
    setSegmentEditorsOpen({ edit: true, merge: false, split: false });
  }

  async function onSplitAtCursor() {
    if (!selectedSession || !selectedSegment) {
      return;
    }

    const splitSecond = Math.floor(segmentCursorSecond);
    if (splitSecond <= selectedSegment.startSecond || splitSecond >= selectedSegment.endSecond) {
      setSegmentActionError(t.segmentValidationSplitSecond);
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}/segments/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segmentId: selectedSegment.id,
        splitSecond,
        leftLabel: null,
        rightLabel: null,
        notes: `Split at cursor ${formatSecondsMmSs(splitSecond)} (${splitSecond}s)`
      })
    });

    if (!response.ok) {
      const detail = await extractApiError(response);
      setSegmentActionError(`${t.segmentErrorPrefix} ${detail}`);
      setMessage(`${t.segmentErrorPrefix} ${detail}`);
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });
    setMessage(t.segmentSplitSuccess);
  }

  async function onSplitSegment() {
    if (!selectedSession) {
      return;
    }

    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });

    if (!splitForm.segmentId || splitForm.splitSecond.trim() === '') {
      setSegmentActionError(t.segmentValidationSplitSecond);
      return;
    }

    const splitSecond = Number(splitForm.splitSecond);
    if (Number.isNaN(splitSecond)) {
      setSegmentActionError(t.segmentValidationSplitSecond);
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}/segments/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segmentId: splitForm.segmentId,
        splitSecond,
        leftLabel: splitForm.leftLabel.trim() || null,
        rightLabel: splitForm.rightLabel.trim() || null,
        notes: splitForm.notes.trim() || null
      })
    });

    if (!response.ok) {
      const detail = await extractApiError(response);
      setSegmentActionError(`${t.segmentErrorPrefix} ${detail}`);
      setMessage(`${t.segmentErrorPrefix} ${detail}`);
      return;
    }

    const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
    applyUpdatedSession(payload);
    setSegmentActionError(null);
    setSegmentEditorsOpen({ edit: false, merge: false, split: false });
    setSplitForm({ segmentId: '', splitSecond: '', leftLabel: '', rightLabel: '', notes: '' });
    setMessage(translations[locale].defaultMessage);
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

      const payload = normalizeUploadRecord((await response.json()) as UploadRecord);
      const uploadTime = formatLocalDateTime(payload.uploadedAtUtc);
      setMessage(interpolate(t.uploadSuccess, { fileName: payload.fileName, uploadTime }));
      setSelectedSession(payload);
      resetSegmentForms();
      setCompareMode('smoothed');
      setSelectedFilter(payload.summary.smoothing.selectedStrategy as SmoothingFilter);
      setSessionContextForm(payload.sessionContext);
      setActiveSessionIdFromRoute(payload.id);
      setActiveSessionSubpage('analysis');
      setActiveMainPage('session');
      setShowUploadQualityStep(true);
      setIsSessionMenuVisible(true);
      setAggregationWindowMinutes(profileForm.preferredAggregationWindowMinutes);
      setUploadHistory((previous) => [payload, ...previous.filter((item) => item.id !== payload.id)]);
      setCompareOpponentSessionId(null);
      setSelectedFile(null);
    } catch {
      setMessage(`${t.uploadFailedPrefix} Network error.`);
    } finally {
      setIsUploading(false);
    }
  }



  async function onDeleteSession() {
    if (!selectedSession) {
      return;
    }

    if (!window.confirm(t.sessionDeleteConfirm)) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tcx/${selectedSession.id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      setMessage(t.sessionDeleteFailed);
      return;
    }

    const remainingSessions = uploadHistory.filter((item) => item.id !== selectedSession.id);
    setUploadHistory(remainingSessions);
    setSelectedSession(null);
    setCompareOpponentSessionId(null);
    setShowUploadQualityStep(false);
    setActiveSessionSubpage('analysis');
    setActiveSessionIdFromRoute(null);
    setActiveMainPage('sessions');
    setIsSessionMenuVisible(false);
    setMessage(t.sessionDeleteSuccess);
  }

  async function onThemeSelect(nextTheme: 'light' | 'dark') {
    setTheme(nextTheme);
    setProfileForm((current) => ({ ...current, preferredTheme: nextTheme }));
    persistAppearancePreferences({ preferredTheme: nextTheme, preferredLocale: profileForm.preferredLocale });

    try {
      const response = await fetch(`${apiBaseUrl}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profileForm, preferredTheme: nextTheme, preferredLocale: profileForm.preferredLocale })
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as UserProfile;
      setProfileForm({
        primaryPosition: payload.primaryPosition,
        secondaryPosition: payload.secondaryPosition,
        metricThresholds: payload.metricThresholds,
        defaultSmoothingFilter: payload.defaultSmoothingFilter,
        preferredSpeedUnit: payload.preferredSpeedUnit,
        preferredAggregationWindowMinutes: payload.preferredAggregationWindowMinutes,
        comparisonSessionsCount: payload.comparisonSessionsCount,
        preferredTheme: payload.preferredTheme,
        preferredLocale: (payload.preferredLocale as Locale | null) ?? null
      });
      setTheme(payload.preferredTheme);
      setLocale((payload.preferredLocale as Locale | null) ?? browserLocale);
      persistAppearancePreferences({ preferredTheme: payload.preferredTheme, preferredLocale: (payload.preferredLocale as Locale | null) ?? null });
    } catch {
      // keep local selection even if persistence fails
    }
  }

  async function onProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileValidationMessage(null);

    if (!profileForm.primaryPosition) {
      setProfileValidationMessage(t.profileValidationPrimaryRequired);
      return;
    }

    if (profileForm.secondaryPosition && profileForm.secondaryPosition === profileForm.primaryPosition) {
      setProfileValidationMessage(t.profileValidationSecondaryDistinct);
      return;
    }

    const response = await fetch(`${apiBaseUrl}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profileForm, preferredTheme: theme, preferredLocale: profileForm.preferredLocale })
    });

    if (!response.ok) {
      setProfileValidationMessage(`${t.uploadFailedPrefix} ${await response.text()}`);
      return;
    }

    const payload = (await response.json()) as UserProfile;
    setProfileForm({
      primaryPosition: payload.primaryPosition,
      secondaryPosition: payload.secondaryPosition,
      metricThresholds: payload.metricThresholds,
      defaultSmoothingFilter: payload.defaultSmoothingFilter,
      preferredSpeedUnit: payload.preferredSpeedUnit,
      preferredAggregationWindowMinutes: payload.preferredAggregationWindowMinutes,
      comparisonSessionsCount: payload.comparisonSessionsCount,
      preferredTheme: payload.preferredTheme,
      preferredLocale: (payload.preferredLocale as Locale | null) ?? null
    });
    setTheme(payload.preferredTheme);
    setLocale((payload.preferredLocale as Locale | null) ?? browserLocale);
    setAggregationWindowMinutes(payload.preferredAggregationWindowMinutes);
    setLatestProfileRecalculationJob(payload.latestRecalculationJob ?? null);
    persistAppearancePreferences({ preferredTheme: payload.preferredTheme, preferredLocale: (payload.preferredLocale as Locale | null) ?? null });
    setProfileValidationMessage(t.profileSaveSuccess);
  }


  async function onTriggerProfileRecalculation() {
    const response = await fetch(`${apiBaseUrl}/profile/recalculations`, { method: 'POST' });
    if (!response.ok) {
      setProfileValidationMessage(`${t.uploadFailedPrefix} ${await response.text()}`);
      return;
    }

    const payload = (await response.json()) as ProfileRecalculationJob;
    setLatestProfileRecalculationJob(payload);
    setProfileValidationMessage(t.profileRecalculateAllTriggered);
  }

  const profileRecalculationStatusText = latestProfileRecalculationJob
    ? (latestProfileRecalculationJob.status === 'Running'
      ? t.profileRecalculationStatusRunning
      : latestProfileRecalculationJob.status === 'Completed'
        ? t.profileRecalculationStatusCompleted
        : t.profileRecalculationStatusFailed)
    : null;

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


  useEffect(() => {
    if (!latestProfileRecalculationJob || latestProfileRecalculationJob.status !== 'Running') {
      return;
    }

    const interval = setInterval(async () => {
      const response = await fetch(`${apiBaseUrl}/profile`);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as UserProfile;
      setLatestProfileRecalculationJob(payload.latestRecalculationJob ?? null);
    }, 2000);

    return () => clearInterval(interval);
  }, [apiBaseUrl, latestProfileRecalculationJob]);

  const previousRecalculationStatusRef = useRef<ProfileRecalculationJob['status'] | null>(null);
  useEffect(() => {
    const previousStatus = previousRecalculationStatusRef.current;
    const currentStatus = latestProfileRecalculationJob?.status ?? null;

    if (previousStatus === 'Running' && currentStatus && currentStatus !== 'Running') {
      const statusText = currentStatus === 'Completed'
        ? t.profileRecalculationStatusCompleted
        : t.profileRecalculationStatusFailed;
      setProfileRecalculationToast(`${t.profileRecalculationStatusTitle}: ${statusText}`);
    }

    previousRecalculationStatusRef.current = currentStatus;
  }, [latestProfileRecalculationJob?.status, t.profileRecalculationStatusCompleted, t.profileRecalculationStatusFailed, t.profileRecalculationStatusTitle]);

  useEffect(() => {
    if (!profileRecalculationToast) {
      return;
    }

    const timeout = setTimeout(() => setProfileRecalculationToast(null), 7000);
    return () => clearTimeout(timeout);
  }, [profileRecalculationToast]);

  const showMissingHeartRateHint = selectedSession ? !hasCompleteHeartRate(selectedSession.summary) : false;
  const showMissingDistanceHint = selectedSession ? selectedSession.summary.distanceMeters === null : false;
  const showMissingGpsHint = selectedSession ? !selectedSession.summary.hasGpsData : false;

  const activeDistanceMeters = selectedSession
    ? compareMode === 'raw'
      ? selectedSession.summary.smoothing.rawDistanceMeters
      : selectedSession.summary.smoothing.smoothedDistanceMeters ?? selectedSession.summary.distanceMeters
    : null;

  const selectedSegment = selectedSession?.segments.find((segment) => segment.id === selectedSegmentId) ?? selectedSession?.segments[0] ?? null;
  const segmentAssistantPoints = useMemo(() => {
    const allPoints = (selectedSession?.summary.gpsTrackpoints ?? [])
      .filter((point): point is GpsTrackpoint & { elapsedSeconds: number } => point.elapsedSeconds !== null)
      .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

    if (!selectedSegment) {
      return allPoints;
    }

    return allPoints.filter((point) => point.elapsedSeconds >= selectedSegment.startSecond && point.elapsedSeconds <= selectedSegment.endSecond);
  }, [selectedSession, selectedSegment]);
  const segmentAssistantBounds = useMemo(() => {
    if (segmentAssistantPoints.length === 0) {
      return null;
    }

    return {
      minLatitude: Math.min(...segmentAssistantPoints.map((point) => point.latitude)),
      maxLatitude: Math.max(...segmentAssistantPoints.map((point) => point.latitude)),
      minLongitude: Math.min(...segmentAssistantPoints.map((point) => point.longitude)),
      maxLongitude: Math.max(...segmentAssistantPoints.map((point) => point.longitude))
    };
  }, [segmentAssistantPoints]);
  const segmentAssistantMaxSecond = selectedSegment
    ? selectedSegment.endSecond
    : Math.max(0, Math.floor(selectedSession?.summary.durationSeconds ?? segmentAssistantPoints.at(-1)?.elapsedSeconds ?? 0));
  const segmentAssistantMinSecond = selectedSegment?.startSecond ?? 0;
  const clampedSegmentCursorSecond = Math.min(Math.max(segmentCursorSecond, segmentAssistantMinSecond), segmentAssistantMaxSecond);
  const isSegmentScopeActive = analysisScope === 'segment' && selectedSegment !== null;

  useEffect(() => {
    if (activeSessionSubpage !== 'segmentEdit' || !selectedSegment) {
      return;
    }

    setEditingSegmentId(selectedSegment.id);
    setSegmentCursorSecond((currentSecond) => {
      if (currentSecond < selectedSegment.startSecond || currentSecond > selectedSegment.endSecond) {
        return selectedSegment.startSecond;
      }

      return currentSecond;
    });
    setSegmentForm((current) => {
      const currentStart = Number(current.startSecond);
      const currentEnd = Number(current.endSecond);
      const withinSelectedRange = Number.isFinite(currentStart)
        && Number.isFinite(currentEnd)
        && currentStart >= selectedSegment.startSecond
        && currentEnd <= selectedSegment.endSecond
        && currentEnd > currentStart;

      if (withinSelectedRange) {
        return current;
      }

      return {
        category: selectedSegment.category ?? 'Other',
        label: selectedSegment.label,
        startSecond: String(selectedSegment.startSecond),
        endSecond: String(selectedSegment.endSecond),
        notes: selectedSegment.notes ?? ''
      };
    });
  }, [activeSessionSubpage, selectedSegment]);

  const analysisTimeRange = useMemo(() => {
    if (!selectedSession) {
      return { startSecond: 0, endSecond: 0 };
    }

    if (isSegmentScopeActive && selectedSegment) {
      return { startSecond: selectedSegment.startSecond, endSecond: selectedSegment.endSecond };
    }

    const elapsedSeconds = (selectedSession.summary.gpsTrackpoints ?? [])
      .map((point) => point.elapsedSeconds)
      .filter((value): value is number => value !== null);

    const durationEndSecond = selectedSession.summary.durationSeconds ?? 0;
    const maxElapsedSecond = elapsedSeconds.length > 0 ? Math.max(...elapsedSeconds) : 0;
    const fallbackEndSecond = Math.max(durationEndSecond, maxElapsedSecond);

    return { startSecond: 0, endSecond: Math.max(0, fallbackEndSecond) };
  }, [selectedSession, isSegmentScopeActive, selectedSegment]);

  const normalizedGpsTrackpoints = useMemo(() => (selectedSession?.summary.gpsTrackpoints ?? [])
    .filter((point): point is GpsTrackpoint & { elapsedSeconds: number } => point.elapsedSeconds !== null)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds), [selectedSession]);

  const analysisTrackpointSelection = useMemo(() => {
    if (!selectedSession) {
      return {
        points: [] as GpsTrackpoint[],
        pointIndexToAnalysisIndex: new Map<number, number>()
      };
    }

    const pointIndexToAnalysisIndex = new Map<number, number>();
    const points: GpsTrackpoint[] = [];

    normalizedGpsTrackpoints.forEach((point, pointIndex) => {
      const isBeforeRange = point.elapsedSeconds < analysisTimeRange.startSecond;
      const isAfterOrAtEnd = isSegmentScopeActive
        ? point.elapsedSeconds >= analysisTimeRange.endSecond
        : point.elapsedSeconds > analysisTimeRange.endSecond;
      if (isBeforeRange || isAfterOrAtEnd) {
        return;
      }

      pointIndexToAnalysisIndex.set(pointIndex, points.length);
      points.push(point);
    });

    return {
      points,
      pointIndexToAnalysisIndex
    };
  }, [selectedSession, analysisTimeRange, normalizedGpsTrackpoints]);

  const selectedGpsTrackpoints = analysisTrackpointSelection.points;

  const selectedDetectedRuns = useMemo(() => {
    if (!selectedSession) {
      return [] as DetectedRun[];
    }

    const detectedRuns = selectedSession.summary.detectedRuns ?? [];
    if (detectedRuns.length === 0 || analysisTrackpointSelection.points.length === 0) {
      return [] as DetectedRun[];
    }

    const isPointInActiveAnalysisRange = (pointIndex: number) => analysisTrackpointSelection.pointIndexToAnalysisIndex.has(pointIndex);
    const pointElapsedByIndex = (pointIndex: number) => normalizedGpsTrackpoints[pointIndex]?.elapsedSeconds;

    const isRunOwnedByActiveSegment = (run: DetectedRun) => {
      if (!isSegmentScopeActive || !selectedSegment) {
        return true;
      }

      const earliestPointElapsed = run.pointIndices
        .map((pointIndex) => pointElapsedByIndex(pointIndex))
        .filter((elapsed): elapsed is number => Number.isFinite(elapsed))
        .sort((a, b) => a - b)[0];

      if (Number.isFinite(earliestPointElapsed)) {
        return earliestPointElapsed >= selectedSegment.startSecond
          && earliestPointElapsed < selectedSegment.endSecond;
      }

      if (Number.isFinite(run.startElapsedSeconds)) {
        return run.startElapsedSeconds >= selectedSegment.startSecond
          && run.startElapsedSeconds < selectedSegment.endSecond;
      }

      return false;
    };

    const remapPointIndices = (indices: number[]) => indices
      .map((index) => analysisTrackpointSelection.pointIndexToAnalysisIndex.get(index))
      .filter((index): index is number => index !== undefined);

    return detectedRuns
      .filter((run) => isRunOwnedByActiveSegment(run))
      .map((run) => {
        const remappedPointIndices = remapPointIndices(run.pointIndices);
        if (remappedPointIndices.length === 0) {
          return null;
        }

        const remappedSprintPhases = (run.sprintPhases ?? [])
          .map((phase) => {
            if (isSegmentScopeActive && selectedSegment) {
              const earliestPhasePointElapsed = phase.pointIndices
                .map((pointIndex) => pointElapsedByIndex(pointIndex))
                .filter((elapsed): elapsed is number => Number.isFinite(elapsed))
                .sort((a, b) => a - b)[0];

              if (Number.isFinite(earliestPhasePointElapsed)) {
                const isPhaseOwnedBySegment = earliestPhasePointElapsed >= selectedSegment.startSecond
                  && earliestPhasePointElapsed < selectedSegment.endSecond;
                if (!isPhaseOwnedBySegment) {
                  return null;
                }
              } else if (Number.isFinite(phase.startElapsedSeconds)) {
                const isPhaseOwnedBySegment = phase.startElapsedSeconds >= selectedSegment.startSecond
                  && phase.startElapsedSeconds < selectedSegment.endSecond;
                if (!isPhaseOwnedBySegment) {
                  return null;
                }
              } else {
                if (phase.pointIndices.length === 0) {
                  return null;
                }

                const earliestPhasePointIndex = Math.min(...phase.pointIndices);
                if (!isPointInActiveAnalysisRange(earliestPhasePointIndex)) {
                  return null;
                }
              }
            }

            const remappedPhaseIndices = remapPointIndices(phase.pointIndices);
            if (remappedPhaseIndices.length === 0) {
              return null;
            }

            return {
              ...phase,
              pointIndices: remappedPhaseIndices
            } satisfies SprintPhase;
          })
          .filter((phase): phase is SprintPhase => phase !== null);

        return {
          ...run,
          pointIndices: remappedPointIndices,
          sprintPhases: remappedSprintPhases
        } satisfies DetectedRun;
      })
      .filter((run): run is DetectedRun => run !== null);
  }, [selectedSession, analysisTrackpointSelection, isSegmentScopeActive, selectedSegment, normalizedGpsTrackpoints]);


  const segmentRunDerivedMetrics = useMemo(() => {
    if (!isSegmentScopeActive) {
      return null;
    }

    const highIntensityRuns = selectedDetectedRuns.filter((run) => run.runType === 'highIntensity');
    const sprintPhases = highIntensityRuns.flatMap((run) => run.sprintPhases ?? []);

    return {
      highIntensityRunCount: highIntensityRuns.length,
      highIntensityTimeSeconds: highIntensityRuns.reduce((sum, run) => sum + Math.max(0, run.durationSeconds), 0),
      highSpeedDistanceMeters: highIntensityRuns.reduce((sum, run) => sum + run.distanceMeters, 0),
      sprintCount: sprintPhases.length,
      sprintDistanceMeters: sprintPhases.reduce((sum, phase) => sum + phase.distanceMeters, 0)
    };
  }, [isSegmentScopeActive, selectedDetectedRuns]);


  const segmentSpeedDerivedMetrics = useMemo(() => {
    if (!isSegmentScopeActive || !selectedSession) {
      return null;
    }

    const orderedPoints = selectedGpsTrackpoints
      .filter((point): point is GpsTrackpoint & { elapsedSeconds: number } => point.elapsedSeconds !== null)
      .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

    if (orderedPoints.length < 2) {
      return {
        maxSpeedMetersPerSecond: null,
        highIntensityTimeSeconds: segmentRunDerivedMetrics?.highIntensityTimeSeconds ?? null,
        highSpeedDistanceMeters: segmentRunDerivedMetrics?.highSpeedDistanceMeters ?? null
      };
    }

    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const distanceMetersBetween = (first: GpsTrackpoint, second: GpsTrackpoint) => {
      const dLat = toRadians(second.latitude - first.latitude);
      const dLon = toRadians(second.longitude - first.longitude);
      const lat1 = toRadians(first.latitude);
      const lat2 = toRadians(second.latitude);
      const a = (Math.sin(dLat / 2) ** 2)
        + (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2));
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return 6371000 * c;
    };

    let maxSpeedMetersPerSecond = 0;
    let highIntensityTimeSeconds = 0;
    let highSpeedDistanceMeters = 0;
    const highIntensityThresholdRaw = selectedSession.summary.coreMetrics.thresholds.HighIntensitySpeedThresholdMps;
    const parsedHighIntensityThreshold = highIntensityThresholdRaw ? Number(highIntensityThresholdRaw) : Number.NaN;
    const highIntensityThresholdMps = Number.isFinite(parsedHighIntensityThreshold) ? parsedHighIntensityThreshold : null;

    for (let index = 1; index < orderedPoints.length; index += 1) {
      const previous = orderedPoints[index - 1];
      const current = orderedPoints[index];
      const elapsed = current.elapsedSeconds - previous.elapsedSeconds;
      if (elapsed <= 0) {
        continue;
      }

      const distanceMeters = distanceMetersBetween(previous, current);
      const speedMetersPerSecond = distanceMeters / elapsed;
      if (speedMetersPerSecond > maxSpeedMetersPerSecond) {
        maxSpeedMetersPerSecond = speedMetersPerSecond;
      }

      if (highIntensityThresholdMps !== null && speedMetersPerSecond >= highIntensityThresholdMps) {
        highIntensityTimeSeconds += elapsed;
        highSpeedDistanceMeters += distanceMeters;
      }
    }

    return {
      maxSpeedMetersPerSecond: maxSpeedMetersPerSecond > 0 ? maxSpeedMetersPerSecond : null,
      highIntensityTimeSeconds,
      highSpeedDistanceMeters
    };
  }, [isSegmentScopeActive, selectedSession, selectedGpsTrackpoints, segmentRunDerivedMetrics]);

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
        : formatDistanceDeltaMeters(distanceDeltaMeters, t.notAvailable);

      return interpolate(t.metricDataChangeHelp, {
        correctedShare,
        correctedPoints: String(selectedSession.summary.smoothing.correctedOutlierCount),
        trackpoints: String(selectedSession.summary.trackpointCount),
        distanceDelta
      });
    })()
    : '';

  const selectedFilterDescription = t[getFilterDescriptionKey(selectedFilter)];

  const qualityDetails = selectedSession ? resolveDataAvailability(selectedSession.summary) : null;
  const qualityImpactItems = selectedSession
    ? [
      ...selectedSession.summary.qualityReasons,
      qualityDetails?.gpsReason,
      qualityDetails?.heartRateReason
    ].filter((reason, index, items): reason is string => Boolean(reason) && items.indexOf(reason) === index).slice(0, 4)
    : [];

  const displayedMaxSpeedMps = profileForm.metricThresholds.maxSpeedMode === 'Adaptive'
    ? profileForm.metricThresholds.effectiveMaxSpeedMps
    : profileForm.metricThresholds.maxSpeedMps;

  const displayedMaxHeartRateBpm = profileForm.metricThresholds.maxHeartRateMode === 'Adaptive'
    ? profileForm.metricThresholds.effectiveMaxHeartRateBpm
    : profileForm.metricThresholds.maxHeartRateBpm;

  const sprintThresholdMpsPreview = displayedMaxSpeedMps * (profileForm.metricThresholds.sprintSpeedPercentOfMaxSpeed / 100);
  const highIntensityThresholdMpsPreview = displayedMaxSpeedMps * (profileForm.metricThresholds.highIntensitySpeedPercentOfMaxSpeed / 100);
  const displayedMaxSpeedByPreferredUnit = convertSpeedFromMetersPerSecond(displayedMaxSpeedMps, profileForm.preferredSpeedUnit);
  const displayedAccelDecelMinSpeedByPreferredUnit = convertSpeedFromMetersPerSecond(profileForm.metricThresholds.accelDecelMinimumSpeedMps, profileForm.preferredSpeedUnit);

  const activeSessionType = selectedSession?.sessionContext.sessionType ?? null;
  const compareSelectableSessions = activeSessionType && selectedSession
    ? sortedHistory.filter((record) => record.sessionContext.sessionType === activeSessionType && record.id !== selectedSession.id)
    : [];

  const readComparisonMetric = useCallback((scope: 'overview' | 'peak', metric: string) => {
    const context = selectedSession?.comparisonContext;
    if (!context) {
      return { averageLastFive: null, bestSeason: null };
    }

    if (scope === 'overview') {
      if (isSegmentScopeActive && selectedSegment && selectedSegment.category) {
        const categoryMetrics = context.segmentOverviewByCategory?.[selectedSegment.category];
        const item = categoryMetrics?.[metric];
        return { averageLastFive: item?.averageLastN ?? null, bestSeason: item?.best ?? null };
      }

      const item = context.overview?.[metric];
      return { averageLastFive: item?.averageLastN ?? null, bestSeason: item?.best ?? null };
    }

    if (isSegmentScopeActive && selectedSegment && selectedSegment.category) {
      const categoryMetrics = context.segmentPeakByCategory?.[selectedSegment.category];
      const item = categoryMetrics?.[metric]?.[peakDemandWindowMinutes];
      return { averageLastFive: item?.averageLastN ?? null, bestSeason: item?.best ?? null };
    }

    const item = context.peak?.[metric]?.[peakDemandWindowMinutes];
    return { averageLastFive: item?.averageLastN ?? null, bestSeason: item?.best ?? null };
  }, [isSegmentScopeActive, peakDemandWindowMinutes, selectedSegment, selectedSession?.comparisonContext]);

  const distanceComparison = readComparisonMetric('overview', 'distanceMeters');
  const durationComparison = readComparisonMetric('overview', 'durationSeconds');
  const runningDensityComparison = readComparisonMetric('overview', 'runningDensityMetersPerMinute');
  const maxSpeedComparison = readComparisonMetric('overview', 'maxSpeedMetersPerSecond');
  const highSpeedDistanceComparison = readComparisonMetric('overview', 'highSpeedDistanceMeters');
  const heartRateAvgComparison = readComparisonMetric('overview', 'heartRateAverageBpm');
  const trimpComparison = readComparisonMetric('overview', 'trainingImpulseEdwards');
  const hrRecoveryComparison = readComparisonMetric('overview', 'heartRateRecoveryAfter60Seconds');

  const distancePeakComparison = readComparisonMetric('peak', 'distance');
  const highSpeedDistancePeakComparison = readComparisonMetric('peak', 'highSpeedDistance');
  const heartRatePeakComparison = readComparisonMetric('peak', 'heartRateAvg');
  const trimpPeakComparison = readComparisonMetric('peak', 'trimp');
  const mechanicalPeakComparison = readComparisonMetric('peak', 'mechanicalLoad');

  const compareOpponentSession = compareOpponentSessionId && selectedSession
    ? compareOpponentSessionId === selectedSession.id
      ? selectedSession
      : compareSelectableSessions.find((record) => record.id === compareOpponentSessionId) ?? null
    : null;

  const compareSessions = selectedSession && compareOpponentSession
    ? [selectedSession, compareOpponentSession]
    : selectedSession
      ? [selectedSession]
      : [];

  const compareBaseline = selectedSession;
  const showCompareQualityWarning = compareSessions.length >= 2
    ? new Set(compareSessions.map((record) => record.summary.qualityStatus)).size > 1
    : false;

  const compareMetrics = [
    {
      key: 'distance',
      label: t.sessionCompareMetricDistance,
      getter: (session: UploadRecord) => session.summary.distanceMeters ?? null,
      formatter: (value: number | null, currentLocale: Locale, notAvailable: string) => formatDistance(value, currentLocale, notAvailable)
    },
    {
      key: 'duration',
      label: t.sessionCompareMetricDuration,
      getter: (session: UploadRecord) => session.summary.durationSeconds ?? null,
      formatter: (value: number | null, currentLocale: Locale, notAvailable: string) => formatDuration(value, notAvailable)
    },
    {
      key: 'heartRateAverage',
      label: t.sessionCompareMetricHeartRateAverage,
      getter: (session: UploadRecord) => session.summary.heartRateAverageBpm ?? null,
      formatter: (value: number | null, currentLocale: Locale, notAvailable: string) => formatNumber(value, currentLocale, notAvailable, 1)
    },
    {
      key: 'directionChanges',
      label: t.sessionCompareMetricDirectionChanges,
      getter: (session: UploadRecord) => session.summary.coreMetrics.directionChanges ?? null,
      formatter: (value: number | null, currentLocale: Locale, notAvailable: string) => formatNumber(value, currentLocale, notAvailable, 1)
    },
    {
      key: 'sprintDistance',
      label: t.sessionCompareMetricSprintDistance,
      getter: (session: UploadRecord) => session.summary.coreMetrics.sprintDistanceMeters ?? null,
      formatter: (value: number | null, currentLocale: Locale, notAvailable: string) => formatDistanceComparison(value, currentLocale, notAvailable)
    },
    {
      key: 'sprintCount',
      label: t.sessionCompareMetricSprintCount,
      getter: (session: UploadRecord) => session.summary.coreMetrics.sprintCount ?? null,
      formatter: (value: number | null, currentLocale: Locale, notAvailable: string) => formatNumber(value, currentLocale, notAvailable, 0)
    },
    {
      key: 'highIntensityTime',
      label: t.sessionCompareMetricHighIntensityTime,
      getter: (session: UploadRecord) => session.summary.coreMetrics.highIntensityTimeSeconds ?? null,
      formatter: (value: number | null, currentLocale: Locale, notAvailable: string) => formatDuration(value, notAvailable)
    },
    {
      key: 'trainingLoad',
      label: t.sessionCompareMetricTrainingLoad,
      getter: (session: UploadRecord) => session.summary.coreMetrics.trainingImpulseEdwards ?? null,
      formatter: (value: number | null, currentLocale: Locale, notAvailable: string) => formatNumber(value, currentLocale, notAvailable, 1)
    },
    {
      key: 'dataMode',
      label: t.sessionCompareMetricDataMode,
      getter: (session: UploadRecord) => dataModeText(resolveDataAvailability(session.summary).mode, t),
      formatter: (value: string | null, _currentLocale: Locale, notAvailable: string) => value ?? notAvailable
    }
  ];

  const comparisonRows = compareMetrics.map((metric) => {
    const baselineValue = compareBaseline ? metric.getter(compareBaseline) : null;

    const cells: SessionComparisonCell[] = compareSessions.map((record) => {
      const value = metric.getter(record);
      let deltaText = t.notAvailable;
      let deltaPercentText = t.notAvailable;

      if (typeof baselineValue === 'number' && typeof value === 'number') {
        const delta = value - baselineValue;
        deltaText = formatSignedNumber(delta, locale, 1);

        if (baselineValue !== 0) {
          const deltaPercent = (delta / baselineValue) * 100;
          deltaPercentText = `${formatSignedNumber(deltaPercent, locale, 1)}%`;
        }
      }

      return {
        formattedValue: metric.formatter(value, t.notAvailable),
        deltaText,
        deltaPercentText
      };
    });

    return {
      key: metric.key,
      label: metric.label,
      cells
    };
  });
  const heatmapData = useMemo(() => {
    if (!selectedSession) {
      return null;
    }

    const points = selectedGpsTrackpoints;
    if (points.length === 0) {
      return null;
    }

    const minLatitude = Math.min(...points.map((point) => point.latitude));
    const maxLatitude = Math.max(...points.map((point) => point.latitude));
    const minLongitude = Math.min(...points.map((point) => point.longitude));
    const maxLongitude = Math.max(...points.map((point) => point.longitude));

    return {
      points,
      minLatitude,
      maxLatitude,
      minLongitude,
      maxLongitude
    };
  }, [selectedSession, selectedGpsTrackpoints]);


  const runTrackThresholds = useMemo(() => {
    if (!selectedSession) {
      return { sprintThresholdMps: null, highIntensityThresholdMps: null };
    }

    const sprintThresholdRaw = selectedSession.summary.coreMetrics.thresholds.SprintSpeedThresholdMps;
    const highIntensityThresholdRaw = selectedSession.summary.coreMetrics.thresholds.HighIntensitySpeedThresholdMps;
    const sprintThresholdMps = sprintThresholdRaw ? Number(sprintThresholdRaw) : Number.NaN;
    const highIntensityThresholdMps = highIntensityThresholdRaw ? Number(highIntensityThresholdRaw) : Number.NaN;

    return {
      sprintThresholdMps: Number.isFinite(sprintThresholdMps) ? sprintThresholdMps : null,
      highIntensityThresholdMps: Number.isFinite(highIntensityThresholdMps) ? highIntensityThresholdMps : null
    };
  }, [selectedSession]);

  const shouldShowGpsHeatmap = selectedSession
    ? ['Dual', 'GpsOnly'].includes(resolveDataAvailability(selectedSession.summary).mode)
    : false;

  const preserveViewportScrollPosition = useCallback((toggleAction: () => void) => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    toggleAction();
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - scrollY) > 0.5) {
        window.scrollTo({ left: scrollX, top: scrollY, behavior: 'auto' });
      }
    });
  }, []);

  const toggleAnalysisSection = useCallback((key: AnalysisAccordionKey) => {
    preserveViewportScrollPosition(() => {
      setAnalysisAccordionState((current) => ({ ...current, [key]: !current[key] }));
    });
  }, [preserveViewportScrollPosition]);

  const toggleSegmentEditor = useCallback((key: keyof typeof segmentEditorsOpen) => {
    preserveViewportScrollPosition(() => {
      setSegmentEditorsOpen((current) => ({ ...current, [key]: !current[key] }));
    });
  }, [preserveViewportScrollPosition]);

  const selectedSessionAggregates = useMemo(() => {
    if (!selectedSession) {
      return [];
    }

    return selectedSession.summary.intervalAggregates
      .filter((aggregate) => aggregate.windowMinutes === aggregationWindowMinutes)
      .sort((a, b) => a.windowIndex - b.windowIndex);
  }, [selectedSession, aggregationWindowMinutes]);

  const selectedAnalysisAggregateSlices = useMemo(() => {
    if (!isSegmentScopeActive || !selectedSegment) {
      return selectedSessionAggregates.map((aggregate) => ({
        aggregate,
        overlapSeconds: Math.max(0, aggregate.windowDurationSeconds)
      }));
    }

    const activityStart = selectedSession?.summary.activityStartTimeUtc ? new Date(selectedSession.summary.activityStartTimeUtc).getTime() : Number.NaN;

    return selectedSessionAggregates
      .map((aggregate) => {
        const windowStart = new Date(aggregate.windowStartUtc).getTime();
        if (!Number.isFinite(windowStart) || !Number.isFinite(activityStart)) {
          return {
            aggregate,
            overlapSeconds: Math.max(0, aggregate.windowDurationSeconds)
          };
        }

        const offsetSeconds = (windowStart - activityStart) / 1000;
        const windowEnd = offsetSeconds + aggregate.windowDurationSeconds;
        const overlapStart = Math.max(offsetSeconds, selectedSegment.startSecond);
        const overlapEnd = Math.min(windowEnd, selectedSegment.endSecond);

        return {
          aggregate,
          overlapSeconds: Math.max(0, overlapEnd - overlapStart)
        };
      })
      .filter((slice) => slice.overlapSeconds > 0);
  }, [isSegmentScopeActive, selectedSegment, selectedSessionAggregates, selectedSession?.summary.activityStartTimeUtc]);

  const selectedAnalysisAggregates = useMemo(() => selectedAnalysisAggregateSlices.map((slice) => slice.aggregate), [selectedAnalysisAggregateSlices]);
  const timelineOffsetSecond = isSegmentScopeActive && selectedSegment ? selectedSegment.startSecond : 0;
  const timelineRangeSecond = isSegmentScopeActive && selectedSegment ? Math.max(1, selectedSegment.endSecond - selectedSegment.startSecond) : null;

  const timelineSecondSeries = useMemo(() => {
    if (!selectedSession) {
      return {
        rolling: { distance: [], runningDensity: [], speed: [], highSpeedDistance: [], mechanicalLoad: [], heartRateAvg: [], trimp: [] },
        instant: { distance: [], runningDensity: [], speed: [], highSpeedDistance: [], mechanicalLoad: [], heartRateAvg: [], trimp: [] },
        mechanicalBreakdownBySecond: new Map<number, { accel: number; decel: number; cod: number }>(),
        rollingSampleCount: 0
      };
    }

    const scopeStart = timelineOffsetSecond;
    const scopeEnd = isSegmentScopeActive && selectedSegment
      ? selectedSegment.endSecond
      : Math.max(scopeStart, Math.floor(selectedSession.summary.durationSeconds ?? 0));

    // `summary.gpsTrackpoints` are already smoothed by backend filter selection.
    // We still add a plausibility guard for residual teleport jumps to avoid raw-like spikes in timeline distance.
    const smoothedGpsPoints = selectedGpsTrackpoints
      .filter((point): point is GpsTrackpoint & { elapsedSeconds: number } => point.elapsedSeconds !== null)
      .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
      .filter((point) => point.elapsedSeconds >= scopeStart && point.elapsedSeconds <= scopeEnd);

    const durationSeconds = Math.max(1, Math.ceil(scopeEnd - scopeStart));
    const secondCount = durationSeconds + 1;
    const distanceDelta = new Array<number>(secondCount).fill(0);
    const speedBySecond = new Array<number>(secondCount).fill(0);
    const highSpeedDistanceDelta = new Array<number>(secondCount).fill(0);
    const accelCountBySecond = new Array<number>(secondCount).fill(0);
    const decelCountBySecond = new Array<number>(secondCount).fill(0);
    const codCountBySecond = new Array<number>(secondCount).fill(0);
    const hrSumBySecond = new Array<number>(secondCount).fill(0);
    const hrCountBySecond = new Array<number>(secondCount).fill(0);
    const trimpDeltaBySecond = new Array<number>(secondCount).fill(0);

    const thresholds = selectedSession.summary.coreMetrics.thresholds ?? {};
    const highSpeedThreshold = Number(thresholds.HighIntensitySpeedThresholdMps ?? (19.8 / 3.6));
    const fallbackMaxSpeedMps = Number(selectedSession.summary.coreMetrics.maxSpeedMetersPerSecond ?? 12);
    const thresholdMaxSpeedMps = Number(thresholds.EffectiveMaxSpeedMps ?? fallbackMaxSpeedMps);
    const plausibleSpeedCeilingMps = Math.max(6, (Number.isFinite(thresholdMaxSpeedMps) ? thresholdMaxSpeedMps : fallbackMaxSpeedMps) * 1.25);
    const pauseGapThresholdSeconds = 15;

    const toLocalSecond = (absoluteSecond: number) => {
      const local = Math.round(absoluteSecond - scopeStart);
      return Math.max(0, Math.min(durationSeconds, local));
    };

    let previousSpeedMps: number | null = null;
    for (let index = 1; index < smoothedGpsPoints.length; index += 1) {
      const previous = smoothedGpsPoints[index - 1];
      const current = smoothedGpsPoints[index];
      const deltaSeconds = current.elapsedSeconds - previous.elapsedSeconds;
      if (deltaSeconds <= 0) {
        continue;
      }
      if (deltaSeconds > pauseGapThresholdSeconds) {
        previousSpeedMps = null;
        continue;
      }

      const distanceMeters = haversineMeters(previous.latitude, previous.longitude, current.latitude, current.longitude);
      const speedMps = distanceMeters / deltaSeconds;
      if (!Number.isFinite(speedMps) || speedMps > plausibleSpeedCeilingMps) {
        previousSpeedMps = null;
        continue;
      }

      const currentSecond = toLocalSecond(current.elapsedSeconds);
      distanceDelta[currentSecond] += distanceMeters;
      speedBySecond[currentSecond] = speedMps;
      if (speedMps >= highSpeedThreshold) {
        highSpeedDistanceDelta[currentSecond] += distanceMeters;
      }

      previousSpeedMps = speedMps;
    }

    const hasPointInScope = (pointIndex: number) => {
      const elapsed = normalizedGpsTrackpoints[pointIndex]?.elapsedSeconds;
      return typeof elapsed === 'number' && elapsed >= scopeStart && elapsed <= scopeEnd;
    };

    const addMechanicalEventsBySecond = (events: MechanicalEvent[] | undefined, target: number[]) => {
      (events ?? []).forEach((event) => {
        if (!event.pointIndices.some((pointIndex) => hasPointInScope(pointIndex))) {
          return;
        }
        const second = toLocalSecond(event.startElapsedSeconds);
        if (second >= 0 && second <= durationSeconds) {
          target[second] += 1;
        }
      });
    };

    addMechanicalEventsBySecond(selectedSession.summary.accelerations, accelCountBySecond);
    addMechanicalEventsBySecond(selectedSession.summary.decelerations, decelCountBySecond);
    addMechanicalEventsBySecond(selectedSession.summary.highIntensityDirectionChanges, codCountBySecond);

    const hrSamples = (selectedSession.summary.heartRateSamples ?? [])
      .filter((sample) => sample.elapsedSeconds >= scopeStart && sample.elapsedSeconds <= scopeEnd)
      .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

    for (let index = 0; index < hrSamples.length; index += 1) {
      const sample = hrSamples[index];
      const localSecond = toLocalSecond(sample.elapsedSeconds);
      hrSumBySecond[localSecond] += sample.heartRateBpm;
      hrCountBySecond[localSecond] += 1;
    }

    for (let second = 0; second <= durationSeconds; second += 1) {
      if (hrCountBySecond[second] === 0 && second > 0 && hrCountBySecond[second - 1] > 0) {
        hrSumBySecond[second] = hrSumBySecond[second - 1] / hrCountBySecond[second - 1];
        hrCountBySecond[second] = 1;
      }
      if (hrCountBySecond[second] > 0) {
        const avgHr = hrSumBySecond[second] / hrCountBySecond[second];
        const zoneWeight = avgHr < 120 ? 1 : avgHr < 140 ? 2 : avgHr < 160 ? 3 : avgHr < 180 ? 4 : 5;
        trimpDeltaBySecond[second] = zoneWeight / 60;
      }
    }

    const scaledAccelCountBySecond = accelCountBySecond;
    const scaledDecelCountBySecond = decelCountBySecond;
    const scaledCodCountBySecond = codCountBySecond;

    const prefix = (arr: number[]) => {
      const output = new Array<number>(arr.length + 1).fill(0);
      for (let idx = 0; idx < arr.length; idx += 1) {
        output[idx + 1] = output[idx] + arr[idx];
      }
      return output;
    };

    const distancePrefix = prefix(distanceDelta);
    const highSpeedDistancePrefix = prefix(highSpeedDistanceDelta);
    const accelPrefix = prefix(scaledAccelCountBySecond);
    const decelPrefix = prefix(scaledDecelCountBySecond);
    const codPrefix = prefix(scaledCodCountBySecond);
    const hrSumPrefix = prefix(hrSumBySecond);
    const hrCountPrefix = prefix(hrCountBySecond);
    const trimpPrefix = prefix(trimpDeltaBySecond);

    const rollingWindowSeconds = aggregationWindowMinutes * 60;
    const rollingDistance: TimelinePoint[] = [];
    const rollingRunningDensity: TimelinePoint[] = [];
    const rollingSpeed: TimelinePoint[] = [];
    const rollingHighSpeedDistance: TimelinePoint[] = [];
    const rollingMechanicalLoad: TimelinePoint[] = [];
    const rollingHeartRateAvg: TimelinePoint[] = [];
    const rollingTrimp: TimelinePoint[] = [];

    const instantDistance: TimelinePoint[] = [];
    const instantRunningDensity: TimelinePoint[] = [];
    const instantSpeed: TimelinePoint[] = [];
    const instantHighSpeedDistance: TimelinePoint[] = [];
    const instantMechanicalLoad: TimelinePoint[] = [];
    const instantHeartRateAvg: TimelinePoint[] = [];
    const instantTrimp: TimelinePoint[] = [];

    const mechanicalBreakdownBySecond = new Map<number, { accel: number; decel: number; cod: number }>();

    for (let second = 0; second <= durationSeconds; second += 1) {
      const rangeStart = Math.max(0, second - rollingWindowSeconds + 1);
      const sumOverRange = (pref: number[]) => pref[second + 1] - pref[rangeStart];
      const distanceRollingSum = sumOverRange(distancePrefix);
      const highSpeedRollingSum = sumOverRange(highSpeedDistancePrefix);
      const accelRolling = sumOverRange(accelPrefix);
      const decelRolling = sumOverRange(decelPrefix);
      const codRolling = sumOverRange(codPrefix);
      const hrRollingSum = sumOverRange(hrSumPrefix);
      const hrRollingCount = sumOverRange(hrCountPrefix);
      const trimpRolling = sumOverRange(trimpPrefix);
      const windowLengthSeconds = second - rangeStart + 1;

      const x = second;
      rollingDistance.push({ x, y: distanceRollingSum });
      rollingRunningDensity.push({ x, y: windowLengthSeconds > 0 ? (distanceRollingSum / windowLengthSeconds) * 60 : null });
      rollingSpeed.push({ x, y: windowLengthSeconds > 0 ? distanceRollingSum / windowLengthSeconds : null });
      rollingHighSpeedDistance.push({ x, y: highSpeedRollingSum });
      rollingMechanicalLoad.push({ x, y: accelRolling + decelRolling + codRolling });
      rollingHeartRateAvg.push({ x, y: hrRollingCount > 0 ? hrRollingSum / hrRollingCount : null });
      rollingTrimp.push({ x, y: trimpRolling });

      const mechanicalInstant = scaledAccelCountBySecond[second] + scaledDecelCountBySecond[second] + scaledCodCountBySecond[second];
      const hrInstant = hrCountBySecond[second] > 0 ? (hrSumBySecond[second] / hrCountBySecond[second]) : null;

      instantDistance.push({ x, y: distanceDelta[second] });
      instantRunningDensity.push({ x, y: speedBySecond[second] * 60 });
      instantSpeed.push({ x, y: speedBySecond[second] });
      instantHighSpeedDistance.push({ x, y: highSpeedDistanceDelta[second] });
      instantMechanicalLoad.push({ x, y: mechanicalInstant });
      instantHeartRateAvg.push({ x, y: hrInstant });
      instantTrimp.push({ x, y: trimpDeltaBySecond[second] * 60 });

      mechanicalBreakdownBySecond.set(x, {
        accel: timelineMode === 'rolling' ? accelRolling : scaledAccelCountBySecond[second],
        decel: timelineMode === 'rolling' ? decelRolling : scaledDecelCountBySecond[second],
        cod: timelineMode === 'rolling' ? codRolling : scaledCodCountBySecond[second]
      });
    }

    return {
      rolling: {
        distance: rollingDistance,
        runningDensity: rollingRunningDensity,
        speed: rollingSpeed,
        highSpeedDistance: rollingHighSpeedDistance,
        mechanicalLoad: rollingMechanicalLoad,
        heartRateAvg: rollingHeartRateAvg,
        trimp: rollingTrimp
      },
      instant: {
        distance: instantDistance,
        runningDensity: instantRunningDensity,
        speed: instantSpeed,
        highSpeedDistance: instantHighSpeedDistance,
        mechanicalLoad: instantMechanicalLoad,
        heartRateAvg: instantHeartRateAvg,
        trimp: instantTrimp
      },
      mechanicalBreakdownBySecond,
      rollingSampleCount: rollingDistance.length
    };
  }, [aggregationWindowMinutes, isSegmentScopeActive, selectedGpsTrackpoints, selectedSegment, selectedSession, timelineMode, timelineOffsetSecond]);

  const activeTimelineTracks = timelineMode === 'rolling' ? timelineSecondSeries.rolling : timelineSecondSeries.instant;
  const timelineAxisMaxSecond = useMemo(() => {
    const all = [
      ...activeTimelineTracks.distance,
      ...activeTimelineTracks.runningDensity,
      ...activeTimelineTracks.speed,
      ...activeTimelineTracks.highSpeedDistance,
      ...activeTimelineTracks.mechanicalLoad,
      ...activeTimelineTracks.heartRateAvg,
      ...(timelineMode === 'rolling' ? activeTimelineTracks.trimp : [])
    ];

    const maxTrackSecond = all.length > 0 ? Math.max(...all.map((point) => point.x)) : 0;
    const durationSecond = timelineRangeSecond ?? (selectedSession?.summary.durationSeconds ?? 0);
    return Math.max(1, Math.ceil(Math.max(maxTrackSecond, durationSecond)));
  }, [activeTimelineTracks, selectedSession?.summary.durationSeconds, timelineMode, timelineRangeSecond]);

  const timelineSpeedUnit = selectedSession?.selectedSpeedUnit ?? 'km/h';
  const timelineDataMode = selectedSession ? resolveDataAvailability(selectedSession.summary).mode : 'NotAvailable';
  const timelineShowGpsTracks = timelineDataMode === 'Dual' || timelineDataMode === 'GpsOnly';
  const timelineShowHeartRateTracks = timelineDataMode === 'Dual' || timelineDataMode === 'HeartRateOnly';

  const timelineSeries = useMemo<TimelineSeries[]>(() => {
    const series: TimelineSeries[] = [];

    if (timelineShowGpsTracks) {
      series.push(
        { key: 'distance', label: t.timelineTrackDistance, valueSuffix: ' m', points: activeTimelineTracks.distance },
        { key: 'runningDensity', label: t.timelineTrackRunningDensity, valueSuffix: ' m/min', points: activeTimelineTracks.runningDensity },
        {
          key: 'speed',
          label: t.timelineTrackSpeedHsr,
          valueFormatter: (valueMps) => formatSpeed(valueMps, timelineSpeedUnit, t.notAvailable),
          points: activeTimelineTracks.speed
        },
        { key: 'highSpeedDistance', label: t.timelineTrackHighSpeedDistance, valueSuffix: ' m', points: activeTimelineTracks.highSpeedDistance },
        { key: 'mechanicalLoad', label: t.timelineTrackAccelDecel, valueSuffix: '', points: activeTimelineTracks.mechanicalLoad }
      );
    }

    if (timelineShowHeartRateTracks) {
      series.push({ key: 'heartRateAvg', label: t.timelineTrackHeartRate, valueSuffix: ' bpm', points: activeTimelineTracks.heartRateAvg });
      if (timelineMode === 'rolling') {
        series.push({ key: 'trimp', label: t.timelineTrackTrimp, valueSuffix: '', points: activeTimelineTracks.trimp });
      }
    }

    return series;
  }, [activeTimelineTracks, t, timelineMode, timelineSpeedUnit, timelineShowGpsTracks, timelineShowHeartRateTracks]);
  useEffect(() => {
    setTimelineCursorSecond((current) => Math.max(0, Math.min(timelineAxisMaxSecond, current)));
  }, [timelineAxisMaxSecond]);

  useEffect(() => {
    setTimelineHighlightedWindow(null);
    setTimelineHighlightedPeakLabel(null);
  }, [timelineMode, aggregationWindowMinutes, isSegmentScopeActive, selectedSegment?.id, selectedSession?.id]);


  useEffect(() => {
    if (activeSessionSubpage !== 'analysis' || activeAnalysisTab !== 'timeline') {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const peakTrack = query.get('peakTrack');
    const peakStart = Number(query.get('peakStart'));
    const peakEnd = Number(query.get('peakEnd'));
    const peakLabel = query.get('peakLabel');

    const validTrack = peakTrack === 'distance' || peakTrack === 'runningDensity' || peakTrack === 'speed' || peakTrack === 'highSpeedDistance' || peakTrack === 'mechanicalLoad' || peakTrack === 'heartRateAvg' || peakTrack === 'trimp';
    if (!validTrack || !Number.isFinite(peakStart) || !Number.isFinite(peakEnd) || !peakLabel) {
      return;
    }

    setTimelineScrollTarget(peakTrack);
    setTimelineHighlightedWindow({ startSecond: Math.max(0, Math.round(peakStart)), endSecond: Math.max(0, Math.round(peakEnd)) });
    setTimelineHighlightedPeakLabel(peakLabel);
  }, [activeAnalysisTab, activeSessionSubpage, selectedSession?.id]);

  useEffect(() => {
    if (activeSessionSubpage !== 'analysis' || activeAnalysisTab !== 'timeline' || !timelineScrollTarget) {
      return;
    }

    const trackElement = document.getElementById(`timeline-track-${timelineScrollTarget}`);
    if (trackElement) {
      trackElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimelineScrollTarget(null);
    }
  }, [activeAnalysisTab, activeSessionSubpage, timelineScrollTarget]);

  const timelineCursorValues = useMemo(() => timelineSeries.map((series) => {
    const nearest = findNearestTimelinePoint(series.points, timelineCursorSecond);
    if (!nearest || nearest.y === null) {
      return { key: series.key, text: t.notAvailable };
    }

    if (series.key === 'mechanicalLoad') {
      const second = Math.round(nearest.x);
      const breakdown = timelineSecondSeries.mechanicalBreakdownBySecond.get(second) ?? { accel: 0, decel: 0, cod: 0 };
      const total = breakdown.accel + breakdown.decel + breakdown.cod;
      return {
        key: series.key,
        text: `${total.toFixed(0)} (${t.timelineMechanicalAccel}: ${breakdown.accel.toFixed(0)} · ${t.timelineMechanicalDecel}: ${breakdown.decel.toFixed(0)} · ${t.timelineMechanicalCod}: ${breakdown.cod.toFixed(0)})`
      };
    }

    const textValue = series.valueFormatter
      ? series.valueFormatter(nearest.y)
      : `${nearest.y.toFixed(1)}${series.valueSuffix ?? ''}`;

    return { key: series.key, text: textValue };
  }), [timelineCursorSecond, timelineSecondSeries.mechanicalBreakdownBySecond, timelineSeries, t.notAvailable, t.timelineMechanicalAccel, t.timelineMechanicalCod, t.timelineMechanicalDecel]);


  useEffect(() => {
    if (activeAnalysisTab === 'peakDemand' && aggregationWindowMinutes !== peakDemandWindowMinutes) {
      setAggregationWindowMinutes(peakDemandWindowMinutes);
    }
  }, [activeAnalysisTab, aggregationWindowMinutes, peakDemandWindowMinutes]);

  const peakRowsByDimension = useMemo(() => {
    const toPeak = (points: TimelinePoint[]) => {
      const valid = points.filter((point) => point.y !== null && point.y > 0) as Array<{ x: number; y: number }>;
      if (valid.length === 0) {
        return null;
      }

      return valid.reduce((best, current) => current.y > best.y ? current : best);
    };

    const buildPeakRow = (config: {
      metricLabel: string;
      seriesKey: TimelineTrackKey;
      points: TimelinePoint[];
      comparison: { averageLastFive: number | null; bestSeason: number | null };
      formatPeak: (value: number) => string;
      formatComparison: (value: number) => string;
    }) => {
      const peakPoint = toPeak(config.points);
      if (!peakPoint) {
        return null;
      }

      const windowLengthSeconds = peakDemandWindowMinutes * 60;
      const windowEndSecond = Math.max(0, Math.round(peakPoint.x));
      const windowStartSecond = Math.max(0, windowEndSecond - windowLengthSeconds + 1);

      return {
        metricLabel: config.metricLabel,
        seriesKey: config.seriesKey,
        peakValue: config.formatPeak(peakPoint.y),
        averageLastFive: config.comparison.averageLastFive !== null
          ? interpolate(t.kpiComparisonLastFive, { value: config.formatComparison(config.comparison.averageLastFive) })
          : null,
        bestSeason: config.comparison.bestSeason !== null
          ? interpolate(t.kpiComparisonBestSeason, { value: config.formatComparison(config.comparison.bestSeason) })
          : null,
        windowStartSecond,
        windowEndSecond
      };
    };

    return {
      volume: [
        buildPeakRow({
          metricLabel: t.metricDistance,
          seriesKey: 'distance',
          points: timelineSecondSeries.rolling.distance,
          comparison: distancePeakComparison,
          formatPeak: (value) => formatDistanceMetersOnly(value, t.notAvailable),
          formatComparison: (value) => formatDistanceMetersOnly(value, t.notAvailable)
        })
      ].filter((row): row is NonNullable<typeof row> => row !== null),
      speed: [
        buildPeakRow({
          metricLabel: t.metricHighSpeedDistance,
          seriesKey: 'highSpeedDistance',
          points: timelineSecondSeries.rolling.highSpeedDistance,
          comparison: highSpeedDistancePeakComparison,
          formatPeak: (value) => formatDistanceMetersOnly(value, t.notAvailable),
          formatComparison: (value) => formatDistanceMetersOnly(value, t.notAvailable)
        })
      ].filter((row): row is NonNullable<typeof row> => row !== null),
      mechanical: [
        buildPeakRow({
          metricLabel: t.metricAccelerationCount,
          seriesKey: 'mechanicalLoad',
          points: timelineSecondSeries.rolling.mechanicalLoad,
          comparison: mechanicalPeakComparison,
          formatPeak: (value) => formatNumber(value, locale, t.notAvailable, 0),
          formatComparison: (value) => formatNumber(value, locale, t.notAvailable, 0)
        })
      ].filter((row): row is NonNullable<typeof row> => row !== null),
      internal: [
        buildPeakRow({
          metricLabel: t.metricTrimpPerMinute,
          seriesKey: 'trimp',
          points: timelineSecondSeries.rolling.trimp,
          comparison: trimpPeakComparison,
          formatPeak: (value) => formatNumber(value, locale, t.notAvailable, 2),
          formatComparison: (value) => formatNumber(value, locale, t.notAvailable, 2)
        }),
        buildPeakRow({
          metricLabel: t.metricHeartRate,
          seriesKey: 'heartRateAvg',
          points: timelineSecondSeries.rolling.heartRateAvg,
          comparison: heartRatePeakComparison,
          formatPeak: (value) => `${formatNumber(value, locale, t.notAvailable, 1)} bpm`,
          formatComparison: (value) => `${formatNumber(value, locale, t.notAvailable, 1)} bpm`
        })
      ].filter((row): row is NonNullable<typeof row> => row !== null)
    };
  }, [distancePeakComparison, heartRatePeakComparison, highSpeedDistancePeakComparison, locale, mechanicalPeakComparison, peakDemandWindowMinutes, t, timelineSecondSeries.rolling.distance, timelineSecondSeries.rolling.heartRateAvg, timelineSecondSeries.rolling.highSpeedDistance, timelineSecondSeries.rolling.mechanicalLoad, timelineSecondSeries.rolling.trimp, trimpPeakComparison]);


  const codBandCountsByScope = useMemo(() => {
    if (!selectedSession) {
      return { moderate: 0, high: 0, veryHigh: 0, total: 0 };
    }
    const scopeStart = isSegmentScopeActive && selectedSegment ? selectedSegment.startSecond : 0;
    const scopeEnd = isSegmentScopeActive && selectedSegment
      ? selectedSegment.endSecond
      : Math.max(0, selectedSession.summary.durationSeconds ?? 0);

    const inScope = (event: MechanicalEvent) => event.pointIndices.some((pointIndex) => {
      const elapsed = normalizedGpsTrackpoints[pointIndex]?.elapsedSeconds;
      return typeof elapsed === 'number' && elapsed >= scopeStart && elapsed <= scopeEnd;
    });

    const codSource = selectedSession.summary.highIntensityDirectionChanges;
    if (!codSource || codSource.length === 0) {
      return {
        moderate: selectedSession.summary.coreMetrics.moderateDirectionChangeCount ?? 0,
        high: selectedSession.summary.coreMetrics.highDirectionChangeCount ?? 0,
        veryHigh: selectedSession.summary.coreMetrics.veryHighDirectionChangeCount ?? 0,
        total: selectedSession.summary.coreMetrics.directionChanges ?? 0
      };
    }

    const codEvents = codSource.filter(inScope);
    const moderate = codEvents.filter((event) => event.intensity === 'moderate').length;
    const high = codEvents.filter((event) => event.intensity === 'high').length;
    const veryHigh = codEvents.filter((event) => event.intensity === 'veryHigh').length;

    return { moderate, high, veryHigh, total: codEvents.length };
  }, [selectedSession, isSegmentScopeActive, selectedSegment, normalizedGpsTrackpoints]);


  const mechanicalBandCountsByScope = useMemo(() => {
    if (!selectedSession) {
      return {
        acceleration: { moderate: 0, high: 0, veryHigh: 0, total: 0 },
        deceleration: { moderate: 0, high: 0, veryHigh: 0, total: 0 }
      };
    }

    const scopeStart = isSegmentScopeActive && selectedSegment ? selectedSegment.startSecond : 0;
    const scopeEnd = isSegmentScopeActive && selectedSegment
      ? selectedSegment.endSecond
      : Math.max(0, selectedSession.summary.durationSeconds ?? 0);

    const inScope = (event: MechanicalEvent) => event.pointIndices.some((pointIndex) => {
      const elapsed = normalizedGpsTrackpoints[pointIndex]?.elapsedSeconds;
      return typeof elapsed === 'number' && elapsed >= scopeStart && elapsed <= scopeEnd;
    });

    const countByBand = (
      events: MechanicalEvent[] | undefined,
      fallback: { moderate: number | null | undefined; high: number | null | undefined; veryHigh: number | null | undefined; total: number | null | undefined }
    ) => {
      if (events && events.length > 0) {
        const scoped = events.filter(inScope);
        return {
          moderate: scoped.filter((event) => event.intensity === 'moderate').length,
          high: scoped.filter((event) => event.intensity === 'high').length,
          veryHigh: scoped.filter((event) => event.intensity === 'veryHigh').length,
          total: scoped.length
        };
      }

      return {
        moderate: fallback.moderate ?? 0,
        high: fallback.high ?? 0,
        veryHigh: fallback.veryHigh ?? 0,
        total: fallback.total ?? 0
      };
    };

    return {
      acceleration: countByBand(selectedSession.summary.accelerations, {
        moderate: selectedSession.summary.coreMetrics.moderateAccelerationCount,
        high: selectedSession.summary.coreMetrics.highAccelerationCount,
        veryHigh: selectedSession.summary.coreMetrics.veryHighAccelerationCount,
        total: selectedSession.summary.coreMetrics.accelerationCount
      }),
      deceleration: countByBand(selectedSession.summary.decelerations, {
        moderate: selectedSession.summary.coreMetrics.moderateDecelerationCount,
        high: selectedSession.summary.coreMetrics.highDecelerationCount,
        veryHigh: selectedSession.summary.coreMetrics.veryHighDecelerationCount,
        total: selectedSession.summary.coreMetrics.decelerationCount
      })
    };
  }, [selectedSession, isSegmentScopeActive, selectedSegment, normalizedGpsTrackpoints]);

  const displayedCoreMetrics = useMemo(() => {
    // Backend delivers a single session summary + interval aggregates.
    // Segment analysis is currently created by slicing these intervals in the UI by time range,
    // so parity fixes for R1.6-05 intentionally live in this frontend aggregation path.
    if (!selectedSession) {
      return null;
    }

    if (!isSegmentScopeActive) {
      return {
        ...selectedSession.summary.coreMetrics,
        accelerationCount: mechanicalBandCountsByScope.acceleration.total,
        decelerationCount: mechanicalBandCountsByScope.deceleration.total,
        moderateAccelerationCount: mechanicalBandCountsByScope.acceleration.moderate,
        highAccelerationCount: mechanicalBandCountsByScope.acceleration.high,
        veryHighAccelerationCount: mechanicalBandCountsByScope.acceleration.veryHigh,
        moderateDecelerationCount: mechanicalBandCountsByScope.deceleration.moderate,
        highDecelerationCount: mechanicalBandCountsByScope.deceleration.high,
        veryHighDecelerationCount: mechanicalBandCountsByScope.deceleration.veryHigh,
        directionChanges: codBandCountsByScope.total,
        moderateDirectionChangeCount: codBandCountsByScope.moderate,
        highDirectionChangeCount: codBandCountsByScope.high,
        veryHighDirectionChangeCount: codBandCountsByScope.veryHigh
      };
    }

    if (selectedAnalysisAggregates.length === 0) {
      const baseCoreMetrics = selectedSession.summary.coreMetrics;
      const baseMetricAvailability = baseCoreMetrics.metricAvailability ?? {};
      const metricAvailability = Object.keys(baseMetricAvailability).reduce<Record<string, MetricAvailability>>((accumulator, metricKey) => {
        accumulator[metricKey] = {
          state: 'NotAvailable',
          reason: t.segmentScopeNoTimelineDataHint
        };
        return accumulator;
      }, {});

      return {
        ...baseCoreMetrics,
        distanceMeters: null,
        sprintDistanceMeters: null,
        sprintCount: null,
        maxSpeedMetersPerSecond: null,
        highIntensityTimeSeconds: null,
        highIntensityRunCount: null,
        highSpeedDistanceMeters: null,
        runningDensityMetersPerMinute: null,
        accelerationCount: null,
        decelerationCount: null,
        moderateAccelerationCount: null,
        highAccelerationCount: null,
        veryHighAccelerationCount: null,
        moderateDecelerationCount: null,
        highDecelerationCount: null,
        veryHighDecelerationCount: null,
        directionChanges: 0,
        moderateDirectionChangeCount: 0,
        highDirectionChangeCount: 0,
        veryHighDirectionChangeCount: 0,
        heartRateZoneLowSeconds: null,
        heartRateZoneMediumSeconds: null,
        heartRateZoneHighSeconds: null,
        trainingImpulseEdwards: null,
        heartRateRecoveryAfter60Seconds: null,
        metricAvailability
      };
    }

    const sourceSlices = selectedAnalysisAggregateSlices;
    const source = sourceSlices.map((slice) => slice.aggregate);
    const durationSeconds = selectedSegment ? Math.max(1, selectedSegment.endSecond - selectedSegment.startSecond) : 1;
    const sourceMetricAvailability = source.map((item) => item.coreMetrics.metricAvailability ?? {});
    const baseMetricAvailability = selectedSession.summary.coreMetrics.metricAvailability ?? {};

    const combinedMetricAvailability = Object.keys(baseMetricAvailability).reduce<Record<string, MetricAvailability>>((accumulator, metricKey) => {
      const states = sourceMetricAvailability
        .map((availability) => availability[metricKey]?.state)
        .filter((state): state is MetricAvailability['state'] => state !== undefined);

      if (states.length === 0) {
        accumulator[metricKey] = baseMetricAvailability[metricKey];
        return accumulator;
      }

      const combinedState = combineMetricAvailability(states);
      const reasons = sourceMetricAvailability
        .map((availability) => availability[metricKey]?.reason)
        .filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0);

      accumulator[metricKey] = {
        state: combinedState,
        reason: reasons.length > 0 ? reasons[0] : null
      };
      return accumulator;
    }, {});

    const sumMetric = (
      metricKey: string,
      getter: (metrics: FootballCoreMetrics) => number | null,
      options?: { round?: boolean }
    ): number | null => {
      if (!isMetricAvailableForAggregation(combinedMetricAvailability, metricKey)) {
        return null;
      }

      const weightedSum = sourceSlices.reduce((sum, slice) => {
        const windowDuration = Math.max(1, slice.aggregate.windowDurationSeconds);
        const overlapFactor = Math.min(1, Math.max(0, slice.overlapSeconds / windowDuration));
        return sum + ((getter(slice.aggregate.coreMetrics) ?? 0) * overlapFactor);
      }, 0);

      return options?.round ? Math.round(weightedSum) : weightedSum;
    };

    const maxMetric = (metricKey: string, getter: (metrics: FootballCoreMetrics) => number | null): number | null => {
      if (!isMetricAvailableForAggregation(combinedMetricAvailability, metricKey)) {
        return null;
      }

      return Math.max(...source.map((item) => getter(item.coreMetrics) ?? 0));
    };

    const distanceMeters = sumMetric('distanceMeters', (metrics) => metrics.distanceMeters);

    return {
      ...selectedSession.summary.coreMetrics,
      metricAvailability: combinedMetricAvailability,
      distanceMeters,
      sprintDistanceMeters: segmentRunDerivedMetrics?.sprintDistanceMeters ?? sumMetric('sprintDistanceMeters', (metrics) => metrics.sprintDistanceMeters),
      sprintCount: segmentRunDerivedMetrics?.sprintCount ?? sumMetric('sprintCount', (metrics) => metrics.sprintCount, { round: true }),
      maxSpeedMetersPerSecond: !isMetricAvailableForAggregation(combinedMetricAvailability, 'maxSpeedMetersPerSecond')
        ? null
        : (segmentSpeedDerivedMetrics?.maxSpeedMetersPerSecond ?? maxMetric('maxSpeedMetersPerSecond', (metrics) => metrics.maxSpeedMetersPerSecond)),
      highIntensityTimeSeconds: !isMetricAvailableForAggregation(combinedMetricAvailability, 'highIntensityTimeSeconds')
        ? null
        : (segmentSpeedDerivedMetrics?.highIntensityTimeSeconds ?? segmentRunDerivedMetrics?.highIntensityTimeSeconds ?? sumMetric('highIntensityTimeSeconds', (metrics) => metrics.highIntensityTimeSeconds)),
      highIntensityRunCount: !isMetricAvailableForAggregation(combinedMetricAvailability, 'highIntensityRunCount')
        ? null
        : (segmentRunDerivedMetrics?.highIntensityRunCount ?? sumMetric('highIntensityRunCount', (metrics) => metrics.highIntensityRunCount, { round: true })),
      highSpeedDistanceMeters: !isMetricAvailableForAggregation(combinedMetricAvailability, 'highSpeedDistanceMeters')
        ? null
        : (segmentSpeedDerivedMetrics?.highSpeedDistanceMeters ?? segmentRunDerivedMetrics?.highSpeedDistanceMeters ?? sumMetric('highSpeedDistanceMeters', (metrics) => metrics.highSpeedDistanceMeters)),
      runningDensityMetersPerMinute: distanceMeters === null || !isMetricAvailableForAggregation(combinedMetricAvailability, 'runningDensityMetersPerMinute')
        ? null
        : (distanceMeters / durationSeconds) * 60,
      accelerationCount: mechanicalBandCountsByScope.acceleration.total,
      decelerationCount: mechanicalBandCountsByScope.deceleration.total,
      moderateAccelerationCount: mechanicalBandCountsByScope.acceleration.moderate,
      highAccelerationCount: mechanicalBandCountsByScope.acceleration.high,
      veryHighAccelerationCount: mechanicalBandCountsByScope.acceleration.veryHigh,
      moderateDecelerationCount: mechanicalBandCountsByScope.deceleration.moderate,
      highDecelerationCount: mechanicalBandCountsByScope.deceleration.high,
      veryHighDecelerationCount: mechanicalBandCountsByScope.deceleration.veryHigh,
      directionChanges: codBandCountsByScope.total,
      moderateDirectionChangeCount: codBandCountsByScope.moderate,
      highDirectionChangeCount: codBandCountsByScope.high,
      veryHighDirectionChangeCount: codBandCountsByScope.veryHigh,
      heartRateZoneLowSeconds: sumMetric('heartRateZoneLowSeconds', (metrics) => metrics.heartRateZoneLowSeconds),
      heartRateZoneMediumSeconds: sumMetric('heartRateZoneMediumSeconds', (metrics) => metrics.heartRateZoneMediumSeconds),
      heartRateZoneHighSeconds: sumMetric('heartRateZoneHighSeconds', (metrics) => metrics.heartRateZoneHighSeconds),
      trainingImpulseEdwards: sumMetric('trainingImpulseEdwards', (metrics) => metrics.trainingImpulseEdwards),
      heartRateRecoveryAfter60Seconds: !isMetricAvailableForAggregation(combinedMetricAvailability, 'heartRateRecoveryAfter60Seconds')
        ? null
        : (() => {
            for (let index = source.length - 1; index >= 0; index -= 1) {
              const value = source[index].coreMetrics.heartRateRecoveryAfter60Seconds;
              if (value !== null) {
                return value;
              }
            }

            return null;
          })()
    } satisfies FootballCoreMetrics;
  }, [selectedSession, isSegmentScopeActive, selectedAnalysisAggregates, selectedAnalysisAggregateSlices, selectedSegment, segmentRunDerivedMetrics, segmentSpeedDerivedMetrics, codBandCountsByScope, mechanicalBandCountsByScope, t.segmentScopeNoTimelineDataHint]);

  const detectedRunHierarchySummary = useMemo(() => {
    if (!selectedSession) {
      return null;
    }

    const highIntensityRuns = selectedDetectedRuns.filter((run) => run.runType === 'highIntensity');
    if (highIntensityRuns.length === 0) {
      return null;
    }

    const sprintPhaseCount = highIntensityRuns.reduce((sum, run) => sum + (run.sprintPhases?.length ?? 0), 0);
    const sprintPhaseDistanceMeters = highIntensityRuns.reduce((sum, run) => sum + (run.sprintPhases ?? []).reduce((phaseSum, phase) => phaseSum + phase.distanceMeters, 0), 0);

    return {
      highIntensityRunCount: highIntensityRuns.length,
      highIntensityDistanceMeters: highIntensityRuns.reduce((sum, run) => sum + run.distanceMeters, 0),
      sprintPhaseCount,
      sprintPhaseDistanceMeters
    };
  }, [selectedSession, selectedDetectedRuns]);

  const isQualityDetailsPageVisible = Boolean(selectedSession && activeMainPage === 'session' && activeSessionSubpage === 'analysis' && showUploadQualityStep);
  const shouldShowSessionOverviewHeader = activeSessionSubpage === 'analysis' && !isQualityDetailsPageVisible;
  const activeDataMode = selectedSession ? resolveDataAvailability(selectedSession.summary).mode : null;

  const trimpPerMinuteValue = displayedCoreMetrics?.trainingImpulseEdwards !== null && displayedCoreMetrics?.trainingImpulseEdwards !== undefined && selectedSession
    ? displayedCoreMetrics.trainingImpulseEdwards / ((isSegmentScopeActive && selectedSegment ? Math.max(1, selectedSegment.endSecond - selectedSegment.startSecond) : Math.max(1, selectedSession.summary.durationSeconds ?? 0)) / 60)
    : null;

  const hrZoneTotalSeconds = (displayedCoreMetrics?.heartRateZoneLowSeconds ?? 0) + (displayedCoreMetrics?.heartRateZoneMediumSeconds ?? 0) + (displayedCoreMetrics?.heartRateZoneHighSeconds ?? 0);
  const hrZoneBars: HrZoneBar[] = displayedCoreMetrics
    ? [
      { label: '<70%', value: withMetricStatus(formatDuration(displayedCoreMetrics.heartRateZoneLowSeconds, t.notAvailable), 'heartRateZoneLowSeconds', displayedCoreMetrics, t), percent: calculatePercent(displayedCoreMetrics.heartRateZoneLowSeconds, hrZoneTotalSeconds) },
      { label: '70–85%', value: withMetricStatus(formatDuration(displayedCoreMetrics.heartRateZoneMediumSeconds, t.notAvailable), 'heartRateZoneMediumSeconds', displayedCoreMetrics, t), percent: calculatePercent(displayedCoreMetrics.heartRateZoneMediumSeconds, hrZoneTotalSeconds) },
      { label: '>85%', value: withMetricStatus(formatDuration(displayedCoreMetrics.heartRateZoneHighSeconds, t.notAvailable), 'heartRateZoneHighSeconds', displayedCoreMetrics, t), percent: calculatePercent(displayedCoreMetrics.heartRateZoneHighSeconds, hrZoneTotalSeconds) }
    ]
    : [];

  useEffect(() => {
    if (activeSessionSubpage === 'segments') {
      setActiveAnalysisTab('segments');
      return;
    }

    if (activeSessionSubpage !== 'analysis') {
      return;
    }

    setActiveAnalysisTab((current) => (current === 'segments' ? 'overview' : current));
  }, [activeSessionSubpage]);


  const renderQualityDetailsContent = () => {
    if (!selectedSession) {
      return <p>{t.notAvailable}</p>;
    }

    const selectedDataAvailability = resolveDataAvailability(selectedSession.summary);
    const selectedFilterSource = selectedSession.selectedSmoothingFilterSource === 'ManualOverride'
      ? t.filterSourceManualOverride
      : selectedSession.selectedSmoothingFilterSource === 'ProfileRecalculation'
        ? t.filterSourceProfileRecalculation
        : t.filterSourceProfileDefault;

    return (
      <div className="quality-details-content">
        <h4>Session data</h4>
        <ul className="metrics-list list-group">
          <li className="list-group-item"><strong>{t.metricStartTime}:</strong> {selectedSession.summary.activityStartTimeUtc ? formatLocalDateTime(selectedSession.summary.activityStartTimeUtc) : t.notAvailable}</li>
          <li className="list-group-item"><strong>{t.metricTrackpoints}:</strong> {selectedSession.summary.trackpointCount}</li>
          <li className="list-group-item"><strong>{t.metricDistance}:</strong> {formatDistanceComparison(activeDistanceMeters, locale, t.notAvailable)} — {distanceSourceText(selectedSession.summary.distanceSource)}</li>
          <li className="list-group-item"><strong>{t.metricGps}:</strong> {selectedSession.summary.hasGpsData ? t.yes : t.no}</li>
          <li className="list-group-item"><strong>{t.metricDataMode}:</strong> {dataAvailabilitySummaryText(selectedSession.summary, t)}</li>
        </ul>

        <h4>{t.qualityDetailsSidebarTitle}</h4>
        {selectedSession.summary.qualityStatus !== 'High' || (selectedDataAvailability.gpsQualityStatus && selectedDataAvailability.gpsQualityStatus !== 'High') || (selectedDataAvailability.heartRateQualityStatus && selectedDataAvailability.heartRateQualityStatus !== 'High') ? (
          <p className="quality-warning">{t.qualityDetailsWarning}</p>
        ) : null}
        <ul className="metrics-list list-group">
          <li className="list-group-item"><strong>{t.metricQualityStatus}:</strong> {qualityStatusText(selectedSession.summary.qualityStatus, t)}</li>
          <li className="list-group-item"><strong>{t.metricQualityReasons}:</strong> {selectedSession.summary.qualityReasons.join(' | ')}</li>
          <li className="list-group-item"><strong>{t.metricGpsChannelQualityStatus}:</strong> {qualityStatusText((selectedDataAvailability.gpsQualityStatus ?? selectedSession.summary.qualityStatus) as ActivitySummary['qualityStatus'], t)}</li>
          <li className="list-group-item"><strong>{t.metricGpsChannelQualityReasons}:</strong> {(selectedDataAvailability.gpsQualityReasons ?? selectedSession.summary.qualityReasons).join(' | ')}</li>
          <li className="list-group-item"><strong>{t.metricHeartRateChannelQualityStatus}:</strong> {qualityStatusText((selectedDataAvailability.heartRateQualityStatus ?? selectedSession.summary.qualityStatus) as ActivitySummary['qualityStatus'], t)}</li>
          <li className="list-group-item"><strong>{t.metricHeartRateChannelQualityReasons}:</strong> {(selectedDataAvailability.heartRateQualityReasons ?? selectedSession.summary.qualityReasons).join(' | ')}</li>
          <li className="list-group-item"><strong>{t.uploadQualityImpacts}:</strong> {qualityImpactItems.length > 0 ? qualityImpactItems.join(' | ') : t.notAvailable}</li>
        </ul>

        <h4>Processing & profile</h4>
        <ul className="metrics-list list-group">
          <li className="list-group-item"><strong>{t.metricDataChange}:</strong> {dataChangeMetric}</li>
          <li className="list-group-item"><strong>{t.filterSourceLabel}:</strong> {selectedFilterSource}</li>
          <li className="list-group-item"><strong>{t.sessionSpeedUnitSourceLabel}:</strong> {selectedSession.selectedSpeedUnitSource === 'ManualOverride' ? t.speedUnitSourceManualOverride : selectedSession.selectedSpeedUnitSource === 'ProfileRecalculation' ? t.speedUnitSourceProfileRecalculation : t.speedUnitSourceProfileDefault}</li>
          <li className="list-group-item"><strong>{t.metricSmoothingStrategy}:</strong> {selectedSession.summary.smoothing.selectedStrategy}</li>
          <li className="list-group-item"><strong>{t.metricSmoothingOutlier}:</strong> {`${selectedSession.summary.smoothing.selectedParameters.OutlierDetectionMode ?? 'NotAvailable'} (threshold: ${selectedSession.summary.smoothing.selectedParameters.EffectiveOutlierSpeedThresholdMps ?? '12.5'} m/s)`}</li>
        </ul>
      </div>
    );
  };

  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'local';

  const jumpToSection = useCallback((sectionId: string, sessionSubpage?: SessionSubpage) => {
    if (sessionSubpage) {
      setActiveSessionSubpage(sessionSubpage);
    }

    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    setIsMobileNavOpen(false);
  }, []);


  const writePeakContextToUrl = useCallback((params: { trackKey: TimelineTrackKey; startSecond: number; endSecond: number; label: string; windowMinutes: 1 | 2 | 5 } | null) => {
    const url = new URL(window.location.href);
    if (!params) {
      url.searchParams.delete('peakTrack');
      url.searchParams.delete('peakStart');
      url.searchParams.delete('peakEnd');
      url.searchParams.delete('peakLabel');
      url.searchParams.delete('peakWindow');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      return;
    }

    url.searchParams.set('peakTrack', params.trackKey);
    url.searchParams.set('peakStart', String(params.startSecond));
    url.searchParams.set('peakEnd', String(params.endSecond));
    url.searchParams.set('peakLabel', params.label);
    url.searchParams.set('peakWindow', String(params.windowMinutes));
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, []);

  const openTimelineWithFocus = useCallback((seriesKey: TimelineTrackKey) => {
    setTimelineScrollTarget(seriesKey);
    setActiveAnalysisTab('timeline');
    jumpToSection('session-analysis', 'analysis');
  }, [jumpToSection]);


  const getSessionMobileNavValue = useCallback(() => {
    if (activeSessionSubpage === 'analysis') {
      return activeAnalysisTab;
    }

    if (activeSessionSubpage === 'sessionSettings') {
      return 'sessionSettings';
    }

    if (activeSessionSubpage === 'technicalInfo') {
      return 'technicalInfo';
    }

    if (activeSessionSubpage === 'segments') {
      return 'segments';
    }

    if (activeSessionSubpage === 'segmentEdit') {
      return 'segmentEdit';
    }

    return 'compare';
  }, [activeAnalysisTab, activeSessionSubpage]);

  const navigateSessionMobile = useCallback((target: string) => {
    if (target === 'overview' || target === 'timeline' || target === 'peakDemand' || target === 'heatmap') {
      setActiveAnalysisTab(target as SessionAnalysisTab);
      jumpToSection('session-analysis', 'analysis');
      return;
    }

    if (target === 'sessionSettings') {
      jumpToSection('session-settings', 'sessionSettings');
      return;
    }

    if (target === 'technicalInfo') {
      jumpToSection('session-technical-info', 'technicalInfo');
      return;
    }

    if (target === 'segments') {
      jumpToSection('session-segments', 'segments');
      return;
    }

    if (target === 'segmentEdit') {
      jumpToSection('session-segment-edit', 'segmentEdit');
      return;
    }

    jumpToSection('session-compare', 'compare');
  }, [jumpToSection]);
  if (shouldGateInitialRender && !isInitialDataHydrated) {
    return <div className="app-shell" data-theme={theme} />;
  }


  return (
    <div className={`app-shell ${isMobileNavOpen ? 'app-shell--menu-open' : ''}`} data-theme={theme}>
      <aside className={`side-nav ${isMobileNavOpen ? 'side-nav--open' : ''}`}>
        <div className="side-nav__header">
          <strong
            className="side-nav__brand"
            role="button"
            tabIndex={0}
            onClick={() => {
              setActiveMainPage('sessions');
              jumpToSection('session-list');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActiveMainPage('sessions');
                jumpToSection('session-list');
              }
            }}
          >
            Football Metrics
          </strong>
          <button type="button" className="side-nav__close" onClick={() => setIsMobileNavOpen(false)} aria-label="Close navigation">×</button>
        </div>
        <nav className="side-nav__menu" aria-label="Primary navigation">
          <button type="button" className={`side-nav__item ${activeMainPage === 'sessions' ? 'side-nav__item--active' : ''}`} onClick={() => { setActiveMainPage('sessions'); jumpToSection('session-list'); }}>Sessions</button>
          <button type="button" className={`side-nav__item ${activeMainPage === 'upload' ? 'side-nav__item--active' : ''}`} onClick={() => { setActiveMainPage('upload'); setActiveSessionSubpage('analysis'); jumpToSection('upload-flow'); }}>Upload area</button>
          <button type="button" className={`side-nav__item ${activeMainPage === 'profile' ? 'side-nav__item--active' : ''}`} onClick={() => { setActiveMainPage('profile'); jumpToSection('profile-settings'); }}>Profile</button>
        </nav>
        {selectedSession && activeMainPage === "session" && isSessionMenuVisible && (
          <div className="side-nav__session-subpages">
            <p>Session</p>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'analysis' && activeAnalysisTab === 'overview' ? 'side-nav__item--active' : ''}`} onClick={() => { setActiveAnalysisTab('overview'); jumpToSection('session-analysis', 'analysis'); }}>{t.sessionSubpageOverview}</button>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'analysis' && activeAnalysisTab === 'timeline' ? 'side-nav__item--active' : ''}`} onClick={() => { setActiveAnalysisTab('timeline'); jumpToSection('session-analysis', 'analysis'); }}>{t.sessionSubpageTimeline}</button>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'analysis' && activeAnalysisTab === 'peakDemand' ? 'side-nav__item--active' : ''}`} onClick={() => { setActiveAnalysisTab('peakDemand'); jumpToSection('session-analysis', 'analysis'); }}>{t.sessionSubpagePeakDemand}</button>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'segments' ? 'side-nav__item--active' : ''}`} onClick={() => { setActiveAnalysisTab('segments'); jumpToSection('session-segments', 'segments'); }}>{t.sessionSubpageSegments}</button>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'analysis' && activeAnalysisTab === 'heatmap' ? 'side-nav__item--active' : ''}`} onClick={() => { setActiveAnalysisTab('heatmap'); jumpToSection('session-analysis', 'analysis'); }}>{t.sessionSubpageHeatmap}</button>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'sessionSettings' ? 'side-nav__item--active' : ''}`} onClick={() => jumpToSection('session-settings', 'sessionSettings')}>{t.sessionSubpageSessionSettings}</button>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'technicalInfo' ? 'side-nav__item--active' : ''}`} onClick={() => jumpToSection('session-technical-info', 'technicalInfo')}>{t.sessionSubpageTechnicalInfo}</button>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'segmentEdit' ? 'side-nav__item--active' : ''}`} onClick={() => jumpToSection('session-segment-edit', 'segmentEdit')}>{t.sessionSubpageSegmentEdit}</button>
            <button type="button" className={`side-nav__item ${activeSessionSubpage === 'compare' ? 'side-nav__item--active' : ''}`} onClick={() => jumpToSection('session-compare', 'compare')}>{t.sessionSubpageCompare}</button>
          </div>
        )}
        <div className="side-nav__meta" aria-label="Application version">v{appVersion}</div>
      </aside>
      <div className={`side-nav-overlay ${isMobileNavOpen ? 'side-nav-overlay--open' : ''}`} onClick={() => setIsMobileNavOpen(false)} />
      <main className="container">
      <div className="mobile-topbar">
        <button type="button" className="burger-menu" onClick={() => setIsMobileNavOpen((current) => !current)} aria-label="Open navigation menu">☰</button>
      </div>
      {selectedSession && activeMainPage === 'session' && (
        <div className="mobile-session-nav">
          <label className="form-label" htmlFor="mobile-session-nav-selector">{t.mobileSessionNavigationLabel}</label>
          <select
            id="mobile-session-nav-selector"
            className="form-select"
            value={getSessionMobileNavValue()}
            onChange={(event) => navigateSessionMobile(event.target.value)}
          >
            <option value="overview">{t.sessionSubpageOverview}</option>
            <option value="timeline">{t.sessionSubpageTimeline}</option>
            <option value="peakDemand">{t.sessionSubpagePeakDemand}</option>
            <option value="segments">{t.sessionSubpageSegments}</option>
            <option value="heatmap">{t.sessionSubpageHeatmap}</option>
            <option value="sessionSettings">{t.sessionSubpageSessionSettings}</option>
            <option value="technicalInfo">{t.sessionSubpageTechnicalInfo}</option>
            <option value="segmentEdit">{t.sessionSubpageSegmentEdit}</option>
            <option value="compare">{t.sessionSubpageCompare}</option>
          </select>
        </div>
      )}
      {activeMainPage === 'upload' && (
        <>
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
          <p className="subtitle">{t.maxFileSize}</p>
        </>
      )}

      <section className={`profile-settings ${activeMainPage === "profile" ? "" : "is-hidden"}`} id="profile-settings">
        <h2>{t.profileSettingsTitle}</h2>
        <h3>{t.profileAppearanceTitle}</h3>
        <div className="profile-theme-switch" role="group" aria-label="Theme switch">
          <span>{t.profilePreferredTheme}</span>
          <div className="profile-theme-switch__controls">
            <button type="button" className={theme === "light" ? "theme-btn theme-btn--active" : "theme-btn"} onClick={() => void onThemeSelect("light")}>Light</button>
            <button type="button" className={theme === "dark" ? "theme-btn theme-btn--active" : "theme-btn"} onClick={() => void onThemeSelect("dark")}>Dark</button>
          </div>
        </div>
        <label className="form-label" htmlFor="profile-preferred-language">{t.profilePreferredLanguage}</label>
        <select className="form-select"
          id="profile-preferred-language"
          value={profileForm.preferredLocale ?? browserLocale}
          onChange={(event) => {
            const nextLocale = event.target.value as Locale;
            setProfileForm((current) => ({ ...current, preferredLocale: nextLocale }));
            setLocale(nextLocale);
            setMessage(translations[nextLocale].defaultMessage);
          }}
        >
          <option value="en">{t.languageEnglish}</option>
          <option value="de">{t.languageGerman}</option>
        </select>
        <p>{t.profilePreferredLanguageHelp}</p>
        <form onSubmit={onProfileSubmit} className="vstack gap-2">
          <label className="form-label" htmlFor="profile-primary-position">{t.profilePrimaryPosition}</label>
          <select className="form-select"
            id="profile-primary-position"
            value={profileForm.primaryPosition}
            onChange={(event) => setProfileForm((current) => ({ ...current, primaryPosition: event.target.value as PlayerPosition }))}
          >
            {playerPositions.map((position) => (
              <option key={position} value={position}>{playerPositionLabels[locale][position]}</option>
            ))}
          </select>

          <label className="form-label" htmlFor="profile-secondary-position">{t.profileSecondaryPosition} ({t.profileSecondaryOptional})</label>
          <select className="form-select"
            id="profile-secondary-position"
            value={profileForm.secondaryPosition ?? ''}
            onChange={(event) => setProfileForm((current) => ({
              ...current,
              secondaryPosition: event.target.value ? event.target.value as PlayerPosition : null
            }))}
          >
            <option value="">{t.notAvailable}</option>
            {playerPositions.map((position) => (
              <option key={position} value={position}>{playerPositionLabels[locale][position]}</option>
            ))}
          </select>

          <label className="form-label" htmlFor="profile-default-filter">{t.profileDefaultSmoothingFilter}</label>
          <select className="form-select"
            id="profile-default-filter"
            value={profileForm.defaultSmoothingFilter}
            onChange={(event) => setProfileForm((current) => ({ ...current, defaultSmoothingFilter: event.target.value as SmoothingFilter }))}
          >
            {smoothingFilterOptions.map((option) => (
              <option key={`profile-default-filter-${option}`} value={option}>
                {option === 'AdaptiveMedian' ? `${getFilterLabel(option, t)} (${t.filterRecommendedBadge})` : getFilterLabel(option, t)}
              </option>
            ))}
          </select>
          <p>{t.profileDefaultSmoothingFilterHelp}</p>

          <label className="form-label" htmlFor="profile-preferred-speed-unit">{t.profilePreferredSpeedUnit}</label>
          <select className="form-select"
            id="profile-preferred-speed-unit"
            value={profileForm.preferredSpeedUnit}
            onChange={(event) => setProfileForm((current) => ({ ...current, preferredSpeedUnit: event.target.value as SpeedUnit }))}
          >
            <option value="km/h">km/h</option>
            <option value="mph">mph</option>
            <option value="m/s">m/s</option>
            <option value="min/km">min/km</option>
          </select>
          <p>{t.profilePreferredSpeedUnitHelp}</p>

          <label className="form-label" htmlFor="profile-preferred-aggregation-window">{t.profilePreferredAggregationWindow}</label>
          <select className="form-select"
            id="profile-preferred-aggregation-window"
            value={profileForm.preferredAggregationWindowMinutes}
            onChange={(event) => setProfileForm((current) => ({ ...current, preferredAggregationWindowMinutes: Number(event.target.value) as 1 | 2 | 5 }))}
          >
            <option value={1}>{t.intervalAggregationWindow1}</option>
            <option value={2}>{t.intervalAggregationWindow2}</option>
            <option value={5}>{t.intervalAggregationWindow5}</option>
          </select>
          <p>{t.profilePreferredAggregationWindowHelp}</p>

          <details className="analysis-disclosure">
            <summary className="analysis-disclosure__toggle"><span>{t.profileThresholdsTitle}</span></summary>
            <div className="analysis-disclosure__content">
              <label className="form-label" htmlFor="profile-threshold-max-speed">Max speed ({profileForm.preferredSpeedUnit})</label>
              <input className="form-control"
                id="profile-threshold-max-speed"
                type="number"
                step={profileForm.preferredSpeedUnit === "min/km" ? "0.01" : "0.1"}
                value={displayedMaxSpeedByPreferredUnit.toFixed(profileForm.preferredSpeedUnit === "min/km" ? 2 : 1)}
                readOnly={profileForm.metricThresholds.maxSpeedMode === 'Adaptive'}
                onChange={(event) => setProfileForm((current) => ({
                  ...current,
                  metricThresholds: { ...current.metricThresholds, maxSpeedMps: convertSpeedToMetersPerSecond(Number(event.target.value), current.preferredSpeedUnit) }
                }))}
              />
              <label className="form-label" htmlFor="profile-threshold-sprint-mode">{t.profileThresholdMaxSpeedMode}</label>
              <select className="form-select"
                id="profile-threshold-sprint-mode"
                value={profileForm.metricThresholds.maxSpeedMode}
                onChange={(event) => setProfileForm((current) => ({
                  ...current,
                  metricThresholds: { ...current.metricThresholds, maxSpeedMode: event.target.value as 'Fixed' | 'Adaptive' }
                }))}
              >
                <option value="Fixed">{t.profileThresholdModeFixed}</option>
                <option value="Adaptive">{t.profileThresholdModeAdaptive}</option>
              </select>

              <label className="form-label" htmlFor="profile-threshold-max-heartrate">Max heartrate (bpm)</label>
              <input className="form-control"
                id="profile-threshold-max-heartrate"
                type="number"
                step="1"
                value={displayedMaxHeartRateBpm}
                readOnly={profileForm.metricThresholds.maxHeartRateMode === 'Adaptive'}
                onChange={(event) => setProfileForm((current) => ({
                  ...current,
                  metricThresholds: { ...current.metricThresholds, maxHeartRateBpm: Number(event.target.value) }
                }))}
              />
              <label className="form-label" htmlFor="profile-threshold-high-intensity-mode">{t.profileThresholdMaxHeartRateMode}</label>
              <select className="form-select"
                id="profile-threshold-high-intensity-mode"
                value={profileForm.metricThresholds.maxHeartRateMode}
                onChange={(event) => setProfileForm((current) => ({
                  ...current,
                  metricThresholds: { ...current.metricThresholds, maxHeartRateMode: event.target.value as 'Fixed' | 'Adaptive' }
                }))}
              >
                <option value="Fixed">{t.profileThresholdModeFixed}</option>
                <option value="Adaptive">{t.profileThresholdModeAdaptive}</option>
              </select>

              <label className="form-label" htmlFor="profile-threshold-sprint">{t.profileThresholdSprint}</label>
              <input className="form-control"
                id="profile-threshold-sprint"
                type="number"
                step="0.1"
                value={profileForm.metricThresholds.sprintSpeedPercentOfMaxSpeed}
                onChange={(event) => setProfileForm((current) => ({
                  ...current,
                  metricThresholds: { ...current.metricThresholds, sprintSpeedPercentOfMaxSpeed: Number(event.target.value) }
                }))}
              />
              <p>{t.profileDerivedSprintThreshold}: {formatSpeed(sprintThresholdMpsPreview, profileForm.preferredSpeedUnit, t.notAvailable)}</p>
              <label className="form-label" htmlFor="profile-threshold-high-intensity">{t.profileThresholdHighIntensity}</label>
              <input className="form-control"
                id="profile-threshold-high-intensity"
                type="number"
                step="0.1"
                value={profileForm.metricThresholds.highIntensitySpeedPercentOfMaxSpeed}
                onChange={(event) => setProfileForm((current) => ({
                  ...current,
                  metricThresholds: { ...current.metricThresholds, highIntensitySpeedPercentOfMaxSpeed: Number(event.target.value) }
                }))}
              />
              <p>{t.profileDerivedHighIntensityThreshold}: {formatSpeed(highIntensityThresholdMpsPreview, profileForm.preferredSpeedUnit, t.notAvailable)}</p>

              <p className="profile-thresholds__group-title">{t.profileAccelBandsTitle}</p>
              <label className="form-label" htmlFor="profile-threshold-accel-moderate">{t.profileThresholdModerateAccel}</label>
              <input className="form-control" id="profile-threshold-accel-moderate" type="number" step="0.1" value={profileForm.metricThresholds.moderateAccelerationThresholdMps2}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, moderateAccelerationThresholdMps2: Number(event.target.value) } }))}
              />
              <label className="form-label" htmlFor="profile-threshold-accel-high">{t.profileThresholdHighAccel}</label>
              <input className="form-control" id="profile-threshold-accel-high" type="number" step="0.1" value={profileForm.metricThresholds.highAccelerationThresholdMps2}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, highAccelerationThresholdMps2: Number(event.target.value) } }))}
              />
              <label className="form-label" htmlFor="profile-threshold-accel-veryhigh">{t.profileThresholdVeryHighAccel}</label>
              <input className="form-control" id="profile-threshold-accel-veryhigh" type="number" step="0.1" value={profileForm.metricThresholds.veryHighAccelerationThresholdMps2}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, veryHighAccelerationThresholdMps2: Number(event.target.value) } }))}
              />

              <p className="profile-thresholds__group-title">{t.profileDecelBandsTitle}</p>
              <label className="form-label" htmlFor="profile-threshold-decel-moderate">{t.profileThresholdModerateDecel}</label>
              <input className="form-control" id="profile-threshold-decel-moderate" type="number" step="0.1" value={profileForm.metricThresholds.moderateDecelerationThresholdMps2}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, moderateDecelerationThresholdMps2: Number(event.target.value) } }))}
              />
              <label className="form-label" htmlFor="profile-threshold-decel-high">{t.profileThresholdHighDecel}</label>
              <input className="form-control" id="profile-threshold-decel-high" type="number" step="0.1" value={profileForm.metricThresholds.highDecelerationThresholdMps2}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, highDecelerationThresholdMps2: Number(event.target.value) } }))}
              />
              <label className="form-label" htmlFor="profile-threshold-decel-veryhigh">{t.profileThresholdVeryHighDecel}</label>
              <input className="form-control" id="profile-threshold-decel-veryhigh" type="number" step="0.1" value={profileForm.metricThresholds.veryHighDecelerationThresholdMps2}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, veryHighDecelerationThresholdMps2: Number(event.target.value) } }))}
              />

              <label className="form-label" htmlFor="profile-threshold-accel-decel-min-speed">{t.profileThresholdAccelDecelMinSpeed} ({profileForm.preferredSpeedUnit})</label>
              <input className="form-control"
                id="profile-threshold-accel-decel-min-speed"
                type="number"
                step={profileForm.preferredSpeedUnit === "min/km" ? "0.01" : "0.1"}
                value={displayedAccelDecelMinSpeedByPreferredUnit.toFixed(profileForm.preferredSpeedUnit === "min/km" ? 2 : 1)}
                onChange={(event) => setProfileForm((current) => ({
                  ...current,
                  metricThresholds: {
                    ...current.metricThresholds,
                    accelDecelMinimumSpeedMps: convertSpeedToMetersPerSecond(Number(event.target.value), current.preferredSpeedUnit)
                  }
                }))}
              />


              <p className="profile-thresholds__group-title">{t.profileCodBandsTitle}</p>
              <label className="form-label" htmlFor="profile-threshold-cod-moderate">{t.profileThresholdCodModerate}</label>
              <input className="form-control" id="profile-threshold-cod-moderate" type="number" step="1" value={profileForm.metricThresholds.codModerateThresholdDegrees}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, codModerateThresholdDegrees: Number(event.target.value) } }))}
              />
              <label className="form-label" htmlFor="profile-threshold-cod-high">{t.profileThresholdCodHigh}</label>
              <input className="form-control" id="profile-threshold-cod-high" type="number" step="1" value={profileForm.metricThresholds.codHighThresholdDegrees}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, codHighThresholdDegrees: Number(event.target.value) } }))}
              />
              <label className="form-label" htmlFor="profile-threshold-cod-veryhigh">{t.profileThresholdCodVeryHigh}</label>
              <input className="form-control" id="profile-threshold-cod-veryhigh" type="number" step="1" value={profileForm.metricThresholds.codVeryHighThresholdDegrees}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, codVeryHighThresholdDegrees: Number(event.target.value) } }))}
              />
              <label className="form-label" htmlFor="profile-threshold-cod-min-speed">{t.profileThresholdCodMinSpeed} ({profileForm.preferredSpeedUnit})</label>
              <input className="form-control"
                id="profile-threshold-cod-min-speed"
                type="number"
                step={profileForm.preferredSpeedUnit === "min/km" ? "0.01" : "0.1"}
                value={convertSpeedFromMetersPerSecond(profileForm.metricThresholds.codMinimumSpeedMps, profileForm.preferredSpeedUnit).toFixed(profileForm.preferredSpeedUnit === "min/km" ? 2 : 1)}
                onChange={(event) => setProfileForm((current) => ({
                  ...current,
                  metricThresholds: {
                    ...current.metricThresholds,
                    codMinimumSpeedMps: convertSpeedToMetersPerSecond(Number(event.target.value), current.preferredSpeedUnit)
                  }
                }))}
              />
              <label className="form-label" htmlFor="profile-threshold-cod-consecutive">{t.profileThresholdCodConsecutive}</label>
              <input className="form-control" id="profile-threshold-cod-consecutive" type="number" min="1" max="5" step="1" value={profileForm.metricThresholds.codConsecutiveSamplesRequired}
                onChange={(event) => setProfileForm((current) => ({ ...current, metricThresholds: { ...current.metricThresholds, codConsecutiveSamplesRequired: Number(event.target.value) } }))}
              />
            </div>
          </details>

          <p>{t.profileEffectiveMaxSpeed}: {formatSpeed(profileForm.metricThresholds.effectiveMaxSpeedMps, profileForm.preferredSpeedUnit, t.notAvailable)} ({profileForm.metricThresholds.maxSpeedMode})</p>
          <p>{t.profileEffectiveMaxHeartRate}: {profileForm.metricThresholds.effectiveMaxHeartRateBpm} bpm ({profileForm.metricThresholds.maxHeartRateMode})</p>
          <p>{t.profileAdaptiveDataBasisHint}</p>

          <p>{t.profileThresholdVersion}: {profileForm.metricThresholds.version}</p>
          <p>{t.profileThresholdUpdatedAt}: {formatUtcDateTime(profileForm.metricThresholds.updatedAtUtc, t.notAvailable)}</p>

          <button type="submit" className="btn-primary">{t.profileSave}</button>
          <button type="button" className="secondary-button" onClick={onTriggerProfileRecalculation}>{t.profileRecalculateAllButton}</button>
        </form>
        <p>
          {interpolate(t.profileCurrentPosition, {
            primary: playerPositionLabels[locale][profileForm.primaryPosition],
            secondary: profileForm.secondaryPosition ? playerPositionLabels[locale][profileForm.secondaryPosition] : t.notAvailable
          })}
        </p>
        {profileValidationMessage ? <p>{profileValidationMessage}</p> : null}
        {latestProfileRecalculationJob && profileRecalculationStatusText ? (
          <p>
            {t.profileRecalculationStatusTitle}: {profileRecalculationStatusText} · {formatLocalDateTime(latestProfileRecalculationJob.requestedAtUtc)} · v{latestProfileRecalculationJob.profileThresholdVersion} · {latestProfileRecalculationJob.updatedSessions}/{latestProfileRecalculationJob.totalSessions}
            {latestProfileRecalculationJob.failedSessions > 0 ? ` (${latestProfileRecalculationJob.failedSessions} failed)` : ''}
            {latestProfileRecalculationJob.errorMessage ? ` - ${latestProfileRecalculationJob.errorMessage}` : ''}
          </p>
        ) : null}
        {profileRecalculationToast ? (
          <div className="toast-notification" role="status" aria-live="polite">
            <span>{profileRecalculationToast}</span>
            <button type="button" className="toast-notification__close" aria-label="Dismiss notification" onClick={() => setProfileRecalculationToast(null)}>×</button>
          </div>
        ) : null}
      </section>
      <form onSubmit={handleSubmit} id="upload-flow" className={`upload-form ${activeMainPage === "upload" ? "" : "is-hidden"}`}>
        <label
          className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
        >
          <div className="upload-form__drop-content">
            <span className="upload-form__drop-title">{t.dropzoneText}</span>
            <span className="upload-form__drop-action">{t.uploadChooseFile}</span>
            <span className="upload-form__file-name">{selectedFile ? selectedFile.name : t.defaultMessage}</span>
          </div>
          <input className="upload-form__file-input form-control" type="file" accept=".tcx" onChange={onFileInputChange} aria-label={t.fileInputAriaLabel} disabled={isUploading} />
        </label>
        <button type="submit" className="upload-form__submit btn-primary" disabled={!canSubmit}>
          {t.uploadButton}
        </button>
      </form>
      {!(activeMainPage === 'session' && !validationMessage && message === t.defaultMessage) && <p>{validationMessage ?? message}</p>}

      <section id="session-list" className={activeMainPage === "sessions" ? "" : "is-hidden"}>
        <h2>{t.historyTitle}</h2>
        <div className="history-toolbar">
          <button
            type="button"
            className="secondary-button history-filter-open-button"
            onClick={() => setIsHistoryFilterSidebarOpen(true)}
          >
            {t.historyFilterOpen}{activeHistoryFilterCount > 0 ? ` (${activeHistoryFilterCount})` : ''}
          </button>
        </div>

        <div className={`history-filter-overlay ${isHistoryFilterSidebarOpen ? 'is-open' : ''}`} onClick={() => setIsHistoryFilterSidebarOpen(false)} />
        <aside className={`history-filter-sidebar ${isHistoryFilterSidebarOpen ? 'is-open' : ''}`} aria-label={t.historyFilterSidebarTitle}>
          <div className="history-filter-sidebar__header">
            <h3>{t.historyFilterSidebarTitle}</h3>
            <button type="button" className="secondary-button" onClick={() => setIsHistoryFilterSidebarOpen(false)}>{t.historyFilterClose}</button>
          </div>

          <div className="history-controls history-controls--filters history-controls--sidebar">
            <p className="history-filter-defaults">{t.historyFilterDefaultsHint}</p>
            <div className="history-filter-group">
              <label className="form-label" htmlFor="history-sort-selector">{t.historySortLabel}</label>
              <select className="form-select" id="history-sort-selector" value={draftSortDirection} onChange={(event) => setDraftSortDirection(event.target.value as SortDirection)}>
                <option value="desc">{t.historySortNewest}</option>
                <option value="asc">{t.historySortOldest}</option>
              </select>
            </div>

            <div className="history-filter-group">
              <label className="form-label" htmlFor="history-quality-filter">{t.historyFilterQualityStatus}</label>
              <select className="form-select" id="history-quality-filter" value={draftQualityStatusFilter} onChange={(event) => setDraftQualityStatusFilter(event.target.value as 'All' | ActivitySummary['qualityStatus'])}>
                <option value="All">{t.historyFilterQualityAll}</option>
                <option value="High">{qualityStatusText('High', t)}</option>
                <option value="Medium">{qualityStatusText('Medium', t)}</option>
                <option value="Low">{qualityStatusText('Low', t)}</option>
              </select>
            </div>

            <fieldset className="history-filter-group history-filter-group--types">
              <legend>{t.historyFilterSessionType}</legend>
              <div className="history-filter-pill-list">
                {availableSessionTypes.map((sessionType) => {
                  const isActive = draftSessionTypeFilters.includes(sessionType);
                  return (
                    <button
                      key={sessionType}
                      type="button"
                      className={`history-filter-pill ${isActive ? 'is-active' : ''}`}
                      aria-pressed={isActive}
                      onClick={() => {
                        setDraftSessionTypeFilters((current) => {
                          if (isActive) {
                            return current.filter((item) => item !== sessionType);
                          }
                          return [...current, sessionType];
                        });
                      }}
                    >
                      {sessionTypeText(sessionType, t)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="history-filter-group history-filter-group--date">
              <label className="form-label" htmlFor="history-date-from">{t.historyFilterDateFrom}</label>
              <input className="form-control" id="history-date-from" type="date" value={draftDateFromFilter} onFocus={(event) => event.currentTarget.showPicker?.()} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => setDraftDateFromFilter(event.target.value)} />
            </div>

            <div className="history-filter-group history-filter-group--date">
              <label className="form-label" htmlFor="history-date-to">{t.historyFilterDateTo}</label>
              <input className="form-control" id="history-date-to" type="date" value={draftDateToFilter} onFocus={(event) => event.currentTarget.showPicker?.()} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => setDraftDateToFilter(event.target.value)} />
            </div>

            <div className="history-filter-group history-filter-group--action">
              <button
                type="button"
                className="secondary-button history-filter-reset"
                onClick={() => {
                  setDraftSortDirection('desc');
                  setDraftSessionTypeFilters(availableSessionTypes);
                  setDraftQualityStatusFilter('All');
                  setDraftDateFromFilter(defaultDateBounds.from);
                  setDraftDateToFilter(defaultDateBounds.to);
                  setSortDirection('desc');
                  setSessionTypeFilters(availableSessionTypes);
                  setQualityStatusFilter('All');
                  setDateFromFilter(defaultDateBounds.from);
                  setDateToFilter(defaultDateBounds.to);
                  setIsHistoryFilterSidebarOpen(false);
                }}
              >
                {t.historyFilterReset}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setSortDirection(draftSortDirection);
                  setSessionTypeFilters(draftSessionTypeFilters);
                  setQualityStatusFilter(draftQualityStatusFilter);
                  setDateFromFilter(draftDateFromFilter);
                  setDateToFilter(draftDateToFilter);
                  setIsHistoryFilterSidebarOpen(false);
                }}
              >
                {t.historyFilterApply}
              </button>
            </div>
          </div>
        </aside>

        {filteredHistory.length === 0 ? (
          <p>{t.historyEmpty}</p>
        ) : (
          <table className="history-table table table-sm">
            <thead>
              <tr>
                <th>{t.historyColumnFileName}</th>
                <th>{t.historyColumnUploadTime}</th>
                <th>{t.historyColumnActivityTime}</th>
                <th>{t.historyColumnQuality}</th>
                <th>{t.historyColumnSessionType}</th>
                <th>{t.historyColumnDataMode}</th>
                <th>{t.historyOpenDetails}</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((record) => (
                <tr key={record.id}>
                  <td data-label={t.historyColumnFileName}>{record.fileName}</td>
                  <td data-label={t.historyColumnUploadTime}>{formatLocalDateTime(record.uploadedAtUtc)}</td>
                  <td data-label={t.historyColumnActivityTime}>{record.summary.activityStartTimeUtc ? formatLocalDateTime(record.summary.activityStartTimeUtc) : t.notAvailable}</td>
                  <td data-label={t.historyColumnQuality}>{qualityStatusText(record.summary.qualityStatus, t)}</td>
                  <td data-label={t.historyColumnSessionType}>{sessionTypeText(record.sessionContext.sessionType, t)}</td>
                  <td data-label={t.historyColumnDataMode}>{dataModeText(resolveDataAvailability(record.summary).mode, t)}</td>
                  <td data-label={t.historyOpenDetails}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        openSessionDetails(record);
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

      <section className={`session-compare ${activeMainPage === "session" && activeSessionSubpage === "compare" ? "" : "is-hidden"}`} aria-live="polite" id="session-compare">
        <h2>{t.sessionCompareTitle}</h2>
        <p>{t.sessionCompareHint}</p>
        {activeSessionType && selectedSession && (
          <>
            <h3>{t.sessionCompareSelectionTitle}</h3>
            <p>{t.sessionCompareSelectionHint}</p>
            <p>{interpolate(t.sessionCompareOnlySameTypeHint, { sessionType: sessionTypeText(activeSessionType, t) })}</p>
            <label className="form-label" htmlFor="comparison-session-selector">{t.sessionCompareDropdownLabel}</label>
            <select className="form-select"
              id="comparison-session-selector"
              value={compareOpponentSessionId ?? ''}
              onChange={(event) => setCompareOpponentSessionId(event.target.value || null)}
            >
              <option value="">{t.sessionCompareSelectSession}</option>
              <option value={selectedSession.id}>{selectedSession.fileName} ({t.sessionCompareActiveSessionBadge})</option>
              {compareSelectableSessions.map((record) => (
                <option key={record.id} value={record.id}>{record.fileName}</option>
              ))}
            </select>
            <p>{selectedSession.fileName} ({t.sessionCompareActiveSessionBadge})</p>
          </>
        )}
        {showCompareQualityWarning && <p className="quality-warning">{t.sessionCompareQualityWarning}</p>}
        {compareSessions.length < 2 ? (
          <p>{t.sessionCompareHint}</p>
        ) : (
          <table className="history-table comparison-table">
            <thead>
              <tr>
                <th>{t.compareTitle}</th>
                {compareSessions.map((session, index) => (
                  <th key={`${session.id}-${index}`}>{session.fileName}{compareBaseline?.id === session.id && index === 0 ? ' (baseline)' : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label={t.compareTitle}>{t.metricQualityStatus}</td>
                {compareSessions.map((session, index) => (
                  <td key={`${session.id}-quality-${index}`} data-label={session.fileName}>{qualityStatusText(session.summary.qualityStatus, t)}</td>
                ))}
              </tr>
              {comparisonRows.map((row) => (
                <tr key={row.key}>
                  <td data-label={t.compareTitle}>{row.label}</td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}-${compareSessions[index].id}-${index}`} data-label={compareSessions[index].fileName}>
                      <div>{cell.formattedValue}</div>
                      <div>{t.sessionCompareDelta}: {cell.deltaText}</div>
                      <div>{t.sessionCompareDeltaPercent}: {cell.deltaPercentText}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className={`history-filter-overlay ${isMetricInfoSidebarOpen ? 'is-open' : ''}`} onClick={() => setIsMetricInfoSidebarOpen(false)} />
      <aside className={`history-filter-sidebar ${isMetricInfoSidebarOpen ? 'is-open' : ''}`} aria-label={t.metricInfoSidebarTitle}>
        <div className="history-filter-sidebar__header">
          <h3>{activeMetricInfo?.label ?? t.metricInfoSidebarTitle}</h3>
          <button type="button" className="secondary-button" onClick={() => setIsMetricInfoSidebarOpen(false)}>{t.metricInfoSidebarClose}</button>
        </div>
        <div className="history-controls history-controls--sidebar metric-info-sidebar-content">
          <p>{activeMetricInfo?.helpText ?? t.notAvailable}</p>
        </div>
      </aside>

      {selectedSession && (
        <section className={`session-details ${activeMainPage === "session" ? "" : "is-hidden"}`} aria-live="polite" id="session-analysis">
          {(!selectedSession.isDetailed || isSessionDetailLoading) ? (
            <div className="analysis-disclosure__content">
              <p>{t.sessionDetailsLoading}</p>
            </div>
          ) : isQualityDetailsPageVisible ? (
            <section data-testid="upload-quality-step" className="upload-quality-step">
              <h3>{t.qualityDetailsSidebarTitle}</h3>
              <p>{t.uploadQualityStepIntro}</p>
              {renderQualityDetailsContent()}
              <div className="upload-quality-step__actions">
                <button type="button" className="btn-primary" onClick={() => setShowUploadQualityStep(false)}>{t.uploadQualityProceedToAnalysis}</button>
                <button type="button" className="secondary-button" onClick={() => { setShowUploadQualityStep(false); setActiveSessionSubpage('segmentEdit'); }}>{t.segmentEditEntryAfterUpload}</button>
              </div>
            </section>
          ) : (
            <>
              <h2>{t.summaryTitle}</h2>
              <p><strong>{t.historyColumnFileName}:</strong> {selectedSession.fileName}</p>
              <p><strong>{t.metricStartTime}:</strong> {selectedSession.summary.activityStartTimeUtc ? formatLocalDateTime(selectedSession.summary.activityStartTimeUtc) : t.notAvailable}</p>
              <p><strong>{t.metricDataMode}:</strong> {dataAvailabilitySummaryText(selectedSession.summary, t)}</p>
              {shouldShowSessionOverviewHeader && isSegmentScopeActive && selectedSegment && <p><strong>{t.segmentsTitle}:</strong> {segmentCategoryLabel(selectedSegment.category ?? 'Other', t)} · {selectedSegment.label} ({selectedSegment.startSecond}s-{selectedSegment.endSecond}s)</p>}
              {shouldShowSessionOverviewHeader && isSegmentScopeActive && <p><strong>{t.segmentScopeHint}</strong> <button type="button" className="secondary-button" onClick={() => { setAnalysisScope('session'); setActiveSessionSubpage('segments'); }}>{t.segmentBackToSegmentList}</button></p>}
              {shouldShowSessionOverviewHeader && isSegmentScopeActive && selectedSegment?.notes && <p><strong>{t.segmentNotes}:</strong> {selectedSegment.notes}</p>}
              {activeSessionSubpage === 'sessionSettings' && <h3>{t.sessionSubpageSessionSettings}</h3>}
              {activeSessionSubpage === 'technicalInfo' && <h3>{t.sessionSubpageTechnicalInfo}</h3>}
            </>
          )}

          {!isQualityDetailsPageVisible && !isSessionDetailLoading && (
          <div className="session-analysis-flow">
          <section id="session-settings" className={`analysis-disclosure analysis-block--session-context ${activeSessionSubpage === "sessionSettings" ? "" : "is-hidden"}`}>
            <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('sessionContext')} aria-expanded={analysisAccordionState.sessionContext}>
              <span>{t.sessionContextTitle}</span>
              <span className="analysis-disclosure__action">{analysisAccordionState.sessionContext ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
            </button>
            {analysisAccordionState.sessionContext && (
            <div className="analysis-disclosure__content">
            <div className="session-context">
            <label className="form-label" htmlFor="session-type-selector">{t.sessionTypeLabel}</label>
            <select className="form-select"
              id="session-type-selector"
              value={sessionContextForm.sessionType}
              onChange={(event) => setSessionContextForm((current) => ({ ...current, sessionType: event.target.value as SessionType }))}
            >
              <option value="Training">{t.sessionTypeTraining}</option>
              <option value="Match">{t.sessionTypeMatch}</option>
              <option value="Rehab">{t.sessionTypeRehab}</option>
              <option value="Athletics">{t.sessionTypeAthletics}</option>
              <option value="Other">{t.sessionTypeOther}</option>
            </select>

            {sessionContextForm.sessionType === 'Match' && (
              <>
                <label className="form-label" htmlFor="session-match-result">{t.sessionContextMatchResult}</label>
                <input className="form-control" id="session-match-result" value={sessionContextForm.matchResult ?? ''} onChange={(event) => setSessionContextForm((current) => ({ ...current, matchResult: event.target.value }))} />
                <label className="form-label" htmlFor="session-competition">{t.sessionContextCompetition}</label>
                <input className="form-control" id="session-competition" value={sessionContextForm.competition ?? ''} onChange={(event) => setSessionContextForm((current) => ({ ...current, competition: event.target.value }))} />
                <label className="form-label" htmlFor="session-opponent">{t.sessionContextOpponentName}</label>
                <input className="form-control" id="session-opponent" value={sessionContextForm.opponentName ?? ''} onChange={(event) => setSessionContextForm((current) => ({ ...current, opponentName: event.target.value }))} />
                <label className="form-label" htmlFor="session-opponent-logo">{t.sessionContextOpponentLogoUrl}</label>
                <input className="form-control" id="session-opponent-logo" value={sessionContextForm.opponentLogoUrl ?? ''} onChange={(event) => setSessionContextForm((current) => ({ ...current, opponentLogoUrl: event.target.value }))} />
              </>
            )}
            <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onSaveSessionContext}>{t.sessionContextSave}</button>
          </div>
          </div>
            )}
          </section>
          <div className={`segment-management ${activeSessionSubpage === "segments" ? "" : "is-hidden"}`} id="session-segments">
            <h3>{t.segmentsTitle}</h3>
            <p>{t.segmentSelectionHint}</p>
            {segmentActionError && <p className="segment-error" role="alert">{segmentActionError}</p>}
            {selectedSession.segments.length === 0 ? (
              <p>{t.segmentsEmpty}</p>
            ) : (
              <table className="history-table segment-table">
                <thead>
                  <tr>
                    <th>{t.segmentCategory}</th>
                    <th>{t.segmentLabel}</th>
                    <th>{t.segmentStartSecond}</th>
                    <th>{t.segmentEndSecond}</th>
                    <th>{t.historyOpenDetails}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSession.segments.map((segment) => (
                    <tr key={segment.id}>
                      <td data-label={t.segmentCategory}>{segmentCategoryLabel(segment.category ?? 'Other', t)}</td>
                      <td data-label={t.segmentLabel}>{segment.label}</td>
                      <td data-label={t.segmentStartSecond}>{segment.startSecond}</td>
                      <td data-label={t.segmentEndSecond}>{segment.endSecond}</td>
                      <td data-label={t.historyOpenDetails}>
                        <button type="button" className="secondary-button" onClick={() => { setSelectedSegmentId(segment.id); setAnalysisScope('segment'); setActiveSessionSubpage('analysis'); }}>{t.segmentAnalyzeAction}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={`segment-management ${activeSessionSubpage === "segmentEdit" ? "" : "is-hidden"}`} id="session-segment-edit">
            <h3>{t.segmentEditTitle}</h3>
            <section className="segment-timeline-helper" aria-label={t.segmentTimelineTitle}>
              <h4>{t.segmentManualAssistantTitle}</h4>
              <p>{t.segmentManualAssistantDescription}</p>
              <div className="segment-timeline-helper__legend">
                <span className="segment-timeline-helper__legend-item segment-timeline-helper__legend-item--internal">{t.segmentTimelineInternalCurve}</span>
                {selectedSession.summary.hasGpsData
                  ? <span className="segment-timeline-helper__legend-item segment-timeline-helper__legend-item--external">{t.segmentTimelineExternalCurve}</span>
                  : <span className="segment-timeline-helper__legend-item segment-timeline-helper__legend-item--external-unavailable">{t.segmentTimelineExternalUnavailable}</span>}
              </div>
              {selectedSession.segments.length === 0 ? (
                <p>{t.segmentManualAssistantNoSegments}</p>
              ) : (
                <>
                  <label className="form-label" htmlFor="active-segment-id">{t.segmentManualAssistantSelectedSegment}</label>
                  <select className="form-select" id="active-segment-id" value={selectedSegment?.id ?? ''} onChange={(event) => setSelectedSegmentId(event.target.value)}>
                    {selectedSession.segments.map((segment) => (
                      <option key={`assistant-${segment.id}`} value={segment.id}>{segment.label} ({formatSecondsMmSs(segment.startSecond)}-{formatSecondsMmSs(segment.endSecond)})</option>
                    ))}
                  </select>
                  <SegmentationAssistant
                    points={segmentAssistantPoints}
                    bounds={segmentAssistantBounds}
                    cursorSecond={clampedSegmentCursorSecond}
                    heartRateSamples={selectedSession.summary.heartRateSamples ?? []}
                    titleHeartRate={t.segmentManualAssistantHeartRateChartTitle}
                    titleMap={t.segmentManualAssistantMapTitle}
                    noHeartRateDataLabel={t.segmentManualAssistantHeartRateChartNoData}
                    currentPointLabel={t.segmentManualAssistantCurrentPoint}
                    currentHeartRateLabel={t.segmentManualAssistantCurrentHeartRate}
                    segmentStartSecond={selectedSegment?.startSecond ?? 0}
                    segmentEndSecond={selectedSegment?.endSecond ?? segmentAssistantMaxSecond}
                    zoomInLabel={t.gpsHeatmapZoomIn}
                    zoomOutLabel={t.gpsHeatmapZoomOut}
                    zoomResetLabel={t.gpsHeatmapZoomReset}
                    sessionId={selectedSession.id}
                    topControls={(
                      <div className="segment-manual-assistant__middle-controls">
                        <div className="segment-suggestion-list__actions">
                          <button type="button" className="secondary-button" onClick={onSplitAtCursor}>{t.segmentManualAssistantSplitAtCursor}</button>
                          <button type="button" className="secondary-button" onClick={() => onSetSegmentBoundaryFromCursor('start')}>{t.segmentManualAssistantSetStart}</button>
                          <button type="button" className="secondary-button" onClick={() => onSetSegmentBoundaryFromCursor('end')}>{t.segmentManualAssistantSetEnd}</button>
                        </div>
                      </div>
                    )}
                    betweenControls={(
                      <div className="segment-manual-assistant__middle-controls">
                        <label className="form-label" htmlFor="segment-timeline-cursor">
                          {t.segmentManualAssistantSliderLabel}: {formatSecondsMmSs(clampedSegmentCursorSecond)} ({Math.floor(clampedSegmentCursorSecond)}s) / {t.segmentManualAssistantSegmentTime}: {formatSecondsMmSs(Math.max(0, clampedSegmentCursorSecond - segmentAssistantMinSecond))} ({Math.max(0, Math.floor(clampedSegmentCursorSecond - segmentAssistantMinSecond))}s)
                        </label>
                        <input
                          id="segment-timeline-cursor"
                          className="form-range"
                          type="range"
                          min={selectedSegment?.startSecond ?? 0}
                          max={selectedSegment?.endSecond ?? segmentAssistantMaxSecond}
                          step={0.25}
                          value={clampedSegmentCursorSecond}
                          onChange={(event) => setSegmentCursorSecond(Number(event.target.value))}
                        />
                        <div className="segment-suggestion-list__actions">
                          <button type="button" className="secondary-button" onClick={() => setSegmentCursorSecond((current) => Math.max(selectedSegment?.startSecond ?? 0, current - 5))}>-5s</button>
                          <button type="button" className="secondary-button" onClick={() => setSegmentCursorSecond((current) => Math.max(selectedSegment?.startSecond ?? 0, current - 1))}>-1s</button>
                          <button type="button" className="secondary-button" onClick={() => setSegmentCursorSecond((current) => Math.min(selectedSegment?.endSecond ?? segmentAssistantMaxSecond, current + 1))}>+1s</button>
                          <button type="button" className="secondary-button" onClick={() => setSegmentCursorSecond((current) => Math.min(selectedSegment?.endSecond ?? segmentAssistantMaxSecond, current + 5))}>+5s</button>
                        </div>
                      </div>
                    )}
                  />
                </>
              )}
            </section>
            <table className="history-table segment-table">
              <thead>
                <tr>
                  <th>{t.segmentCategory}</th>
                  <th>{t.segmentLabel}</th>
                  <th>{t.segmentStartSecond}</th>
                  <th>{t.segmentEndSecond}</th>
                  <th>{t.historyOpenDetails}</th>
                </tr>
              </thead>
              <tbody>
                {selectedSession.segments.map((segment) => (
                  <tr key={`edit-${segment.id}`}>
                    <td data-label={t.segmentCategory}>{segmentCategoryLabel(segment.category ?? 'Other', t)}</td>
                    <td data-label={t.segmentLabel}>{segment.label}</td>
                    <td data-label={t.segmentStartSecond}>{segment.startSecond}</td>
                    <td data-label={t.segmentEndSecond}>{segment.endSecond}</td>
                    <td className="segment-table__actions" data-label={t.historyOpenDetails}>
                      <button type="button" className="secondary-button" onClick={() => onEditSegment(segment)}>{t.segmentEdit}</button>
                      <button type="button" className="secondary-button" onClick={() => { setMergeForm((current) => ({ ...current, sourceSegmentId: segment.id, targetSegmentId: selectedSession.segments.find((candidate) => candidate.id !== segment.id)?.id ?? '' })); setSegmentEditorsOpen({ edit: false, merge: true, split: false }); }}>{t.segmentMergeAction}</button>
                      <button type="button" className="secondary-button" onClick={() => { const midpoint = Math.floor((segment.startSecond + segment.endSecond) / 2); setSplitForm({ segmentId: segment.id, splitSecond: String(midpoint), leftLabel: '', rightLabel: '', notes: segment.notes ?? '' }); setSegmentEditorsOpen({ edit: false, merge: false, split: true }); }}>{t.segmentSplitAction}</button>
                      <button type="button" className="secondary-button danger-button" onClick={() => onDeleteSegment(segment.id)}>{t.segmentDelete}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <section className="analysis-disclosure">
              <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleSegmentEditor('edit')} aria-expanded={segmentEditorsOpen.edit}>
                <span>{t.segmentEdit}</span>
                <span className="analysis-disclosure__action">{segmentEditorsOpen.edit ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
              </button>
              {segmentEditorsOpen.edit && <div className="segment-form">
              <label className="form-label" htmlFor="segment-category">{t.segmentCategory}</label>
              <select className="form-select" id="segment-category" value={segmentForm.category} onChange={(event) => setSegmentForm((current) => ({ ...current, category: event.target.value as SegmentCategory }))}>{segmentCategoryOptions.map((option) => <option key={option} value={option}>{segmentCategoryLabel(option, t)}</option>)}</select>
              <label className="form-label" htmlFor="segment-label">{t.segmentLabel}</label>
              <input className="form-control" id="segment-label" value={segmentForm.label} onChange={(event) => setSegmentForm((current) => ({ ...current, label: event.target.value }))} />
              <label className="form-label" htmlFor="segment-start">{t.segmentStartSecond}</label>
              <input className="form-control" id="segment-start" type="number" min={0} value={segmentForm.startSecond} onChange={(event) => setSegmentForm((current) => ({ ...current, startSecond: event.target.value }))} />
              <label className="form-label" htmlFor="segment-end">{t.segmentEndSecond}</label>
              <input className="form-control" id="segment-end" type="number" min={0} value={segmentForm.endSecond} onChange={(event) => setSegmentForm((current) => ({ ...current, endSecond: event.target.value }))} />
              <label className="form-label" htmlFor="segment-reason">{t.segmentNotes}</label>
              <input className="form-control" id="segment-reason" value={segmentForm.notes} onChange={(event) => setSegmentForm((current) => ({ ...current, notes: event.target.value }))} />
              <div className="segment-actions">
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onSaveSegment}>{editingSegmentId ? t.segmentUpdate : t.segmentAdd}</button>
                {editingSegmentId && <button type="button" className="secondary-button" onClick={resetSegmentForms}>{t.segmentCancelEdit}</button>}
              </div>
            </div>}
            </section>

            <section className="analysis-disclosure">
              <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleSegmentEditor('merge')} aria-expanded={segmentEditorsOpen.merge}>
                <span>{t.segmentMergeTitle}</span>
                <span className="analysis-disclosure__action">{segmentEditorsOpen.merge ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
              </button>
              {segmentEditorsOpen.merge && <div className="segment-form">
              <h4>{t.segmentMergeTitle}</h4>
              <label className="form-label" htmlFor="merge-source">{t.segmentMergeSource}</label>
              <select className="form-select" id="merge-source" value={mergeForm.sourceSegmentId} onChange={(event) => setMergeForm((current) => ({ ...current, sourceSegmentId: event.target.value }))}>
                <option value="">--</option>
                {selectedSession.segments.map((segment) => <option key={`source-${segment.id}`} value={segment.id}>{segment.label}</option>)}
              </select>
              <label className="form-label" htmlFor="merge-target">{t.segmentMergeTarget}</label>
              <select className="form-select" id="merge-target" value={mergeForm.targetSegmentId} onChange={(event) => setMergeForm((current) => ({ ...current, targetSegmentId: event.target.value }))}>
                <option value="">--</option>
                {selectedSession.segments.map((segment) => <option key={`target-${segment.id}`} value={segment.id}>{segment.label}</option>)}
              </select>
              <label className="form-label" htmlFor="merge-label">{t.segmentMergeLabel}</label>
              <input className="form-control" id="merge-label" value={mergeForm.label} onChange={(event) => setMergeForm((current) => ({ ...current, label: event.target.value }))} />
              <label className="form-label" htmlFor="merge-reason">{t.segmentNotes}</label>
              <input className="form-control" id="merge-reason" value={mergeForm.notes} onChange={(event) => setMergeForm((current) => ({ ...current, notes: event.target.value }))} />
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onMergeSegments}>{t.segmentMergeAction}</button>
            </div>}
            </section>

            <section className="analysis-disclosure">
              <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleSegmentEditor('split')} aria-expanded={segmentEditorsOpen.split}>
                <span>{t.segmentSplitTitle}</span>
                <span className="analysis-disclosure__action">{segmentEditorsOpen.split ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
              </button>
              {segmentEditorsOpen.split && <div className="segment-form">
              <h4>{t.segmentSplitTitle}</h4>
              <label className="form-label" htmlFor="split-segment">{t.segmentSplitSegment}</label>
              <select className="form-select" id="split-segment" value={splitForm.segmentId} onChange={(event) => setSplitForm((current) => ({ ...current, segmentId: event.target.value }))}>
                <option value="">--</option>
                {selectedSession.segments.map((segment) => <option key={`split-${segment.id}`} value={segment.id}>{segment.label} ({segment.startSecond}s-{segment.endSecond}s)</option>)}
              </select>
              <label className="form-label" htmlFor="split-second">{t.segmentSplitSecond}</label>
              <input className="form-control" id="split-second" type="number" min={1} value={splitForm.splitSecond} onChange={(event) => setSplitForm((current) => ({ ...current, splitSecond: event.target.value }))} />
              <label className="form-label" htmlFor="split-left-label">{t.segmentSplitLeftLabel}</label>
              <input className="form-control" id="split-left-label" value={splitForm.leftLabel} onChange={(event) => setSplitForm((current) => ({ ...current, leftLabel: event.target.value }))} />
              <label className="form-label" htmlFor="split-right-label">{t.segmentSplitRightLabel}</label>
              <input className="form-control" id="split-right-label" value={splitForm.rightLabel} onChange={(event) => setSplitForm((current) => ({ ...current, rightLabel: event.target.value }))} />
              <label className="form-label" htmlFor="split-notes">{t.segmentNotes}</label>
              <input className="form-control" id="split-notes" value={splitForm.notes} onChange={(event) => setSplitForm((current) => ({ ...current, notes: event.target.value }))} />
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onSplitSegment}>{t.segmentSplitAction}</button>
            </div>}
            </section>

            <h4>{t.segmentHistoryTitle}</h4>
            {selectedSession.segmentChangeHistory.length === 0 ? (
              <p>{t.historyEmpty}</p>
            ) : (
              <ul className="metrics-list list-group">
                {[...selectedSession.segmentChangeHistory].reverse().map((entry) => (
                  <li className="list-group-item" key={`${entry.version}-${entry.changedAtUtc}`}>v{entry.version} • {entry.action} • {formatLocalDateTime(entry.changedAtUtc)}{entry.notes ? ` • ${entry.notes}` : ''}</li>
                ))}
              </ul>
            )}
          </div>

          <section className={`analysis-disclosure analysis-block--display-settings ${activeSessionSubpage === "sessionSettings" ? "" : "is-hidden"}`}>
            <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('displaySettings')} aria-expanded={analysisAccordionState.displaySettings}>
              <span>{t.sessionDisplaySettingsTitle}</span>
              <span className="analysis-disclosure__action">{analysisAccordionState.displaySettings ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
            </button>
            {analysisAccordionState.displaySettings && (
            <div className="analysis-disclosure__content">
            <label className="form-label" htmlFor="comparison-mode-selector">{t.compareModeLabel}</label>
            <select className="form-select"
              id="comparison-mode-selector"
              value={compareMode}
              disabled={!selectedSession.summary.hasGpsData}
              onChange={(event) => setCompareMode(event.target.value as CompareMode)}
            >
              <option value="raw">{t.compareModeRaw}</option>
              <option value="smoothed">{t.compareModeSmoothed}</option>
            </select>
            {!selectedSession.summary.hasGpsData && <p className="comparison-disabled-hint">{t.compareDisabledNoGps}</p>}
            <label className="form-label" htmlFor="session-speed-unit">{t.sessionSpeedUnitLabel}</label>
            <select className="form-select" id="session-speed-unit" value={selectedSession.selectedSpeedUnit} onChange={onSpeedUnitChange}>
              <option value="km/h">km/h</option>
              <option value="mph">mph</option>
              <option value="m/s">m/s</option>
              <option value="min/km">min/km</option>
            </select>
            <p><strong>{t.sessionSpeedUnitSourceLabel}:</strong> {selectedSession.selectedSpeedUnitSource === 'ManualOverride' ? t.speedUnitSourceManualOverride : selectedSession.selectedSpeedUnitSource === 'ProfileRecalculation' ? t.speedUnitSourceProfileRecalculation : t.speedUnitSourceProfileDefault}</p>
            </div>
            )}
          </section>

          <section className={`session-processing-settings analysis-disclosure analysis-block--settings ${activeSessionSubpage === "sessionSettings" ? "" : "is-hidden"}`}>
            <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('processingSettings')} aria-expanded={analysisAccordionState.processingSettings}>
              <span>{t.sessionProcessingTitle}</span>
              <span className="analysis-disclosure__action">{analysisAccordionState.processingSettings ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
            </button>
            {analysisAccordionState.processingSettings && (
            <div className="analysis-disclosure__content">
            <div className="processing-settings-group">
              <label className="form-label" htmlFor="session-filter-selector">{t.filterSelectLabel}</label>
              <select className="form-select"
                id="session-filter-selector"
                value={selectedFilter}
                disabled={!selectedSession.summary.hasGpsData}
                onChange={onFilterChange}
              >
                <option value="Raw">{t.filterRaw}</option>
                <option value="AdaptiveMedian">{`${t.filterAdaptiveMedian} (${t.filterRecommendedBadge})`}</option>
                <option value="Savitzky-Golay">{t.filterSavitzkyGolay}</option>
                <option value="Butterworth">{t.filterButterworth}</option>
              </select>
              {!selectedSession.summary.hasGpsData && <p className="comparison-disabled-hint">{t.filterDisabledNoGps}</p>}
              <div className="filter-guidance" role="note" aria-label={t.filterRecommendationTitle}>
                <p><strong>{t.filterRecommendationTitle}:</strong> {t.filterRecommendationIntro}</p>
                <p>{t.filterRecommendationImpact}</p>
                <p>{selectedFilterDescription}</p>
              </div>
            </div>
            <div className="processing-settings-group">
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onRecalculateWithCurrentProfile}>{t.sessionRecalculateButton}</button>
              <p>{interpolate(t.sessionRecalculateProfileInfo, { version: String(selectedSession.appliedProfileSnapshot.thresholdVersion), thresholdUpdated: formatLocalDateTime(selectedSession.appliedProfileSnapshot.thresholdUpdatedAtUtc), filter: selectedSession.appliedProfileSnapshot.smoothingFilter, capturedAt: formatLocalDateTime(selectedSession.appliedProfileSnapshot.capturedAtUtc) })}</p>
            </div>
            </div>
            )}
          </section>

          <section className={`analysis-disclosure analysis-block--recalculation-history ${activeSessionSubpage === "technicalInfo" ? "" : "is-hidden"}`}>
            <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('recalculationHistory')} aria-expanded={analysisAccordionState.recalculationHistory}>
              <span>{t.sessionRecalculateHistoryTitle}</span>
              <span className="analysis-disclosure__action">{analysisAccordionState.recalculationHistory ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
            </button>
            {analysisAccordionState.recalculationHistory && (
            <div className="analysis-disclosure__content">
              {selectedSession.recalculationHistory.length === 0 ? <p>{t.sessionRecalculateHistoryEmpty}</p> : <ul className="metrics-list list-group">{selectedSession.recalculationHistory.map((entry) => <li className="list-group-item" key={entry.recalculatedAtUtc}>{formatLocalDateTime(entry.recalculatedAtUtc)}: v{entry.previousProfile.thresholdVersion} → v{entry.newProfile.thresholdVersion}</li>)}</ul>}
            </div>
            )}
          </section>

          <section className={`analysis-disclosure analysis-block--thresholds ${activeSessionSubpage === "technicalInfo" ? "" : "is-hidden"}`}>
            <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('thresholds')} aria-expanded={analysisAccordionState.thresholds}>
              <span>{t.metricCoreThresholds}</span>
              <span className="analysis-disclosure__action">{analysisAccordionState.thresholds ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
            </button>
            {analysisAccordionState.thresholds && displayedCoreMetrics && (
            <div className="analysis-disclosure__content">
              <ul className="metrics-list list-group">
                <MetricListItem label={t.metricCoreThresholds} value={formatThresholds(displayedCoreMetrics.thresholds)} helpText={metricHelp.coreThresholds} />
                <MetricListItem label={t.sessionThresholdTransparencyTitle} value={['MaxSpeedBase=' + (displayedCoreMetrics.thresholds.MaxSpeedEffectiveMps ?? t.notAvailable) + ' m/s (' + (displayedCoreMetrics.thresholds.MaxSpeedSource ?? t.notAvailable) + ')', 'MaxHeartRateBase=' + (displayedCoreMetrics.thresholds.MaxHeartRateEffectiveBpm ?? t.notAvailable) + ' bpm (' + (displayedCoreMetrics.thresholds.MaxHeartRateSource ?? t.notAvailable) + ')', 'Sprint=' + (displayedCoreMetrics.thresholds.SprintSpeedPercentOfMaxSpeed ?? t.notAvailable) + '% → ' + (displayedCoreMetrics.thresholds.SprintSpeedThresholdMps ?? t.notAvailable) + ' m/s', 'HighIntensity=' + (displayedCoreMetrics.thresholds.HighIntensitySpeedPercentOfMaxSpeed ?? t.notAvailable) + '% → ' + (displayedCoreMetrics.thresholds.HighIntensitySpeedThresholdMps ?? t.notAvailable) + ' m/s'].join(' | ')} helpText={metricHelp.coreThresholds} />
              </ul>
            </div>
            )}
          </section>

          {activeSessionSubpage === "analysis" && activeAnalysisTab === 'overview' && displayedCoreMetrics && (
            <>
              {isSegmentScopeActive && (
                <section className="analysis-disclosure analysis-block--core">
                  <div className="analysis-disclosure__content">
                    <h3>{t.segmentDerivedMetricsTitle}</h3>
                  </div>
                </section>
              )}
              {!displayedCoreMetrics.isAvailable && !isSegmentScopeActive && (
                <section className="analysis-disclosure analysis-block--core">
                  <div className="analysis-disclosure__content">
                    <p>{t.coreMetricsUnavailable.replace('{reason}', displayedCoreMetrics.unavailableReason ?? t.notAvailable)}</p>
                  </div>
                </section>
              )}

              <section className="analysis-disclosure analysis-block--core" id="overview-volume">
                <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('overviewVolume')} aria-expanded={analysisAccordionState.overviewVolume}>
                  <span>{t.overviewDimensionVolumeTitle}</span>
                  <span className="analysis-disclosure__action">{analysisAccordionState.overviewVolume ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
                </button>
                {analysisAccordionState.overviewVolume && (
                  <div className="analysis-disclosure__content">
                    <p>{t.overviewDimensionVolumeHelp}</p>
                    <div className="kpi-card-grid">
                      {activeDataMode !== 'HeartRateOnly' && <KpiCard
                        label={t.metricDistance}
                        primaryValue={withMetricStatus(formatDistanceComparison(displayedCoreMetrics.distanceMeters, locale, t.notAvailable), 'distanceMeters', displayedCoreMetrics, t)}
                        helpText={metricHelp.distance}
                        comparisonAverage={distanceComparison.averageLastFive !== null ? interpolate(t.kpiComparisonLastFive, { value: formatDistance(distanceComparison.averageLastFive, locale, t.notAvailable) }) : null}
                        comparisonDelta={formatComparisonDelta(displayedCoreMetrics.distanceMeters, distanceComparison.averageLastFive, locale, 1, ' m', 'neutral')}
                        comparisonBest={distanceComparison.bestSeason !== null ? interpolate(t.kpiComparisonBestSeason, { value: formatDistance(distanceComparison.bestSeason, locale, t.notAvailable) }) : null}
                        trendHint={t.kpiTrendContextDepends}
                        actions={[
                          { label: t.kpiActionTimeline, onClick: () => openTimelineWithFocus('distance') },
                          { label: t.kpiActionPeakAnalysis, onClick: () => { setActiveAnalysisTab('peakDemand'); jumpToSection('session-analysis', 'analysis'); } }
                        ]}
                      />}
                      <KpiCard
                        label={t.metricDuration}
                        primaryValue={withMetricStatus(formatDuration(isSegmentScopeActive && selectedSegment ? selectedSegment.endSecond - selectedSegment.startSecond : selectedSession.summary.durationSeconds, t.notAvailable), 'durationSeconds', displayedCoreMetrics, t)}
                        helpText={`${metricHelp.duration} ${t.metricHelpDuration}`}
                        comparisonAverage={durationComparison.averageLastFive !== null ? interpolate(t.kpiComparisonLastFive, { value: formatDuration(durationComparison.averageLastFive, t.notAvailable) }) : null}
                        comparisonDelta={formatDurationDelta(selectedSession.summary.durationSeconds ?? null, durationComparison.averageLastFive, 'neutral')}
                        comparisonBest={durationComparison.bestSeason !== null ? interpolate(t.kpiComparisonBestSeason, { value: formatDuration(durationComparison.bestSeason, t.notAvailable) }) : null}
                        trendHint={t.kpiTrendContextDepends}
                      />
                      {activeDataMode !== 'HeartRateOnly' && <KpiCard
                        label={t.metricRunningDensity}
                        primaryValue={withMetricStatus(formatNumber(displayedCoreMetrics.runningDensityMetersPerMinute, locale, t.notAvailable, 2), 'runningDensityMetersPerMinute', displayedCoreMetrics, t)}
                        helpText={metricHelp.runningDensity}
                        comparisonAverage={runningDensityComparison.averageLastFive !== null ? interpolate(t.kpiComparisonLastFive, { value: formatNumber(runningDensityComparison.averageLastFive, locale, t.notAvailable, 2) }) : null}
                        comparisonDelta={formatComparisonDelta(displayedCoreMetrics.runningDensityMetersPerMinute, runningDensityComparison.averageLastFive, locale, 2, ' m/min', 'higher')}
                        comparisonBest={runningDensityComparison.bestSeason !== null ? interpolate(t.kpiComparisonBestSeason, { value: formatNumber(runningDensityComparison.bestSeason, locale, t.notAvailable, 2) }) : null}
                        trendHint={t.kpiTrendHigherIsBetter}
                        actions={[{ label: t.kpiActionTimeline, onClick: () => openTimelineWithFocus('runningDensity') }]}
                      />}
                    </div>
                    <ul className="metrics-list list-group overview-legacy-list">
                      {activeDataMode !== 'HeartRateOnly' && <MetricListItem label={t.metricDistance} value={withMetricStatus(formatDistanceComparison(displayedCoreMetrics.distanceMeters, locale, t.notAvailable), 'distanceMeters', displayedCoreMetrics, t)} helpText={metricHelp.distance} />}
                      <MetricListItem label={t.metricDuration} value={withMetricStatus(formatDuration(isSegmentScopeActive && selectedSegment ? selectedSegment.endSecond - selectedSegment.startSecond : selectedSession.summary.durationSeconds, t.notAvailable), 'durationSeconds', displayedCoreMetrics, t)} helpText={`${metricHelp.duration} ${t.metricHelpDuration}`} />
                      {activeDataMode !== 'HeartRateOnly' && <MetricListItem label={t.metricRunningDensity} value={withMetricStatus(formatNumber(displayedCoreMetrics.runningDensityMetersPerMinute, locale, t.notAvailable, 2), 'runningDensityMetersPerMinute', displayedCoreMetrics, t)} helpText={metricHelp.runningDensity} />}
                    </ul>
                  </div>
                )}
              </section>

              <section className="analysis-disclosure analysis-block--core" id="overview-speed">
                <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('overviewSpeed')} aria-expanded={analysisAccordionState.overviewSpeed}>
                  <span>{t.overviewDimensionSpeedTitle}</span>
                  <span className="analysis-disclosure__action">{analysisAccordionState.overviewSpeed ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
                </button>
                {analysisAccordionState.overviewSpeed && (
                  <div className="analysis-disclosure__content">
                    <p>{t.overviewDimensionSpeedHelp}</p>
                    {!isSegmentScopeActive && hasAvailableWithWarning(displayedCoreMetrics, ['maxSpeedMetersPerSecond', 'highIntensityTimeSeconds', 'highIntensityRunCount', 'sprintCount', 'highSpeedDistanceMeters', 'sprintDistanceMeters']) && <p className="quality-warning">{t.externalMetricsWarningBanner}</p>}
                    <div className="kpi-card-grid">
                      {activeDataMode !== 'HeartRateOnly' && <KpiCard
                        label="Speed Summary"
                        primaryValue={`${t.metricMaxSpeed}: ${withMetricStatus(formatSpeed(displayedCoreMetrics.maxSpeedMetersPerSecond, selectedSession.selectedSpeedUnit, t.notAvailable), 'maxSpeedMetersPerSecond', displayedCoreMetrics, t)}`}
                        helpText={`${metricHelp.maxSpeed} ${metricHelp.highIntensityTime}`}
                        comparisonAverage={maxSpeedComparison.averageLastFive !== null ? interpolate(t.kpiComparisonLastFive, { value: formatSpeed(maxSpeedComparison.averageLastFive, selectedSession.selectedSpeedUnit, t.notAvailable) }) : null}
                        comparisonDelta={formatSpeedComparisonDelta(displayedCoreMetrics.maxSpeedMetersPerSecond, maxSpeedComparison.averageLastFive, locale, selectedSession.selectedSpeedUnit)}
                        trendHint={t.kpiTrendHigherIsBetter}
                        secondaryRows={[
                          `${t.metricHighIntensityRunCount}: ${withMetricStatus(String(detectedRunHierarchySummary?.highIntensityRunCount ?? displayedCoreMetrics.highIntensityRunCount ?? t.notAvailable), 'highIntensityRunCount', displayedCoreMetrics, t)}`,
                          `${t.metricOfWhichSprintPhasesCount}: ${withMetricStatus(String(detectedRunHierarchySummary?.sprintPhaseCount ?? displayedCoreMetrics.sprintCount ?? t.notAvailable), 'sprintCount', displayedCoreMetrics, t)}`,
                          `${t.metricHighIntensityTime}: ${withMetricStatus(formatDuration(displayedCoreMetrics.highIntensityTimeSeconds, t.notAvailable), 'highIntensityTimeSeconds', displayedCoreMetrics, t)}`
                        ]}
                        actions={[{ label: t.kpiActionTimeline, onClick: () => openTimelineWithFocus('speed') }]}
                      />}
                      {activeDataMode !== 'HeartRateOnly' && <KpiCard
                        label={t.metricHighSpeedDistance}
                        primaryValue={withMetricStatus(formatDistanceMetersOnly(displayedCoreMetrics.highSpeedDistanceMeters, t.notAvailable), 'highSpeedDistanceMeters', displayedCoreMetrics, t)}
                        helpText={metricHelp.highSpeedDistance}
                        comparisonAverage={highSpeedDistanceComparison.averageLastFive !== null ? interpolate(t.kpiComparisonLastFive, { value: formatDistanceMetersOnly(highSpeedDistanceComparison.averageLastFive, t.notAvailable) }) : null}
                        comparisonDelta={formatComparisonDelta(displayedCoreMetrics.highSpeedDistanceMeters, highSpeedDistanceComparison.averageLastFive, locale, 1, ' m', 'higher')}
                        comparisonBest={highSpeedDistanceComparison.bestSeason !== null ? interpolate(t.kpiComparisonBestSeason, { value: formatDistanceMetersOnly(highSpeedDistanceComparison.bestSeason, t.notAvailable) }) : null}
                        trendHint={t.kpiTrendHigherIsBetter}
                        secondaryRows={[
                          `${t.metricSprintDistance}: ${withMetricStatus(formatDistanceMetersOnly(detectedRunHierarchySummary?.sprintPhaseDistanceMeters ?? displayedCoreMetrics.sprintDistanceMeters, t.notAvailable), 'sprintDistanceMeters', displayedCoreMetrics, t)}`
                        ]}
                        actions={[
                          { label: t.kpiActionTimeline, onClick: () => openTimelineWithFocus('highSpeedDistance') },
                          { label: t.kpiActionPeakAnalysis, onClick: () => { setActiveAnalysisTab('peakDemand'); jumpToSection('session-analysis', 'analysis'); } }
                        ]}
                      />}
                    </div>
                    <ul className="metrics-list list-group overview-legacy-list">
                      {activeDataMode !== 'HeartRateOnly' && (
                        <>
                          <MetricListItem label={t.metricMaxSpeed} value={withMetricStatus(formatSpeed(displayedCoreMetrics.maxSpeedMetersPerSecond, selectedSession.selectedSpeedUnit, t.notAvailable), 'maxSpeedMetersPerSecond', displayedCoreMetrics, t)} helpText={metricHelp.maxSpeed} />
                          <MetricListItem label={t.metricHighIntensityTime} value={withMetricStatus(formatDuration(displayedCoreMetrics.highIntensityTimeSeconds, t.notAvailable), 'highIntensityTimeSeconds', displayedCoreMetrics, t)} helpText={metricHelp.highIntensityTime} />
                          <MetricListItem label={t.metricHighIntensityRunCount} value={withMetricStatus(String(detectedRunHierarchySummary?.highIntensityRunCount ?? displayedCoreMetrics.highIntensityRunCount ?? t.notAvailable), 'highIntensityRunCount', displayedCoreMetrics, t)} helpText={metricHelp.highIntensityRunCount} />
                          <MetricListItem label={t.metricOfWhichSprintPhasesCount} value={withMetricStatus(String(detectedRunHierarchySummary?.sprintPhaseCount ?? displayedCoreMetrics.sprintCount ?? t.notAvailable), 'sprintCount', displayedCoreMetrics, t)} helpText={metricHelp.sprintCount} />
                          <MetricListItem label={t.metricHighSpeedDistance} value={withMetricStatus(formatDistanceComparison(displayedCoreMetrics.highSpeedDistanceMeters, locale, t.notAvailable), 'highSpeedDistanceMeters', displayedCoreMetrics, t)} helpText={metricHelp.highSpeedDistance} />
                          <MetricListItem label={t.metricOfWhichSprintPhasesDistance} value={withMetricStatus(formatDistanceComparison(detectedRunHierarchySummary?.sprintPhaseDistanceMeters ?? displayedCoreMetrics.sprintDistanceMeters, locale, t.notAvailable), 'sprintDistanceMeters', displayedCoreMetrics, t)} helpText={metricHelp.sprintDistance} />
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </section>

              <section className="analysis-disclosure analysis-block--core" id="overview-mechanical">
                <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('overviewMechanical')} aria-expanded={analysisAccordionState.overviewMechanical}>
                  <span>{t.overviewDimensionMechanicalTitle}</span>
                  <span className="analysis-disclosure__action">{analysisAccordionState.overviewMechanical ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
                </button>
                {analysisAccordionState.overviewMechanical && (
                  <div className="analysis-disclosure__content">
                    <p>{t.overviewDimensionMechanicalHelp}</p>
                    {!isSegmentScopeActive && hasAvailableWithWarning(displayedCoreMetrics, ['accelerationCount', 'decelerationCount', 'directionChanges']) && <p className="quality-warning">{t.externalMetricsWarningBanner}</p>}
                    <div className="kpi-card-grid">
                      {activeDataMode !== 'HeartRateOnly' && <KpiCard
                        label="Mechanical Load — Summary"
                        primaryValues={[
                          `Accelerations total: ${withMetricStatus(String(displayedCoreMetrics.accelerationCount ?? t.notAvailable), 'accelerationCount', displayedCoreMetrics, t)}`,
                          `Decelerations total: ${withMetricStatus(String(displayedCoreMetrics.decelerationCount ?? t.notAvailable), 'decelerationCount', displayedCoreMetrics, t)}`,
                          `High-intensity direction changes total: ${withMetricStatus(String(displayedCoreMetrics.directionChanges ?? t.notAvailable), 'directionChanges', displayedCoreMetrics, t)}`
                        ]}
                        helpText={`${metricHelp.accelerationCount} ${metricHelp.decelerationCount} ${metricHelp.directionChanges}`}
                        actions={[
                          { label: t.kpiActionTimeline, onClick: () => openTimelineWithFocus('mechanicalLoad') },
                          { label: t.kpiActionPeakAnalysis, onClick: () => { setActiveAnalysisTab('peakDemand'); jumpToSection('session-analysis', 'analysis'); } }
                        ]}
                      />}
                      {activeDataMode !== 'HeartRateOnly' && <KpiCard
                        label="Mechanical Load — Moderate"
                        secondaryRows={[
                          `Accelerations (Moderate): ${withMetricStatus(String(displayedCoreMetrics.moderateAccelerationCount ?? t.notAvailable), 'accelerationCount', displayedCoreMetrics, t)}`,
                          `Decelerations (Moderate): ${withMetricStatus(String(displayedCoreMetrics.moderateDecelerationCount ?? t.notAvailable), 'decelerationCount', displayedCoreMetrics, t)}`,
                          `High-intensity direction changes (Moderate): ${withMetricStatus(String(displayedCoreMetrics.moderateDirectionChangeCount ?? t.notAvailable), 'directionChanges', displayedCoreMetrics, t)}`
                        ]}
                        helpText={`${metricHelp.accelerationCount} ${metricHelp.decelerationCount} ${metricHelp.directionChanges}`}
                      />}
                      {activeDataMode !== 'HeartRateOnly' && <KpiCard
                        label="Mechanical Load — High"
                        secondaryRows={[
                          `Accelerations (High): ${withMetricStatus(String(displayedCoreMetrics.highAccelerationCount ?? t.notAvailable), 'accelerationCount', displayedCoreMetrics, t)}`,
                          `Decelerations (High): ${withMetricStatus(String(displayedCoreMetrics.highDecelerationCount ?? t.notAvailable), 'decelerationCount', displayedCoreMetrics, t)}`,
                          `High-intensity direction changes (High): ${withMetricStatus(String(displayedCoreMetrics.highDirectionChangeCount ?? t.notAvailable), 'directionChanges', displayedCoreMetrics, t)}`
                        ]}
                        helpText={`${metricHelp.accelerationCount} ${metricHelp.decelerationCount} ${metricHelp.directionChanges}`}
                      />}
                      {activeDataMode !== 'HeartRateOnly' && <KpiCard
                        label="Mechanical Load — Very High"
                        secondaryRows={[
                          `Accelerations (Very High): ${withMetricStatus(String(displayedCoreMetrics.veryHighAccelerationCount ?? t.notAvailable), 'accelerationCount', displayedCoreMetrics, t)}`,
                          `Decelerations (Very High): ${withMetricStatus(String(displayedCoreMetrics.veryHighDecelerationCount ?? t.notAvailable), 'decelerationCount', displayedCoreMetrics, t)}`,
                          `High-intensity direction changes (Very High): ${withMetricStatus(String(displayedCoreMetrics.veryHighDirectionChangeCount ?? t.notAvailable), 'directionChanges', displayedCoreMetrics, t)}`
                        ]}
                        helpText={`${metricHelp.accelerationCount} ${metricHelp.decelerationCount} ${metricHelp.directionChanges}`}
                      />}
                    </div>
                  </div>
                )}
              </section>

              <section className="analysis-disclosure analysis-block--core" id="overview-internal">
                <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('overviewInternal')} aria-expanded={analysisAccordionState.overviewInternal}>
                  <span>{t.overviewDimensionInternalTitle}</span>
                  <span className="analysis-disclosure__action">{analysisAccordionState.overviewInternal ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
                </button>
                {analysisAccordionState.overviewInternal && (
                  <div className="analysis-disclosure__content">
                    <p>{t.overviewDimensionInternalHelp}</p>
                    <div className="kpi-card-grid">
                      {activeDataMode !== 'GpsOnly' && <KpiCard
                        label="Heart Rate"
                        primaryValue={`${selectedSession.summary.heartRateAverageBpm ?? t.notAvailable} bpm (avg)`}
                        helpText={`${metricHelp.heartRate} ${t.metricHelpHeartRate}`}
                        comparisonAverage={heartRateAvgComparison.averageLastFive !== null ? interpolate(t.kpiComparisonLastFive, { value: formatHeartRateAverage(heartRateAvgComparison.averageLastFive, t.notAvailable) }) : null}
                        comparisonDelta={formatComparisonDelta(selectedSession.summary.heartRateAverageBpm, heartRateAvgComparison.averageLastFive, locale, 0, ' bpm', 'neutral')}
                        trendHint={t.kpiTrendContextDepends}
                        secondaryRows={[
                          `Min: ${selectedSession.summary.heartRateMinBpm ?? t.notAvailable} bpm`,
                          `Max: ${selectedSession.summary.heartRateMaxBpm ?? t.notAvailable} bpm`
                        ]}
                        actions={[{ label: t.kpiActionTimeline, onClick: () => openTimelineWithFocus('heartRateAvg') }]}
                      />}
                      {activeDataMode !== 'GpsOnly' && <HrZonesKpiCard
                        label="HR Zones"
                        helpText={`${metricHelp.hrZoneLow} ${metricHelp.hrZoneMedium} ${metricHelp.hrZoneHigh}`}
                        zones={hrZoneBars}
                      />}
                      {activeDataMode !== 'GpsOnly' && <KpiCard
                        label={t.metricTrimpEdwards}
                        primaryValue={withMetricStatus(formatNumber(displayedCoreMetrics.trainingImpulseEdwards, locale, t.notAvailable, 1), 'trainingImpulseEdwards', displayedCoreMetrics, t)}
                        helpText={metricHelp.trimpEdwards}
                        secondaryRows={[`TRIMP/min: ${formatNumber(trimpPerMinuteValue, locale, t.notAvailable, 2)}`]}
                        comparisonAverage={trimpComparison.averageLastFive !== null ? interpolate(t.kpiComparisonLastFive, { value: formatNumber(trimpComparison.averageLastFive, locale, t.notAvailable, 1) }) : null}
                        comparisonDelta={formatComparisonDelta(displayedCoreMetrics.trainingImpulseEdwards, trimpComparison.averageLastFive, locale, 1, '', 'lower')}
                        trendHint={t.kpiTrendLowerIsBetter}
                        comparisonBest={trimpComparison.bestSeason !== null ? interpolate(t.kpiComparisonBestSeason, { value: formatNumber(trimpComparison.bestSeason, locale, t.notAvailable, 1) }) : null}
                        actions={[
                          { label: t.kpiActionTimeline, onClick: () => openTimelineWithFocus('trimp') },
                          { label: t.kpiActionPeakAnalysis, onClick: () => { setActiveAnalysisTab('peakDemand'); jumpToSection('session-analysis', 'analysis'); } }
                        ]}
                      />}
                      {activeDataMode !== 'GpsOnly' && <KpiCard
                        label="HR Recovery (60s)"
                        primaryValue={withMetricStatus(formatBpmDrop(displayedCoreMetrics.heartRateRecoveryAfter60Seconds, t.notAvailable), 'heartRateRecoveryAfter60Seconds', displayedCoreMetrics, t)}
                        helpText={metricHelp.hrRecovery60}
                        comparisonAverage={hrRecoveryComparison.averageLastFive !== null ? interpolate(t.kpiComparisonLastFive, { value: formatBpmDrop(hrRecoveryComparison.averageLastFive, t.notAvailable) }) : null}
                        comparisonDelta={formatComparisonDelta(displayedCoreMetrics.heartRateRecoveryAfter60Seconds, hrRecoveryComparison.averageLastFive, locale, 0, ' bpm', 'higher')}
                        trendHint={t.kpiTrendHigherIsBetter}
                      />}
                    </div>
                    <ul className="metrics-list list-group overview-legacy-list">
                      {activeDataMode !== 'GpsOnly' && (
                        <>
                          <MetricListItem label={t.metricHeartRate} value={withMetricStatus(formatHeartRate(selectedSession.summary, t.notAvailable), 'heartRateMinAvgMaxBpm', displayedCoreMetrics, t)} helpText={`${metricHelp.heartRate} ${t.metricHelpHeartRate}`} />
                          <MetricListItem label={t.metricHrZoneLow} value={withMetricStatus(formatDuration(displayedCoreMetrics.heartRateZoneLowSeconds, t.notAvailable), 'heartRateZoneLowSeconds', displayedCoreMetrics, t)} helpText={metricHelp.hrZoneLow} />
                          <MetricListItem label={t.metricHrZoneMedium} value={withMetricStatus(formatDuration(displayedCoreMetrics.heartRateZoneMediumSeconds, t.notAvailable), 'heartRateZoneMediumSeconds', displayedCoreMetrics, t)} helpText={metricHelp.hrZoneMedium} />
                          <MetricListItem label={t.metricHrZoneHigh} value={withMetricStatus(formatDuration(displayedCoreMetrics.heartRateZoneHighSeconds, t.notAvailable), 'heartRateZoneHighSeconds', displayedCoreMetrics, t)} helpText={metricHelp.hrZoneHigh} />
                          <MetricListItem label={t.metricTrimpEdwards} value={withMetricStatus(formatNumber(displayedCoreMetrics.trainingImpulseEdwards, locale, t.notAvailable, 1), 'trainingImpulseEdwards', displayedCoreMetrics, t)} helpText={metricHelp.trimpEdwards} />
                          <MetricListItem label={t.metricTrimpPerMinute} value={formatNumber(displayedCoreMetrics.trainingImpulseEdwards !== null ? displayedCoreMetrics.trainingImpulseEdwards / ((isSegmentScopeActive && selectedSegment ? Math.max(1, selectedSegment.endSecond - selectedSegment.startSecond) : Math.max(1, selectedSession.summary.durationSeconds ?? 0)) / 60) : null, locale, t.notAvailable, 2)} helpText={metricHelp.trimpEdwards} />
                          <MetricListItem label={t.metricHrRecovery60} value={withMetricStatus(String(displayedCoreMetrics.heartRateRecoveryAfter60Seconds ?? t.notAvailable), 'heartRateRecoveryAfter60Seconds', displayedCoreMetrics, t)} helpText={metricHelp.hrRecovery60} />
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </section>
            </>
          )}

          <section className={`analysis-disclosure analysis-block--peak-demand ${activeSessionSubpage === "analysis" && activeAnalysisTab === 'peakDemand' ? "" : "is-hidden"}`}>
            <div className="analysis-disclosure__content">
              <div className="peak-demand-header">
                <h3>{t.sessionTabPeakDemand}</h3>
                <button
                  type="button"
                  className="metric-help peak-demand-info"
                  aria-label={`${t.sessionTabPeakDemand} explanation`}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('metric-help-open', { detail: { label: t.sessionTabPeakDemand, helpText: t.peakDemandInfoDescription } }));
                  }}
                >
                  <i className="bi bi-info-circle" aria-hidden="true" />
                </button>
              </div>
              <label className="form-label" htmlFor="peak-window-selector">{t.peakDemandWindowSelectorLabel}</label>
              <select
                className="form-select"
                id="peak-window-selector"
                value={peakDemandWindowMinutes}
                onChange={(event) => setPeakDemandWindowMinutes(Number(event.target.value) as 1 | 2 | 5)}
              >
                <option value={1}>{t.intervalAggregationWindow1}</option>
                <option value={2}>{t.intervalAggregationWindow2}</option>
                <option value={5}>{t.intervalAggregationWindow5}</option>
              </select>
              {((selectedSession?.summary.intervalAggregates.length ?? 0) === 0 || selectedAnalysisAggregates.length === 0 || (peakRowsByDimension.volume.length + peakRowsByDimension.speed.length + peakRowsByDimension.mechanical.length + peakRowsByDimension.internal.length) === 0) ? (
                <p>{isSegmentScopeActive ? t.segmentScopeNoPeakDataHint : t.intervalAggregationNoData}</p>
              ) : (
                <>
                  {[
                    { key: 'volume', title: t.peakDemandDimensionVolume, rows: peakRowsByDimension.volume },
                    { key: 'speed', title: t.peakDemandDimensionSpeed, rows: peakRowsByDimension.speed },
                    { key: 'mechanical', title: t.peakDemandDimensionMechanical, rows: peakRowsByDimension.mechanical },
                    { key: 'internal', title: t.peakDemandDimensionInternal, rows: peakRowsByDimension.internal }
                  ].map((dimension) => (
                    <div key={dimension.key} className="peak-demand-dimension">
                      <h4>{dimension.title} · Peaks</h4>
                      {dimension.rows.length === 0 ? (
                        <p>{t.notAvailable}</p>
                      ) : (
                        <table className="history-table peak-demand-table">
                          <thead>
                            <tr>
                              <th>{t.peakDemandMetricLabel}</th>
                              <th>{t.peakDemandValueLabel}</th>
                              <th>{t.peakDemandAverageLabel}</th>
                              <th>{t.peakDemandBestLabel}</th>
                              <th>{t.peakDemandActionLabel}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dimension.rows.map((row) => (
                              <tr key={`${dimension.key}-${row.metricLabel}`}>
                                <td data-label={t.peakDemandMetricLabel}>{row.metricLabel}</td>
                                <td data-label={t.peakDemandValueLabel}>{row.peakValue}</td>
                                <td data-label={t.peakDemandAverageLabel}><i className="bi bi-slash-circle" aria-hidden="true" /> {row.averageLastFive ?? t.notAvailable}</td>
                                <td data-label={t.peakDemandBestLabel}><i className="bi bi-star-fill" aria-hidden="true" /> {row.bestSeason ?? t.notAvailable}</td>
                                <td data-label={t.peakDemandActionLabel}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => {
                                      setActiveAnalysisTab('timeline');
                                      setTimelineMode('rolling');
                                      setAggregationWindowMinutes(peakDemandWindowMinutes);
                                      setTimelineScrollTarget(row.seriesKey);
                                      setTimelineHighlightedWindow({ startSecond: row.windowStartSecond, endSecond: row.windowEndSecond });
                                      const peakLabel = `${dimension.title} · ${row.metricLabel} (${peakDemandWindowMinutes} min)`;
                                      setTimelineHighlightedPeakLabel(peakLabel);
                                      setTimelineCursorSecond(row.windowEndSecond);
                                      jumpToSection('session-analysis', 'analysis');
                                      requestAnimationFrame(() => {
                                        writePeakContextToUrl({ trackKey: row.seriesKey, startSecond: row.windowStartSecond, endSecond: row.windowEndSecond, label: peakLabel, windowMinutes: peakDemandWindowMinutes });
                                      });
                                    }}
                                  >
                                    {t.peakDemandActionJumpTimeline}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
          <section className={`interval-aggregation analysis-disclosure analysis-block--interval ${activeSessionSubpage === "analysis" && activeAnalysisTab === 'timeline' ? "" : "is-hidden"}`}>
            <div className="analysis-disclosure__content timeline-content-always-open">
            <p>{t.intervalAggregationExplanation}</p>
            <div className="timeline-mode-switch" role="group" aria-label={t.timelineModeLabel}>
              <span>{t.timelineModeLabel}</span>
              <button type="button" aria-pressed={timelineMode === 'instant'} className={timelineMode === 'instant' ? 'is-active' : ''} onClick={() => setTimelineMode('instant')}>{t.timelineModeInstant}</button>
              <button type="button" aria-pressed={timelineMode === 'rolling'} className={timelineMode === 'rolling' ? 'is-active' : ''} onClick={() => setTimelineMode('rolling')}>{t.timelineModeRolling}</button>
            </div>
            <div className="timeline-mode-switch timeline-density-switch" role="group" aria-label={t.timelineDensityLabel}>
              <span>{t.timelineDensityLabel}</span>
              <button type="button" aria-pressed={timelineDensity === 'compact'} className={timelineDensity === 'compact' ? 'is-active' : ''} onClick={() => setTimelineDensity('compact')}>{t.timelineDensityCompact}</button>
              <button type="button" aria-pressed={timelineDensity === 'standard'} className={timelineDensity === 'standard' ? 'is-active' : ''} onClick={() => setTimelineDensity('standard')}>{t.timelineDensityStandard}</button>
            </div>
            {timelineMode === 'rolling' && (
              <>
                <label className="form-label" htmlFor="interval-window-selector">{t.intervalAggregationWindowLabel}</label>
                <select className="form-select"
                  id="interval-window-selector"
                  value={aggregationWindowMinutes}
                  onChange={(event) => setAggregationWindowMinutes(Number(event.target.value) as 1 | 2 | 5)}
                >
                  <option value={1}>{t.intervalAggregationWindow1}</option>
                  <option value={2}>{t.intervalAggregationWindow2}</option>
                  <option value={5}>{t.intervalAggregationWindow5}</option>
                </select>
                <p>{interpolate(t.timelineRollingSamplesLabel, { count: timelineSecondSeries.rollingSampleCount.toString() })}</p>
              </>
            )}
            <p className="timeline-shared-axis">{t.timelineSharedAxisLabel}: {formatSecondsMmSs(0)} {t.timelineSharedAxisUnitMinutes} – {formatSecondsMmSs(timelineAxisMaxSecond)} {t.timelineSharedAxisUnitMinutes} · {t.timelineCursorLabel}: {formatSecondsMmSs(Math.round(timelineCursorSecond))} {t.timelineSharedAxisUnitMinutes}</p>
            <p className="timeline-shared-axis">{t.timelineXAxisLabel}</p>
            {timelineHighlightedWindow && (
              <p className="timeline-shared-axis">{t.timelineHighlightedWindowLabel}: {formatSecondsMmSs(timelineHighlightedWindow.startSecond)} {t.timelineSharedAxisUnitMinutes} – {formatSecondsMmSs(timelineHighlightedWindow.endSecond)} {t.timelineSharedAxisUnitMinutes}</p>
            )}
            {timelineHighlightedWindow && timelineHighlightedPeakLabel && (
              <div className="timeline-highlight-meta">
                <p className="timeline-shared-axis">{t.timelineHighlightedPeakLabel}: {timelineHighlightedPeakLabel}</p>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setTimelineHighlightedWindow(null); setTimelineHighlightedPeakLabel(null); writePeakContextToUrl(null); }}>{t.timelineHighlightedPeakReset}</button>
              </div>
            )}
            <div className="timeline-cursor-readout">
              {timelineSeries.map((series) => {
                const valueText = timelineCursorValues.find((entry) => entry.key === series.key)?.text ?? t.notAvailable;
                return <span key={series.key}><strong>{series.label}:</strong> {valueText}</span>;
              })}
            </div>
            <div className={`timeline-tracks ${timelineDensity === 'compact' ? 'timeline-tracks--compact' : ''}`}>
              {timelineSeries.map((series) => {
                const currentValueText = timelineCursorValues.find((entry) => entry.key === series.key)?.text ?? t.notAvailable;
                const xAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((factor) => Number((timelineAxisMaxSecond * factor).toFixed(0)));
                return (
                <TimelineTrackChart
                  key={series.key}
                  trackId={`timeline-track-${series.key}`}
                  label={series.label}
                  points={series.points}
                  axisMaxSecond={timelineAxisMaxSecond}
                  valueSuffix={series.valueSuffix}
                  lineColorClassName={`timeline-track__line--${series.key}`}
                  sliderClassName={`timeline-track__slider timeline-track__slider--${series.key}`}
                  cursorSecond={timelineCursorSecond}
                  isCursorLocked={timelineCursorLocked}
                  onCursorChange={setTimelineCursorSecond}
                  onToggleCursorLock={() => setTimelineCursorLocked((current) => !current)}
                  currentValueLabel={currentValueText}
                  yGuideValueLabel={currentValueText}
                  xAxisTicks={xAxisTicks}
                  xAxisTickFormatter={(value) => formatSecondsMmSs(value)}
                  compact={timelineDensity === 'compact'}
                  highlightedWindow={timelineHighlightedWindow}
                />
              );})}
            </div>
            {timelineMode === 'rolling' && selectedAnalysisAggregates.length === 0 && (
              <p>{isSegmentScopeActive ? t.segmentScopeNoTimelineDataHint : t.intervalAggregationNoData}</p>
            )}
            </div>
          </section>

          {activeSessionSubpage === "analysis" && shouldShowGpsHeatmap && (
            <section className={`gps-heatmap-section analysis-disclosure analysis-block--heatmap ${activeAnalysisTab === 'heatmap' ? '' : 'is-hidden'}`}>
              <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('gpsHeatmap')} aria-expanded={analysisAccordionState.gpsHeatmap}>
                <span>{t.gpsHeatmapTitle}</span>
                <span className="analysis-disclosure__action">{analysisAccordionState.gpsHeatmap ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
              </button>
              {analysisAccordionState.gpsHeatmap && (
              <div className="analysis-disclosure__content">
              <p>{t.gpsHeatmapDescription}</p>
              {heatmapData ? (
                <GpsPointHeatmap
                  points={heatmapData.points}
                  minLatitude={heatmapData.minLatitude}
                  maxLatitude={heatmapData.maxLatitude}
                  minLongitude={heatmapData.minLongitude}
                  maxLongitude={heatmapData.maxLongitude}
                  zoomInLabel={t.gpsHeatmapZoomIn}
                  zoomOutLabel={t.gpsHeatmapZoomOut}
                  zoomResetLabel={t.gpsHeatmapZoomReset}
                  viewHeatmapLabel={t.gpsHeatmapViewHeatmap}
                  viewPointsLabel={t.gpsHeatmapViewPoints}
                  sessionId={selectedSession.id}
                />
              ) : (
                <p>{isSegmentScopeActive ? t.segmentScopeNoHeatmapDataHint : t.gpsHeatmapNoDataHint}</p>
              )}
              </div>
              )}
            </section>
          )}

          {activeSessionSubpage === "analysis" && shouldShowGpsHeatmap && heatmapData && (
            <section className={`gps-heatmap-section gps-runs-section analysis-disclosure analysis-block--runs ${activeAnalysisTab === 'heatmap' ? '' : 'is-hidden'}`}>
              <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('gpsRunsMap')} aria-expanded={analysisAccordionState.gpsRunsMap}>
                <span>{t.gpsRunsMapTitle}</span>
                <span className="analysis-disclosure__action">{analysisAccordionState.gpsRunsMap ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
              </button>
              {analysisAccordionState.gpsRunsMap && (
              <div className="analysis-disclosure__content">
              <p>{t.gpsRunsMapDescription}</p>
              <GpsRunsMap
                points={heatmapData.points}
                detectedRuns={selectedDetectedRuns}
                minLatitude={heatmapData.minLatitude}
                maxLatitude={heatmapData.maxLatitude}
                minLongitude={heatmapData.minLongitude}
                maxLongitude={heatmapData.maxLongitude}
                zoomInLabel={t.gpsHeatmapZoomIn}
                zoomOutLabel={t.gpsHeatmapZoomOut}
                zoomResetLabel={t.gpsHeatmapZoomReset}
                sprintThresholdMps={runTrackThresholds.sprintThresholdMps}
                highIntensityThresholdMps={runTrackThresholds.highIntensityThresholdMps}
                showAllLabel={t.gpsRunsFilterAll}
                showSprintLabel={t.gpsRunsFilterSprint}
                showHighIntensityLabel={t.gpsRunsFilterHighIntensity}
                showOnlyHsrRunsLabel={t.gpsRunsFilterOnlyHsrRuns}
                showHsrRunsWithSprintPhasesLabel={t.gpsRunsFilterHsrWithSprintPhases}
                listTitle={t.gpsRunsListTitle}
                listEmptyLabel={t.gpsRunsListEmpty}
                clearSelectionLabel={t.gpsRunsListShowAll}
                topSpeedLabel={t.gpsRunsListTopSpeed}
                explanationLabel={t.gpsRunsMapExplanation}
                sprintMetricLabel={t.metricSprintCount}
                highIntensityMetricLabel={t.metricHighIntensityRunCount}
                speedUnit={selectedSession.selectedSpeedUnit}
                locale={locale}
                sessionId={selectedSession.id}
              />
              </div>
              )}
            </section>
          )}

          {activeSessionSubpage === 'analysis' && activeAnalysisTab !== 'overview' && resolveDataAvailability(selectedSession.summary).mode === 'HeartRateOnly' && (
            <div className="detail-hints" role="note" aria-label={t.hfOnlyInsightTitle}>
              <p><strong>{t.hfOnlyInsightTitle}:</strong> {t.hfOnlyInsightInterpretation}</p>
            </div>
          )}

          {activeSessionSubpage === "analysis" && activeAnalysisTab !== 'overview' && (showMissingHeartRateHint || showMissingDistanceHint || showMissingGpsHint) && (
            <div className="detail-hints" role="status">
              {showMissingHeartRateHint && <p>{t.detailMissingHeartRateHint}</p>}
              {showMissingDistanceHint && <p>{t.detailMissingDistanceHint}</p>}
              {showMissingGpsHint && <p>{t.detailMissingGpsHint}</p>}
            </div>
          )}

          <section className={`analysis-disclosure analysis-block--quality ${activeSessionSubpage === "technicalInfo" ? "" : "is-hidden"}`} id="session-technical-info">
              <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('qualityDetails')} aria-expanded={analysisAccordionState.qualityDetails}>
                <span>{t.qualityDetailsSidebarTitle}</span>
                <span className="analysis-disclosure__action">{analysisAccordionState.qualityDetails ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
              </button>
              {analysisAccordionState.qualityDetails && <div className="analysis-disclosure__content">{renderQualityDetailsContent()}</div>}
            </section>

          <section className={`analysis-disclosure analysis-block--danger-zone ${activeSessionSubpage === "sessionSettings" ? "" : "is-hidden"}`}>
            <button type="button" className="analysis-disclosure__toggle" onClick={() => toggleAnalysisSection('dangerZone')} aria-expanded={analysisAccordionState.dangerZone}>
              <span>{t.sessionDangerZoneTitle}</span>
              <span className="analysis-disclosure__action">{analysisAccordionState.dangerZone ? t.analysisSectionCollapse : t.analysisSectionExpand}</span>
            </button>
            {analysisAccordionState.dangerZone && (
            <div className="analysis-disclosure__content session-danger-zone">
              <p>{t.sessionDeleteWarning}</p>
              <button type="button" className="danger-button" onClick={onDeleteSession}>{t.sessionDeleteButton}</button>
            </div>
            )}
          </section>
          </div>
          )}
        </section>
      )}
    </main>
    </div>
  );
}

function formatUtcDateTime(value: string | null | undefined, locale: Locale, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).format(date);
}

type GpsPointHeatmapProps = {
  points: GpsTrackpoint[];
  detectedRuns?: DetectedRun[];
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  zoomInLabel: string;
  zoomOutLabel: string;
  zoomResetLabel: string;
  viewHeatmapLabel: string;
  viewPointsLabel: string;
  sessionId: string;
};

type RenderPoint = { x: number; y: number; radius: number; isEnd: boolean; pointIndex: number; isSupplemental: boolean };
type RunSegment = {
  id: string;
  runType: 'sprint' | 'highIntensity';
  points: RenderPoint[];
  startElapsedSeconds: number;
  durationSeconds: number;
  distanceMeters: number;
  topSpeedMetersPerSecond: number;
  hasSprintPhases: boolean;
  sprintPointIndices: number[];
  pointIndices: number[];
  parentRunId: string | null;
};

type GpsRunsMapProps = {
  points: GpsTrackpoint[];
  detectedRuns?: DetectedRun[];
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  zoomInLabel: string;
  zoomOutLabel: string;
  zoomResetLabel: string;
  sprintThresholdMps: number | null;
  highIntensityThresholdMps: number | null;
  showAllLabel: string;
  showSprintLabel: string;
  showHighIntensityLabel: string;
  showOnlyHsrRunsLabel: string;
  showHsrRunsWithSprintPhasesLabel: string;
  listTitle: string;
  listEmptyLabel: string;
  clearSelectionLabel: string;
  topSpeedLabel: string;
  explanationLabel: string;
  sprintMetricLabel: string;
  highIntensityMetricLabel: string;
  speedUnit: SpeedUnit;
  locale: Locale;
  sessionId: string;
};

type SegmentationAssistantProps = {
  points: Array<GpsTrackpoint & { elapsedSeconds: number }>;
  bounds: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number } | null;
  cursorSecond: number;
  heartRateSamples: HeartRateSample[];
  titleHeartRate: string;
  titleMap: string;
  noHeartRateDataLabel: string;
  currentPointLabel: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  zoomResetLabel: string;
  sessionId: string;
  topControls: ReactNode;
  betweenControls: ReactNode;
  currentHeartRateLabel: string;
  segmentStartSecond: number;
  segmentEndSecond: number;
};

function findNearestPointIndexBySecond(points: Array<GpsTrackpoint & { elapsedSeconds: number }>, targetSecond: number): number {
  if (points.length === 0) {
    return -1;
  }

  let nearestIndex = 0;
  let nearestDelta = Math.abs(points[0].elapsedSeconds - targetSecond);

  for (let index = 1; index < points.length; index += 1) {
    const delta = Math.abs(points[index].elapsedSeconds - targetSecond);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

type HeatmapLayerProps = {
  width: number;
  height: number;
  densityCells: Array<{ x: number; y: number; value: number }>;
  screenPoints: Array<{ x: number; y: number }>;
  shouldRenderPointMarkers: boolean;
  viewMode: 'heatmap' | 'points';
  colorForDensity: (value: number) => string;
};

type MapSurfaceProps = {
  width: number;
  height: number;
  satelliteImageUrl: string;
  children: ReactNode;
};

type TimelinePoint = { x: number; y: number | null };

type TimelineSeries = {
  key: TimelineTrackKey;
  label: string;
  valueSuffix?: string;
  valueFormatter?: (value: number) => string;
  points: TimelinePoint[];
};

function findNearestTimelinePoint(points: TimelinePoint[], cursorSecond: number): TimelinePoint | null {
  const candidates = points.filter((point) => point.y !== null);
  if (candidates.length === 0) {
    return null;
  }

  let nearest = candidates[0];
  let nearestDelta = Math.abs(nearest.x - cursorSecond);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const delta = Math.abs(candidate.x - cursorSecond);
    if (delta < nearestDelta) {
      nearest = candidate;
      nearestDelta = delta;
    }
  }

  return nearest;
}

type TimelineTrackChartProps = {
  compact: boolean;
  trackId: string;
  label: string;
  points: TimelinePoint[];
  axisMaxSecond: number;
  valueSuffix?: string;
  lineColorClassName: string;
  sliderClassName: string;
  cursorSecond: number;
  isCursorLocked: boolean;
  onCursorChange: (second: number) => void;
  onToggleCursorLock: () => void;
  currentValueLabel: string;
  yGuideValueLabel: string;
  xAxisTicks: number[];
  xAxisTickFormatter: (value: number) => string;
  highlightedWindow: { startSecond: number; endSecond: number } | null;
};

function TimelineTrackChart({ trackId, label, points, axisMaxSecond, valueSuffix, lineColorClassName, sliderClassName, cursorSecond, isCursorLocked, onCursorChange, onToggleCursorLock, currentValueLabel, yGuideValueLabel, xAxisTicks, xAxisTickFormatter, compact, highlightedWindow }: TimelineTrackChartProps) {
  const width = 560;
  const height = compact ? 84 : 120;
  const topPadding = 8;
  const bottomPadding = 16;
  const chartHeight = height - topPadding - bottomPadding;
  const numericValues = points.flatMap((point) => point.y === null ? [] : [point.y]);
  const yMin = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const yMax = numericValues.length > 0 ? Math.max(...numericValues) : 1;
  const yRange = Math.max(1, yMax - yMin);

  const polylinePoints = points
    .filter((point) => point.y !== null)
    .map((point) => {
      const x = Math.max(0, Math.min(width, (point.x / axisMaxSecond) * width));
      const y = topPadding + ((yMax - (point.y ?? yMin)) / yRange) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const cursorX = Math.max(0, Math.min(width, (cursorSecond / axisMaxSecond) * width));
  const nearestCursorPoint = findNearestTimelinePoint(points, cursorSecond);
  const cursorGuideY = nearestCursorPoint?.y === null || nearestCursorPoint?.y === undefined
    ? null
    : (topPadding + ((yMax - nearestCursorPoint.y) / yRange) * chartHeight);

  return (
    <div id={trackId} className="timeline-track" aria-label={label}>
      <div className="timeline-track__header">
        <h4>{label}</h4>
        <span>{currentValueLabel || (numericValues.length > 0 ? `${numericValues[numericValues.length - 1].toFixed(1)}${valueSuffix ?? ''}` : 'n/a')}</span>
      </div>
      <svg
        className="timeline-track__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const localX = ((event.clientX - rect.left) / rect.width) * width;
          onCursorChange((Math.max(0, Math.min(width, localX)) / width) * axisMaxSecond);

          if (event.pointerType === 'mouse') {
            onToggleCursorLock();
            return;
          }

          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === 'mouse' && isCursorLocked) {
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const localX = ((event.clientX - rect.left) / rect.width) * width;
          onCursorChange((Math.max(0, Math.min(width, localX)) / width) * axisMaxSecond);
        }}
      >
        <line x1="0" y1={height - bottomPadding} x2={width} y2={height - bottomPadding} className="timeline-track__axis" />
        <line x1="0" y1={topPadding} x2={0} y2={height - bottomPadding} className="timeline-track__axis" />
        {highlightedWindow && (
          <rect
            x={Math.max(0, Math.min(width, (highlightedWindow.startSecond / axisMaxSecond) * width))}
            y={topPadding}
            width={Math.max(2, Math.min(width, ((highlightedWindow.endSecond - highlightedWindow.startSecond + 1) / axisMaxSecond) * width))}
            height={chartHeight}
            className="timeline-track__highlight-window"
          />
        )}
        {polylinePoints.length > 0 && <polyline points={polylinePoints} className={`timeline-track__line ${lineColorClassName}`} />}
        {cursorGuideY !== null && <line x1="0" y1={cursorGuideY} x2={width} y2={cursorGuideY} className="timeline-track__cursor-y" />}
        <line x1={cursorX} y1={topPadding} x2={cursorX} y2={height - bottomPadding} className="timeline-track__cursor" />
      </svg>
      <div className="timeline-track__x-axis" aria-label="timeline x axis">
        {xAxisTicks.map((tick) => (
          <span key={`${label}-${tick}`}>{xAxisTickFormatter(tick)}</span>
        ))}
      </div>
      <p className="timeline-track__cursor-time">{formatSecondsMmSs(Math.round(cursorSecond))} min</p>
      <div className="timeline-mobile-slider timeline-mobile-slider--track">
        <input
          id={`timeline-mobile-cursor-${trackId}`}
          type="range"
          aria-label={label}
          className={sliderClassName}
          min={0}
          max={axisMaxSecond}
          step={0.5}
          value={cursorSecond}
          onChange={(event) => onCursorChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

type InteractiveMapProps = {
  zoomInLabel: string;
  zoomOutLabel: string;
  zoomResetLabel: string;
  sessionId: string;
  ariaLabel: string;
  controlsPosition?: 'top' | 'bottom';
  children: (args: { width: number; height: number; transform: string; isDragging: boolean; handlers: {
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerUp: () => void;
  } }) => JSX.Element;
};

const earthRadiusMeters = 6378137;

function toWebMercator(latitude: number, longitude: number) {
  const normalizedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const x = earthRadiusMeters * (longitude * Math.PI / 180);
  const y = earthRadiusMeters * Math.log(Math.tan(Math.PI / 4 + (normalizedLatitude * Math.PI / 180) / 2));
  return { x, y };
}

function useMapProjection(points: GpsTrackpoint[], minLatitude: number, maxLatitude: number, minLongitude: number, maxLongitude: number) {
  const width = 560;
  const height = 320;
  const projectedPoints = points.map((point) => toWebMercator(point.latitude, point.longitude));
  const projectedXs = projectedPoints.map((point) => point.x);
  const projectedYs = projectedPoints.map((point) => point.y);

  const minProjected = toWebMercator(minLatitude, minLongitude);
  const maxProjected = toWebMercator(maxLatitude, maxLongitude);

  const minX = Math.min(...projectedXs, minProjected.x, maxProjected.x);
  const maxX = Math.max(...projectedXs, minProjected.x, maxProjected.x);
  const minY = Math.min(...projectedYs, minProjected.y, maxProjected.y);
  const maxY = Math.max(...projectedYs, minProjected.y, maxProjected.y);

  const spanX = Math.max(Math.abs(maxX - minX), 10);
  const spanY = Math.max(Math.abs(maxY - minY), 10);
  const projectedPaddingX = Math.max(spanX * 0.095, 9);
  const projectedPaddingY = Math.max(spanY * 0.12, 10.5);

  const bboxMinX = minX - projectedPaddingX;
  const bboxMaxX = maxX + projectedPaddingX;
  const bboxMinY = minY - projectedPaddingY;
  const bboxMaxY = maxY + projectedPaddingY;

  const fixedZoomLevel = 17;
  const initialResolution = (2 * Math.PI * earthRadiusMeters) / 256;

  const centerX = (bboxMinX + bboxMaxX) / 2;
  const centerY = (bboxMinY + bboxMaxY) / 2;
  const centerLongitude = (centerX / earthRadiusMeters) * (180 / Math.PI);
  const centerLatitude = (Math.atan(Math.exp(centerY / earthRadiusMeters)) * 360 / Math.PI) - 90;

  const metersPerPixel = initialResolution / Math.pow(2, fixedZoomLevel);
  const satelliteImageUrl = `https://static-maps.yandex.ru/1.x/?l=sat&ll=${centerLongitude},${centerLatitude}&z=${fixedZoomLevel}&size=${width},${height}&lang=en_US`;

  const screenPoints = projectedPoints.map((point) => ({
    x: Math.min(width, Math.max(0, ((point.x - centerX) / metersPerPixel) + (width / 2))),
    y: Math.min(height, Math.max(0, (height / 2) - ((point.y - centerY) / metersPerPixel)))
  }));

  return { width, height, screenPoints, satelliteImageUrl };
}

function InteractiveMap({ zoomInLabel, zoomOutLabel, zoomResetLabel, sessionId, ariaLabel, controlsPosition = 'top', children }: InteractiveMapProps) {
  const width = 560;
  const height = 320;
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setDragStart(null);
    dragStartRef.current = null;
  }, [sessionId]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const clampPanOffset = (offset: { x: number; y: number }, scale: number) => {
    const maxPanX = Math.max(0, ((width * scale) - width) / 2);
    const maxPanY = Math.max(0, ((height * scale) - height) / 2);

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, offset.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, offset.y))
    };
  };

  const adjustZoom = (delta: number) => {
    setZoomScale((currentScale) => {
      const nextScale = Math.max(1, Math.min(5, Number((currentScale + delta).toFixed(2))));
      setPanOffset((currentOffset) => clampPanOffset(currentOffset, nextScale));
      return nextScale;
    });
  };

  const toSvgCoordinates = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }

    const coordinates = toSvgCoordinates(event);
    const nextDragStart = { x: coordinates.x, y: coordinates.y, panX: panOffset.x, panY: panOffset.y };
    dragStartRef.current = nextDragStart;
    setDragStart(nextDragStart);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragStartRef.current) {
      return;
    }

    const coordinates = toSvgCoordinates(event);
    const currentDragStart = dragStartRef.current;
    const nextOffset = {
      x: currentDragStart.panX + (coordinates.x - currentDragStart.x),
      y: currentDragStart.panY + (coordinates.y - currentDragStart.y)
    };

    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setPanOffset(clampPanOffset(nextOffset, zoomScale));
      animationFrameRef.current = null;
    });
  };

  const onPointerEnd = () => {
    dragStartRef.current = null;
    setDragStart(null);
  };

  const centerTranslateX = (width / 2) + panOffset.x;
  const centerTranslateY = (height / 2) + panOffset.y;
  const transform = `translate(${centerTranslateX} ${centerTranslateY}) scale(${zoomScale}) translate(${-width / 2} ${-height / 2})`;

  const controls = (
    <div className="gps-heatmap-controls" role="group" aria-label="Heatmap controls">
      <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => adjustZoom(-0.2)}>{zoomOutLabel}</button>
      <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => adjustZoom(0.2)}>{zoomInLabel}</button>
      <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }}>{zoomResetLabel}</button>
    </div>
  );

  return (
    <>
      {controlsPosition === 'top' && controls}
      <svg
        className={`gps-heatmap ${dragStart ? 'gps-heatmap--dragging' : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
      >
        <rect x="0" y="0" width={width} height={height} rx="8" ry="8" className="gps-heatmap__background" />
        <g transform={transform}>
          {children({ width, height, transform, isDragging: dragStart !== null, handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd } })}
        </g>
      </svg>
      {controlsPosition === 'bottom' && controls}
    </>
  );
}

function MapSurface({ width, height, satelliteImageUrl, children }: MapSurfaceProps) {
  return (
    <>
      <image href={satelliteImageUrl} x="0" y="0" width={width} height={height} preserveAspectRatio="none" className="gps-heatmap__satellite" />
      <rect x="0" y="0" width={width} height={height} rx="8" ry="8" className="gps-heatmap__overlay" />
      {children}
    </>
  );
}

function SegmentationAssistant({ points, bounds, cursorSecond, heartRateSamples, titleHeartRate, titleMap, noHeartRateDataLabel, currentPointLabel, zoomInLabel, zoomOutLabel, zoomResetLabel, sessionId, topControls, betweenControls, currentHeartRateLabel, segmentStartSecond, segmentEndSecond }: SegmentationAssistantProps) {
  const heartRateTrend = useMemo(() => {
    return (heartRateSamples ?? [])
      .filter((sample) => sample.elapsedSeconds >= segmentStartSecond && sample.elapsedSeconds <= segmentEndSecond)
      .map((sample) => ({ xSecond: sample.elapsedSeconds, heartRateBpm: sample.heartRateBpm }))
      .sort((a, b) => a.xSecond - b.xSecond);
  }, [heartRateSamples, segmentStartSecond, segmentEndSecond]);

  const chartPoints = useMemo(() => {
    if (heartRateTrend.length === 0) {
      return '';
    }

    const width = 560;
    const height = 160;
    const minX = Math.min(...heartRateTrend.map((entry) => entry.xSecond));
    const maxX = Math.max(...heartRateTrend.map((entry) => entry.xSecond), minX + 1);
    const spanX = Math.max(1, maxX - minX);
    const maxY = Math.max(...heartRateTrend.map((entry) => entry.heartRateBpm), 1);

    return heartRateTrend
      .map((entry) => {
        const x = ((entry.xSecond - minX) / spanX) * width;
        const y = height - ((entry.heartRateBpm / maxY) * height);
        return `${x},${y}`;
      })
      .join(' ');
  }, [heartRateTrend]);

  const minTrendSecond = heartRateTrend.length > 0
    ? Math.min(...heartRateTrend.map((entry) => entry.xSecond))
    : 0;
  const maxTrendSecond = heartRateTrend.length > 0
    ? Math.max(...heartRateTrend.map((entry) => entry.xSecond), minTrendSecond + 1)
    : minTrendSecond + 1;
  const trendSpanSeconds = Math.max(1, maxTrendSecond - minTrendSecond);
  const maxTrendValue = Math.max(...heartRateTrend.map((entry) => entry.heartRateBpm), 1);

  const clampedCursorSecond = Math.max(minTrendSecond, Math.min(maxTrendSecond, cursorSecond));
  const heartRateInterpolationWindow = heartRateTrend.reduce<{ before: { xSecond: number; heartRateBpm: number } | null; after: { xSecond: number; heartRateBpm: number } | null }>((acc, entry) => {
    if (entry.xSecond <= clampedCursorSecond) {
      return { ...acc, before: entry };
    }

    if (acc.after === null) {
      return { ...acc, after: entry };
    }

    return acc;
  }, { before: null, after: null });
  const heartRateCursorBpm = (() => {
    const before = heartRateInterpolationWindow.before;
    const after = heartRateInterpolationWindow.after;

    if (before && after && after.xSecond !== before.xSecond) {
      const progress = (clampedCursorSecond - before.xSecond) / (after.xSecond - before.xSecond);
      return before.heartRateBpm + ((after.heartRateBpm - before.heartRateBpm) * progress);
    }

    return before?.heartRateBpm ?? after?.heartRateBpm ?? null;
  })();
  const heartRateCursorPoint = heartRateCursorBpm === null
    ? null
    : {
      x: ((clampedCursorSecond - minTrendSecond) / trendSpanSeconds) * 560,
      y: 160 - ((heartRateCursorBpm / maxTrendValue) * 160)
    };

  const cursorIndex = findNearestPointIndexBySecond(points, cursorSecond);
  const cursorPoint = cursorIndex >= 0 ? points[cursorIndex] : null;

  const { width, height, screenPoints, satelliteImageUrl } = useMapProjection(
    points,
    bounds?.minLatitude ?? 0,
    bounds?.maxLatitude ?? 0,
    bounds?.minLongitude ?? 0,
    bounds?.maxLongitude ?? 0
  );

  return (
    <div className="segment-manual-assistant">
      {topControls}
      <h5>{titleHeartRate}</h5>
      {heartRateTrend.length === 0 ? (
        <p>{noHeartRateDataLabel}</p>
      ) : (
        <>
          <svg className="segment-manual-assistant__hr-chart" viewBox="0 0 560 160" role="img" aria-label={titleHeartRate}>
            <rect x="0" y="0" width="560" height="160" rx="6" ry="6" className="segment-manual-assistant__hr-bg" />
            <polyline points={chartPoints} className="segment-manual-assistant__hr-line" />
            {heartRateCursorPoint && <circle cx={heartRateCursorPoint.x} cy={heartRateCursorPoint.y} r="4" className="segment-manual-assistant__cursor-point" />}
          </svg>
          <p>{currentHeartRateLabel}: {heartRateCursorBpm === null ? 'n/a' : Math.round(heartRateCursorBpm)}{heartRateCursorBpm === null ? '' : ' bpm'}</p>
        </>
      )}


      {betweenControls}

      <h5>{titleMap}</h5>
      {points.length === 0 || !bounds ? (
        <p>{currentPointLabel}: n/a</p>
      ) : (
        <>
          <InteractiveMap zoomInLabel={zoomInLabel} zoomOutLabel={zoomOutLabel} zoomResetLabel={zoomResetLabel} sessionId={`segment-assistant-${sessionId}`} ariaLabel={titleMap} controlsPosition="bottom">
            {() => (
              <MapSurface width={width} height={height} satelliteImageUrl={satelliteImageUrl}>
                <polyline points={screenPoints.map((point) => `${point.x},${point.y}`).join(' ')} className="gps-heatmap__track-line" />
                {screenPoints.map((point, index) => index !== cursorIndex ? (
                  <circle
                    key={`segment-assistant-point-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={1.1}
                    className="gps-heatmap__point-marker gps-heatmap__point-marker--blue"
                  />
                ) : null)}
                {cursorIndex >= 0 && (
                  <circle
                    cx={screenPoints[cursorIndex].x}
                    cy={screenPoints[cursorIndex].y}
                    r={3.2}
                    className="segment-manual-assistant__cursor-point"
                  />
                )}
              </MapSurface>
            )}
          </InteractiveMap>
          <p>{currentPointLabel}: {cursorPoint ? `${formatSecondsMmSs(cursorPoint.elapsedSeconds)} (${cursorPoint.elapsedSeconds}s) · ${cursorPoint.latitude.toFixed(5)}, ${cursorPoint.longitude.toFixed(5)}` : 'n/a'}</p>
        </>
      )}
    </div>
  );
}

const HeatmapLayer = memo(function HeatmapLayer({ width, height, densityCells, screenPoints, shouldRenderPointMarkers, viewMode, colorForDensity }: HeatmapLayerProps) {
  return (
    <>
      {viewMode === 'heatmap' ? densityCells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width="8"
          height="8"
          fill={colorForDensity(cell.value)}
          className="gps-heatmap__cell"
        />
      )) : (
        <>
          <polyline
            points={screenPoints.map((point) => `${point.x},${point.y}`).join(' ')}
            className="gps-heatmap__track-line"
          />
          {shouldRenderPointMarkers ? screenPoints.map((point, index) => (
            <circle
              key={`point-${index}`}
              cx={point.x}
              cy={point.y}
              r="0.85"
              className="gps-heatmap__point-marker gps-heatmap__point-marker--blue"
            />
          )) : null}
        </>
      )}
    </>
  );
});

function GpsPointHeatmap({ points, minLatitude, maxLatitude, minLongitude, maxLongitude, zoomInLabel, zoomOutLabel, zoomResetLabel, viewHeatmapLabel, viewPointsLabel, sessionId }: GpsPointHeatmapProps) {
  const { width, height, screenPoints, satelliteImageUrl } = useMapProjection(points, minLatitude, maxLatitude, minLongitude, maxLongitude);
  const [viewMode, setViewMode] = useState<'heatmap' | 'points'>('heatmap');

  const densityCells = useMemo(() => {
    const cellSize = 8;
    const columns = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const influenceRadius = points.length > 2800 ? 4 : points.length > 1400 ? 5 : 6;
    const kernel: number[] = [];

    for (let dy = -influenceRadius; dy <= influenceRadius; dy += 1) {
      for (let dx = -influenceRadius; dx <= influenceRadius; dx += 1) {
        const distance = Math.sqrt((dx ** 2) + (dy ** 2));
        if (distance <= influenceRadius) {
          const weight = Math.exp(-(distance ** 2) / (2 * (Math.max(1.8, influenceRadius * 0.6) ** 2)));
          kernel.push(dx, dy, weight);
        }
      }
    }

    const density = new Float32Array(columns * rows);

    for (const point of screenPoints) {
      const baseColumn = Math.floor(point.x / cellSize);
      const baseRow = Math.floor(point.y / cellSize);

      for (let index = 0; index < kernel.length; index += 3) {
        const column = baseColumn + kernel[index];
        const row = baseRow + kernel[index + 1];

        if (column < 0 || column >= columns || row < 0 || row >= rows) {
          continue;
        }

        density[(row * columns) + column] += kernel[index + 2];
      }
    }

    let maxDensity = 0;
    for (const value of density) {
      if (value > maxDensity) {
        maxDensity = value;
      }
    }

    if (maxDensity === 0) {
      return [] as Array<{ x: number; y: number; value: number }>;
    }

    const cells: Array<{ x: number; y: number; value: number }> = [];
    const minThreshold = 0.025;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const normalizedValue = density[(row * columns) + column] / maxDensity;
        if (normalizedValue < minThreshold) {
          continue;
        }

        cells.push({ x: column * cellSize, y: row * cellSize, value: normalizedValue });
      }
    }

    return cells;
  }, [height, points.length, screenPoints, width]);

  const colorForDensity = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    if (clamped < 0.16) return `rgba(12, 101, 255, ${0.26 + (clamped * 1.65)})`;
    if (clamped < 0.34) return `rgba(0, 195, 255, ${0.34 + ((clamped - 0.16) * 2.05)})`;
    if (clamped < 0.52) return `rgba(20, 237, 124, ${0.5 + ((clamped - 0.34) * 1.72)})`;
    if (clamped < 0.7) return `rgba(235, 237, 24, ${0.62 + ((clamped - 0.52) * 1.95)})`;
    if (clamped < 0.86) return `rgba(255, 137, 19, ${0.74 + ((clamped - 0.7) * 1.58)})`;
    return `rgba(224, 36, 25, ${0.95 + ((clamped - 0.86) * 0.45)})`;
  }, []);

  const shouldRenderPointMarkers = points.length <= 2500;

  useEffect(() => {
    setViewMode('heatmap');
  }, [sessionId]);

  return (
    <>
      <div className="gps-heatmap-view-toggle" role="group" aria-label="Heatmap view mode">
        <button type="button" className={viewMode === 'heatmap' ? 'is-active' : ''} onClick={() => setViewMode('heatmap')}>{viewHeatmapLabel}</button>
        <button type="button" className={viewMode === 'points' ? 'is-active' : ''} onClick={() => setViewMode('points')}>{viewPointsLabel}</button>
      </div>
      <InteractiveMap zoomInLabel={zoomInLabel} zoomOutLabel={zoomOutLabel} zoomResetLabel={zoomResetLabel} sessionId={sessionId} ariaLabel="GPS point heatmap">
        {() => (
          <MapSurface width={width} height={height} satelliteImageUrl={satelliteImageUrl}>
            <HeatmapLayer width={width} height={height} densityCells={densityCells} screenPoints={screenPoints} shouldRenderPointMarkers={shouldRenderPointMarkers} viewMode={viewMode} colorForDensity={colorForDensity} />
          </MapSurface>
        )}
      </InteractiveMap>
    </>
  );
}

function GpsRunsMap({ points, detectedRuns, minLatitude, maxLatitude, minLongitude, maxLongitude, zoomInLabel, zoomOutLabel, zoomResetLabel, sprintThresholdMps, highIntensityThresholdMps, showAllLabel, showSprintLabel, showHighIntensityLabel, showOnlyHsrRunsLabel, showHsrRunsWithSprintPhasesLabel, listTitle, listEmptyLabel, clearSelectionLabel, topSpeedLabel, explanationLabel, sprintMetricLabel, highIntensityMetricLabel, speedUnit, locale, sessionId }: GpsRunsMapProps) {
  const { width, height, screenPoints, satelliteImageUrl } = useMapProjection(points, minLatitude, maxLatitude, minLongitude, maxLongitude);
  const [runFilter, setRunFilter] = useState<'all' | 'sprint' | 'highIntensityOnly' | 'highIntensityWithSprint'>('all');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runSegments = useMemo(() => {
    if (sprintThresholdMps === null || highIntensityThresholdMps === null || points.length < 2) {
      return [] as RunSegment[];
    }

    const appendDirectionalContextPoints = (pointIndices: number[]) => {
      if (pointIndices.length >= 4) {
        return { renderPointIndices: pointIndices, supplementalPointIndices: new Set<number>() };
      }

      const supplementalPointIndices = new Set<number>();
      const firstPointIndex = pointIndices[0];
      const minPointIndex = Math.max(0, firstPointIndex - (4 - pointIndices.length));
      for (let index = firstPointIndex - 1; index >= minPointIndex; index -= 1) {
        supplementalPointIndices.add(index);
      }

      return {
        renderPointIndices: [...Array.from(supplementalPointIndices).sort((a, b) => a - b), ...pointIndices],
        supplementalPointIndices
      };
    };

    const toRenderPoints = (pointIndices: number[]) => {
      const { renderPointIndices, supplementalPointIndices } = appendDirectionalContextPoints(pointIndices);
      return renderPointIndices.map((pointIndex, pointListIndex) => {
      const progression = renderPointIndices.length === 1 ? 1 : pointListIndex / (renderPointIndices.length - 1);
      return {
        x: screenPoints[pointIndex].x,
        y: screenPoints[pointIndex].y,
        radius: 1.1 + (progression * 1.2),
        isEnd: pointListIndex === renderPointIndices.length - 1,
        pointIndex,
        isSupplemental: supplementalPointIndices.has(pointIndex)
      };
    });
    };

    if (detectedRuns && detectedRuns.length > 0) {
      const highIntensityRuns = detectedRuns.filter((run) => run.runType === 'highIntensity');
      const highIntensitySegments = highIntensityRuns
        .map((run, index) => {
          const validPointIndices = run.pointIndices.filter((pointIndex) => pointIndex >= 0 && pointIndex < screenPoints.length);
          if (validPointIndices.length === 0) {
            return null;
          }

          const uniquePointIndices = Array.from(new Set(validPointIndices));
          const sprintPointIndices = Array.from(new Set((run.sprintPhases ?? [])
            .flatMap((phase) => phase.pointIndices)
            .filter((pointIndex) => pointIndex >= 0 && pointIndex < screenPoints.length)));

          return {
            id: run.runId || `${run.runType}-${index + 1}-${Math.round(run.startElapsedSeconds)}`,
            runType: 'highIntensity',
            startElapsedSeconds: run.startElapsedSeconds,
            durationSeconds: run.durationSeconds,
            distanceMeters: run.distanceMeters,
            topSpeedMetersPerSecond: run.topSpeedMetersPerSecond,
            hasSprintPhases: (run.sprintPhases?.length ?? 0) > 0,
            sprintPointIndices,
            pointIndices: uniquePointIndices,
            parentRunId: null,
            points: toRenderPoints(uniquePointIndices)
          } satisfies RunSegment;
        })
        .filter((segment): segment is RunSegment => segment !== null);

      const nestedSprintSegments = highIntensityRuns
        .flatMap((run) => (run.sprintPhases ?? []).map((phase, index) => {
          const validPointIndices = phase.pointIndices.filter((pointIndex) => pointIndex >= 0 && pointIndex < screenPoints.length);
          if (validPointIndices.length === 0) {
            return null;
          }

          const uniquePointIndices = Array.from(new Set(validPointIndices));
          return {
            id: phase.runId || `${run.runId ?? 'highIntensity'}-phase-${index + 1}-${Math.round(phase.startElapsedSeconds)}`,
            runType: 'sprint',
            startElapsedSeconds: phase.startElapsedSeconds,
            durationSeconds: phase.durationSeconds,
            distanceMeters: phase.distanceMeters,
            topSpeedMetersPerSecond: phase.topSpeedMetersPerSecond,
            hasSprintPhases: false,
            sprintPointIndices: uniquePointIndices,
            pointIndices: uniquePointIndices,
            parentRunId: phase.parentRunId,
            points: toRenderPoints(uniquePointIndices)
          } satisfies RunSegment;
        }))
        .filter((segment): segment is RunSegment => segment !== null);

      const standaloneSprintSegments = detectedRuns
        .filter((run) => run.runType === 'sprint' && !run.parentRunId)
        .map((run, index) => {
          const validPointIndices = run.pointIndices.filter((pointIndex) => pointIndex >= 0 && pointIndex < screenPoints.length);
          if (validPointIndices.length === 0) {
            return null;
          }

          const uniquePointIndices = Array.from(new Set(validPointIndices));
          return {
            id: run.runId || `${run.runType}-${index + 1}-${Math.round(run.startElapsedSeconds)}`,
            runType: 'sprint',
            startElapsedSeconds: run.startElapsedSeconds,
            durationSeconds: run.durationSeconds,
            distanceMeters: run.distanceMeters,
            topSpeedMetersPerSecond: run.topSpeedMetersPerSecond,
            hasSprintPhases: false,
            sprintPointIndices: uniquePointIndices,
            pointIndices: uniquePointIndices,
            parentRunId: null,
            points: toRenderPoints(uniquePointIndices)
          } satisfies RunSegment;
        })
        .filter((segment): segment is RunSegment => segment !== null);

      const sprintById = new Map<string, RunSegment>();
      [...nestedSprintSegments, ...standaloneSprintSegments].forEach((segment) => {
        if (!sprintById.has(segment.id)) {
          sprintById.set(segment.id, segment);
        }
      });

      return [...highIntensitySegments, ...Array.from(sprintById.values())]
        .sort((first, second) => first.startElapsedSeconds - second.startElapsedSeconds);
    }

    const earthRadius = 6371000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const distanceMetersBetween = (first: GpsTrackpoint, second: GpsTrackpoint) => {
      const dLat = toRadians(second.latitude - first.latitude);
      const dLon = toRadians(second.longitude - first.longitude);
      const lat1 = toRadians(first.latitude);
      const lat2 = toRadians(second.latitude);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earthRadius * c;
    };

    const speedSamples: Array<{ pointIndex: number; speedMps: number; distanceMeters: number }> = [];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];

      if (previous.elapsedSeconds === null || current.elapsedSeconds === null) {
        continue;
      }

      const deltaSeconds = current.elapsedSeconds - previous.elapsedSeconds;
      if (deltaSeconds <= 0) {
        continue;
      }

      const distanceMeters = distanceMetersBetween(previous, current);
      speedSamples.push({
        pointIndex: index,
        speedMps: distanceMeters / deltaSeconds,
        distanceMeters
      });
    }

    if (speedSamples.length === 0) {
      return [] as RunSegment[];
    }

    const buildSegmentsForThreshold = (runType: 'sprint' | 'highIntensity', thresholdMps: number) => {
      const detectedFallbackRuns: RunSegment[] = [];
      let pendingAboveSamples: number[] = [];
      let currentRunSamples: number[] = [];
      let inRun = false;
      let consecutiveBelow = 0;

      const finalizeRun = () => {
        if (currentRunSamples.length === 0) {
          return;
        }

        const firstSample = speedSamples[currentRunSamples[0]];
        const lastSample = speedSamples[currentRunSamples[currentRunSamples.length - 1]];
        const startElapsedSeconds = points[firstSample.pointIndex].elapsedSeconds ?? 0;
        const endElapsedSeconds = points[lastSample.pointIndex].elapsedSeconds ?? startElapsedSeconds;
        const distanceMeters = currentRunSamples.reduce((sum, sampleIndex) => sum + speedSamples[sampleIndex].distanceMeters, 0);
        const topSpeedMetersPerSecond = Math.max(...currentRunSamples.map((sampleIndex) => speedSamples[sampleIndex].speedMps));

        const pointIndices = Array.from(new Set(currentRunSamples.map((sampleIndex) => speedSamples[sampleIndex].pointIndex)));

        detectedFallbackRuns.push({
          id: `${runType}-${firstSample.pointIndex}-${detectedFallbackRuns.length + 1}`,
          runType,
          startElapsedSeconds,
          durationSeconds: Math.max(0, endElapsedSeconds - startElapsedSeconds),
          distanceMeters,
          topSpeedMetersPerSecond,
          hasSprintPhases: false,
          sprintPointIndices: runType === 'sprint' ? pointIndices : [],
          pointIndices,
          parentRunId: null,
          points: toRenderPoints(pointIndices)
        });
      };

      for (let sampleIndex = 0; sampleIndex < speedSamples.length; sampleIndex += 1) {
        const sample = speedSamples[sampleIndex];
        const aboveThreshold = sample.speedMps >= thresholdMps;

        if (!inRun) {
          if (aboveThreshold) {
            pendingAboveSamples.push(sampleIndex);
            if (pendingAboveSamples.length >= 2) {
              inRun = true;
              currentRunSamples = [...pendingAboveSamples];
              pendingAboveSamples = [];
              consecutiveBelow = 0;
            }
          } else {
            pendingAboveSamples = [];
          }

          continue;
        }

        if (aboveThreshold) {
          currentRunSamples.push(sampleIndex);
          consecutiveBelow = 0;
          continue;
        }

        consecutiveBelow += 1;
        if (consecutiveBelow >= 2) {
          finalizeRun();
          inRun = false;
          pendingAboveSamples = [];
          currentRunSamples = [];
          consecutiveBelow = 0;
        }
      }

      if (inRun) {
        finalizeRun();
      }

      return detectedFallbackRuns;
    };

    const sprintRuns = buildSegmentsForThreshold('sprint', sprintThresholdMps);
    const highIntensityRuns = buildSegmentsForThreshold('highIntensity', highIntensityThresholdMps);

    return [...sprintRuns, ...highIntensityRuns]
      .sort((first, second) => first.startElapsedSeconds - second.startElapsedSeconds);
  }, [detectedRuns, highIntensityThresholdMps, points, screenPoints, sprintThresholdMps]);

  const filteredRunSegments = useMemo(() => runSegments.filter((segment) => {
    if (runFilter === 'all') {
      return segment.runType === 'highIntensity' || (segment.runType === 'sprint' && segment.parentRunId === null);
    }
    if (runFilter === 'sprint') {
      return segment.runType === 'sprint';
    }
    if (runFilter === 'highIntensityOnly') {
      return segment.runType === 'highIntensity';
    }
    return segment.runType === 'highIntensity' && segment.hasSprintPhases;
  }), [runFilter, runSegments]);

  useEffect(() => {
    setRunFilter('all');
    setSelectedRunId(null);
  }, [sessionId]);

  useEffect(() => {
    if (selectedRunId && !filteredRunSegments.some((segment) => segment.id === selectedRunId)) {
      setSelectedRunId(null);
    }
  }, [filteredRunSegments, selectedRunId]);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <p className="gps-heatmap-runs-explanation">{explanationLabel}</p>
      <div className="gps-heatmap-view-toggle" role="group" aria-label="Run type filter">
        <button type="button" className={runFilter === 'all' ? 'is-active' : ''} onClick={() => setRunFilter('all')}>{showAllLabel}</button>
        <button type="button" title={showOnlyHsrRunsLabel} className={runFilter === 'highIntensityOnly' ? 'is-active' : ''} onClick={() => setRunFilter('highIntensityOnly')}>{showHighIntensityLabel}</button>
        <button type="button" className={runFilter === 'sprint' ? 'is-active' : ''} onClick={() => setRunFilter('sprint')}>{showSprintLabel}</button>
        <button type="button" className={runFilter === 'highIntensityWithSprint' ? 'is-active' : ''} onClick={() => setRunFilter('highIntensityWithSprint')}>{showHsrRunsWithSprintPhasesLabel}</button>
      </div>
      <div className="gps-runs-layout">
        <InteractiveMap zoomInLabel={zoomInLabel} zoomOutLabel={zoomOutLabel} zoomResetLabel={zoomResetLabel} sessionId={sessionId} ariaLabel="GPS sprint and high-intensity runs map">
          {() => (
            <MapSurface width={width} height={height} satelliteImageUrl={satelliteImageUrl}>
              {filteredRunSegments.map((segment) => {
                const isMuted = selectedRunId !== null && selectedRunId !== segment.id;
                const lineColorClass = segment.runType === 'sprint' ? 'gps-heatmap__run--sprint' : 'gps-heatmap__run--high-intensity';
                const highlightNestedSprintPoints = runFilter !== 'highIntensityOnly';
                return (
                  <g key={segment.id} className={isMuted ? 'gps-heatmap__run--muted' : ''}>
                    {segment.points.slice(0, -1).map((point, index) => {
                      const nextPoint = segment.points[index + 1];
                      if (!nextPoint) {
                        return null;
                      }

                      const lineSegmentClass = point.isSupplemental ? 'gps-heatmap__run--supplemental' : lineColorClass;
                      return (
                        <line
                          key={`${segment.id}-line-${index}`}
                          x1={point.x}
                          y1={point.y}
                          x2={nextPoint.x}
                          y2={nextPoint.y}
                          className={`gps-heatmap__run-line ${lineSegmentClass}`}
                        />
                      );
                    })}
                    {segment.points.map((point, index) => {
                      const isSprintPoint = !point.isSupplemental
                        && (segment.runType === 'sprint' || (highlightNestedSprintPoints && segment.sprintPointIndices.includes(point.pointIndex)));
                      const pointColorClass = point.isSupplemental
                        ? 'gps-heatmap__run--supplemental'
                        : isSprintPoint
                          ? 'gps-heatmap__run--sprint'
                          : 'gps-heatmap__run--high-intensity';
                      return (
                        <circle
                          key={`${segment.id}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={point.radius}
                          className={`gps-heatmap__run-point ${pointColorClass} ${point.isEnd ? 'gps-heatmap__run-point--end' : ''}`}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </MapSurface>
          )}
        </InteractiveMap>
        <aside className="gps-runs-list" role="region" aria-label={listTitle}>
          <h4>{listTitle}</h4>
          <button type="button" className={selectedRunId === null ? 'is-active' : ''} onClick={() => setSelectedRunId(null)}>{clearSelectionLabel}</button>
          {filteredRunSegments.length === 0 ? (
            <p>{listEmptyLabel}</p>
          ) : (
            <ul className="list-group">
              {filteredRunSegments.map((segment, index) => {
                const label = segment.runType === 'sprint'
                  ? segment.parentRunId ? `${sprintMetricLabel} (${showHighIntensityLabel} ${segment.parentRunId})` : sprintMetricLabel
                  : highIntensityMetricLabel;
                return (
                  <li className="list-group-item" key={segment.id}>
                    <button
                      type="button"
                      className={selectedRunId === segment.id ? 'is-active' : ''}
                      onClick={() => setSelectedRunId(segment.id)}
                    >
                      {label} #{index + 1} · {formatElapsed(segment.startElapsedSeconds)} · {formatDuration(segment.durationSeconds, '0s')} · {formatDistanceComparison(segment.distanceMeters, locale, '0 m')} · {topSpeedLabel}: {formatSpeed(segment.topSpeedMetersPerSecond, speedUnit, 'n/a')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
