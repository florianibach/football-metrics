import { ChangeEvent, DragEvent, FormEvent, PointerEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  highIntensityRunCount: number | null;
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
};

type DataAvailability = {
  mode: 'Dual' | 'HeartRateOnly' | 'GpsOnly' | 'NotAvailable';
  gpsStatus: 'Available' | 'NotMeasured' | 'NotUsable';
  gpsReason: string | null;
  heartRateStatus: 'Available' | 'NotMeasured' | 'NotUsable';
  heartRateReason: string | null;
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
  smoothing: SmoothingTrace;
  coreMetrics: FootballCoreMetrics;
  intervalAggregates: IntervalAggregate[];
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
  accelerationThresholdMps2: number;
  decelerationThresholdMps2: number;
  effectiveMaxSpeedMps: number;
  effectiveMaxHeartRateBpm: number;
  version: number;
  updatedAtUtc: string;
};

type SpeedUnit = 'km/h' | 'm/s' | 'min/km';


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
  startSecond: number;
  endSecond: number;
};

type SegmentChangeEntry = {
  version: number;
  changedAtUtc: string;
  action: string;
  reason: string | null;
  segmentsSnapshot: SessionSegment[];
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
type CoreMetricsCategoryFilter = 'all' | 'external' | 'internal';

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
  | 'metricDataMode'
  | 'metricSmoothingStrategy'
  | 'metricSmoothingOutlier'
  | 'compareTitle'
  | 'compareModeLabel'
  | 'compareModeRaw'
  | 'compareModeSmoothed'
  | 'filterSelectLabel'
  | 'filterDisabledNoGps'
  | 'filterRaw'
  | 'filterAdaptiveMedian'
  | 'filterSavitzkyGolay'
  | 'filterButterworth'
  | 'filterRecommendedBadge'
  | 'filterRecommendationTitle'
  | 'filterRecommendationIntro'
  | 'filterRecommendationImpact'
  | 'filterDescriptionRaw'
  | 'filterDescriptionAdaptiveMedian'
  | 'filterDescriptionSavitzkyGolay'
  | 'filterDescriptionButterworth'
  | 'compareDisabledNoGps'
  | 'metricDirectionChanges'
  | 'metricDataChange'
  | 'metricDataChangeHelp'
  | 'qualityStatusHigh'
  | 'qualityStatusMedium'
  | 'qualityStatusLow'
  | 'dataModeDual'
  | 'dataModeHeartRateOnly'
  | 'dataModeGpsOnly'
  | 'dataModeNotAvailable'
  | 'availabilityAvailable'
  | 'availabilityNotMeasured'
  | 'availabilityNotUsable'
  | 'historyTitle'
  | 'historyEmpty'
  | 'historyColumnFileName'
  | 'historyColumnUploadTime'
  | 'historyColumnActivityTime'
  | 'historyColumnQuality'
  | 'historyColumnSessionType'
  | 'historyColumnDataMode'
  | 'sessionContextTitle'
  | 'sessionTypeLabel'
  | 'sessionTypeTraining'
  | 'sessionTypeMatch'
  | 'sessionTypeRehab'
  | 'sessionTypeAthletics'
  | 'sessionTypeOther'
  | 'sessionContextMatchResult'
  | 'sessionContextCompetition'
  | 'sessionContextOpponentName'
  | 'sessionContextOpponentLogoUrl'
  | 'sessionContextSave'
  | 'sessionContextSaveSuccess'
  | 'sessionContextOnlyForMatches'
  | 'historySortLabel'
  | 'historySortNewest'
  | 'historySortOldest'
  | 'historyOpenDetails'
  | 'historySelectForComparison'
  | 'sessionCompareTitle'
  | 'sessionCompareHint'
  | 'sessionCompareQualityWarning'
  | 'sessionCompareDelta'
  | 'sessionCompareDeltaPercent'
  | 'sessionCompareMetricDistance'
  | 'sessionCompareMetricDuration'
  | 'sessionCompareMetricHeartRateAverage'
  | 'sessionCompareMetricDirectionChanges'
  | 'sessionCompareMetricSprintDistance'
  | 'sessionCompareMetricSprintCount'
  | 'sessionCompareMetricHighIntensityTime'
  | 'sessionCompareMetricTrainingLoad'
  | 'sessionCompareMetricDataMode'
  | 'sessionCompareBaselineLabel'
  | 'sessionCompareBaselineHint'
  | 'detailMissingHeartRateHint'
  | 'detailMissingDistanceHint'
  | 'detailMissingGpsHint'
  | 'gpsHeatmapTitle'
  | 'gpsHeatmapDescription'
  | 'gpsHeatmapNoDataHint'
  | 'gpsHeatmapZoomIn'
  | 'gpsHeatmapZoomOut'
  | 'gpsHeatmapZoomReset'
  | 'hfOnlyInsightTitle'
  | 'hfOnlyInsightInterpretation'
  | 'coreMetricsTitle'
  | 'coreMetricsUnavailable'
  | 'metricStateNotMeasured'
  | 'metricStateNotUsable'
  | 'metricSprintDistance'
  | 'metricSprintCount'
  | 'metricMaxSpeed'
  | 'metricHighIntensityTime'
  | 'metricHighIntensityRunCount'
  | 'metricCoreThresholds'
  | 'metricHighSpeedDistance'
  | 'metricRunningDensity'
  | 'metricAccelerationCount'
  | 'metricDecelerationCount'
  | 'metricHrZoneLow'
  | 'metricHrZoneMedium'
  | 'metricHrZoneHigh'
  | 'metricTrimpEdwards'
  | 'metricTrimpPerMinute'
  | 'metricHrRecovery60'
  | 'intervalAggregationTitle'
  | 'intervalAggregationWindowLabel'
  | 'intervalAggregationWindow1'
  | 'intervalAggregationWindow2'
  | 'intervalAggregationWindow5'
  | 'intervalAggregationStart'
  | 'intervalAggregationExternalDistance'
  | 'intervalAggregationInternalAvgHeartRate'
  | 'intervalAggregationInternalLoad'
  | 'intervalAggregationDuration'
  | 'intervalAggregationNoData'
  | 'intervalAggregationCoreMetrics'
  | 'intervalAggregationWindowCount'
  | 'intervalAggregationExplanation'
  | 'profileSettingsTitle'
  | 'profilePrimaryPosition'
  | 'profileSecondaryPosition'
  | 'profileSecondaryOptional'
  | 'profileSave'
  | 'profileSaveSuccess'
  | 'profileValidationPrimaryRequired'
  | 'profileValidationSecondaryDistinct'
  | 'profileCurrentPosition'
  | 'profileThresholdsTitle'
  | 'profileThresholdSprint'
  | 'profileThresholdSprintMode'
  | 'profileThresholdHighIntensity'
  | 'profileThresholdHighIntensityMode'
  | 'profileThresholdMaxSpeedMode'
  | 'profileThresholdMaxHeartRateMode'
  | 'profileEffectiveMaxSpeed'
  | 'profileEffectiveMaxHeartRate'
  | 'profileDerivedSprintThreshold'
  | 'profileDerivedHighIntensityThreshold'
  | 'sessionThresholdTransparencyTitle'
  | 'profileThresholdAcceleration'
  | 'profileThresholdAccelerationMode'
  | 'profileThresholdDeceleration'
  | 'profileThresholdDecelerationMode'
  | 'profileThresholdModeLabel'
  | 'profileThresholdModeFixed'
  | 'profileThresholdModeAdaptive'
  | 'profileAdaptiveDataBasisHint'
  | 'profileThresholdVersion'
  | 'profileThresholdUpdatedAt'
  | 'profileDefaultSmoothingFilter'
  | 'profileDefaultSmoothingFilterHelp'
  | 'profilePreferredSpeedUnit'
  | 'profilePreferredSpeedUnitHelp'
  | 'profilePreferredAggregationWindow'
  | 'profilePreferredAggregationWindowHelp'
  | 'filterSourceLabel'
  | 'filterSourceProfileDefault'
  | 'filterSourceManualOverride'
  | 'coreMetricsCategoryTitle'
  | 'coreMetricsCategoryDescription'
  | 'coreMetricsCategoryTabAll'
  | 'coreMetricsCategoryTabExternal'
  | 'coreMetricsCategoryTabInternal'
  | 'coreMetricsCategoryExternalTitle'
  | 'coreMetricsCategoryExternalHelp'
  | 'coreMetricsCategoryInternalTitle'
  | 'coreMetricsCategoryInternalHelp'
  | 'segmentsTitle'
  | 'segmentsEmpty'
  | 'segmentLabel'
  | 'segmentStartSecond'
  | 'segmentEndSecond'
  | 'segmentReason'
  | 'segmentAdd'
  | 'segmentUpdate'
  | 'segmentEdit'
  | 'segmentDelete'
  | 'segmentCancelEdit'
  | 'segmentMergeTitle'
  | 'segmentMergeSource'
  | 'segmentMergeTarget'
  | 'segmentMergeLabel'
  | 'segmentMergeAction'
  | 'segmentHistoryTitle'
  | 'segmentCreateSuccess'
  | 'segmentUpdateSuccess'
  | 'segmentDeleteSuccess'
  | 'segmentMergeSuccess'
  | 'segmentErrorPrefix'
  | 'segmentValidationRequired'
  | 'segmentValidationRange'
  | 'segmentValidationMergeSelection'
  | 'sessionRecalculateButton'
  | 'sessionRecalculateSuccess'
  | 'sessionRecalculateProfileInfo'
  | 'sessionRecalculateHistoryTitle'
  | 'sessionRecalculateHistoryEmpty'
  | 'filterSourceProfileRecalculation'
  | 'profileRecalculateAllButton'
  | 'profileRecalculateAllTriggered'
  | 'profileRecalculationStatusTitle'
  | 'profileRecalculationStatusRunning'
  | 'profileRecalculationStatusCompleted'
  | 'profileRecalculationStatusFailed';

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').trim();
const normalizedApiBaseUrl = configuredApiBaseUrl.replace(/\/+$/, '');
const apiBaseUrl = normalizedApiBaseUrl.endsWith('/api/v1')
  ? normalizedApiBaseUrl
  : normalizedApiBaseUrl.endsWith('/api')
    ? `${normalizedApiBaseUrl}/v1`
    : `${normalizedApiBaseUrl}/api/v1`;
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
    metricDataMode: 'Data mode',
    metricSmoothingStrategy: 'Smoothing strategy',
    metricSmoothingOutlier: 'Outlier detection',
    compareTitle: 'Raw vs. smoothed comparison',
    compareModeLabel: 'Display mode',
    compareModeRaw: 'Raw data',
    compareModeSmoothed: 'Smoothed data',
    filterSelectLabel: 'Smoothing filter',
    filterDisabledNoGps: 'Filter selection is disabled because this session does not contain GPS coordinates.',
    filterRaw: 'Raw',
    filterAdaptiveMedian: 'AdaptiveMedian',
    filterSavitzkyGolay: 'Savitzky-Golay',
    filterButterworth: 'Butterworth',
    filterRecommendedBadge: 'recommended',
    filterRecommendationTitle: 'Filter guide',
    filterRecommendationIntro: 'Product recommendation: AdaptiveMedian is the default for amateur football sessions because it best preserves short direction changes and stop-and-go patterns while reducing implausible GPS outliers.',
    filterRecommendationImpact: 'Changing the smoothing filter can alter shown distance, direction-change counts, and derived football metrics.',
    filterDescriptionRaw: 'Raw: Purpose: inspect unprocessed GPS points. Strengths: maximum transparency. Limits: keeps jitter and spikes. Typical use: troubleshooting unusual sessions.',
    filterDescriptionAdaptiveMedian: 'AdaptiveMedian: Purpose: football-first smoothing for short accelerations and turns. Strengths: balances outlier correction with preserved quick changes. Limits: small residual noise can remain. Typical use: recommended default for most sessions.',
    filterDescriptionSavitzkyGolay: 'Savitzky-Golay: Purpose: polynomial smoothing for stable trajectories. Strengths: clean curve shape for trend viewing. Limits: can flatten very abrupt actions. Typical use: tactical pattern review with moderate noise.',
    filterDescriptionButterworth: 'Butterworth: Purpose: low-pass filtering for strong noise suppression. Strengths: robust against high-frequency jitter. Limits: highest risk of smoothing away short explosive actions. Typical use: noisy device traces requiring stronger cleanup.',
    compareDisabledNoGps: 'Comparison is disabled because this session does not contain GPS coordinates.',
    metricDirectionChanges: 'Direction changes',
    metricDataChange: 'Data change due to smoothing',
    metricDataChangeHelp: '{correctedShare}% corrected points ({correctedPoints}/{trackpoints}), distance delta {distanceDelta}',
    qualityStatusHigh: 'high',
    qualityStatusMedium: 'medium',
    qualityStatusLow: 'low',
    dataModeDual: 'Dual (GPS + heart rate)',
    dataModeHeartRateOnly: 'Heart-rate only',
    dataModeGpsOnly: 'GPS only',
    dataModeNotAvailable: 'Not available',
    availabilityAvailable: 'available',
    availabilityNotMeasured: 'not measured',
    availabilityNotUsable: 'measurement unusable',
    historyTitle: 'Upload history',
    historyEmpty: 'No uploaded sessions yet.',
    historyColumnFileName: 'File name',
    historyColumnUploadTime: 'Upload time',
    historyColumnActivityTime: 'Activity time',
    historyColumnQuality: 'Quality status',
    historyColumnSessionType: 'Session type',
    historyColumnDataMode: 'Data mode',
    sessionContextTitle: 'Session context',
    sessionTypeLabel: 'Type',
    sessionTypeTraining: 'Training',
    sessionTypeMatch: 'Match',
    sessionTypeRehab: 'Rehab',
    sessionTypeAthletics: 'Athletics',
    sessionTypeOther: 'Other',
    sessionContextMatchResult: 'Result',
    sessionContextCompetition: 'Competition',
    sessionContextOpponentName: 'Opponent',
    sessionContextOpponentLogoUrl: 'Opponent logo URL (optional)',
    sessionContextSave: 'Save context',
    sessionContextSaveSuccess: 'Session context saved.',
    sessionContextOnlyForMatches: 'Game context fields are only used for sessions of type Match.',
    historySortLabel: 'Sort by upload time',
    historySortNewest: 'Newest first',
    historySortOldest: 'Oldest first',
    historyOpenDetails: 'Open details',
    historySelectForComparison: 'Select for comparison',
    sessionCompareTitle: 'Session comparison',
    sessionCompareHint: 'Select at least 2 sessions to compare metrics and quality.',
    sessionCompareQualityWarning: 'Quality warning: selected sessions have different data quality. Compare with caution to avoid misinterpretation.',
    sessionCompareDelta: 'Delta vs baseline',
    sessionCompareDeltaPercent: 'Delta (%) vs baseline',
    sessionCompareMetricDistance: 'Distance',
    sessionCompareMetricDuration: 'Duration',
    sessionCompareMetricHeartRateAverage: 'Heart rate avg',
    sessionCompareMetricDirectionChanges: 'Direction changes',
    sessionCompareMetricSprintDistance: 'Sprint distance',
    sessionCompareMetricSprintCount: 'Sprint count',
    sessionCompareMetricHighIntensityTime: 'High-intensity time',
    sessionCompareMetricTrainingLoad: 'TRIMP (Edwards)',
    sessionCompareMetricDataMode: 'Data mode',
    sessionCompareBaselineLabel: 'Baseline session',
    sessionCompareBaselineHint: 'Choose the baseline that all deltas should reference.',
    detailMissingHeartRateHint: 'Heart-rate values are missing in this session. The metric is intentionally shown as not available.',
    detailMissingDistanceHint: 'Distance cannot be calculated because GPS points are missing. No fallback chart is rendered.',
    detailMissingGpsHint: 'No GPS coordinates were detected in this file.',
    gpsHeatmapTitle: 'GPS point heatmap',
    gpsHeatmapDescription: 'Visual density map built from the imported GPS points of this session.',
    gpsHeatmapNoDataHint: 'No heatmap available because GPS coordinates are missing in this session.',
    gpsHeatmapZoomIn: 'Zoom in',
    gpsHeatmapZoomOut: 'Zoom out',
    gpsHeatmapZoomReset: 'Reset zoom',
    hfOnlyInsightTitle: 'HF-only interpretation aid',
    hfOnlyInsightInterpretation: 'This session was analyzed only with heart-rate data. Focus on average/max heart rate, HR zones, time above 85% HRmax, and TRIMP/TRIMP per minute to interpret internal load. GPS metrics are intentionally hidden or marked as not available.',
    coreMetricsTitle: 'Football core metrics (v1)',
    coreMetricsUnavailable: 'Core metrics unavailable: {reason}',
    metricStateNotMeasured: 'Not measured',
    metricStateNotUsable: 'Measurement unusable',
    metricSprintDistance: 'Sprint distance',
    metricSprintCount: 'Sprint count',
    metricMaxSpeed: 'Maximum speed',
    metricHighIntensityTime: 'High-intensity time',
    metricHighIntensityRunCount: 'High-intensity runs',
    metricCoreThresholds: 'Thresholds',
    metricHighSpeedDistance: 'High-speed distance',
    metricRunningDensity: 'Running density (m/min)',
    metricAccelerationCount: 'Accelerations',
    metricDecelerationCount: 'Decelerations',
    metricHrZoneLow: 'HR zone <70%',
    metricHrZoneMedium: 'HR zone 70-85%',
    metricHrZoneHigh: 'HR zone >85%',
    metricTrimpEdwards: 'TRIMP (Edwards)',
    metricTrimpPerMinute: 'TRIMP/min',
    metricHrRecovery60: 'HR recovery after 60s',
    intervalAggregationTitle: 'Interval aggregation (1 / 2 / 5 minutes)',
    intervalAggregationWindowLabel: 'Aggregation window',
    intervalAggregationWindow1: '1 minute',
    intervalAggregationWindow2: '2 minutes',
    intervalAggregationWindow5: '5 minutes',
    intervalAggregationStart: 'Window start',
    intervalAggregationExternalDistance: 'External: distance',
    intervalAggregationInternalAvgHeartRate: 'Internal: average heart rate',
    intervalAggregationInternalLoad: 'Internal: load (TRIMP)',
    intervalAggregationDuration: 'Duration',
    intervalAggregationNoData: 'No interval data available for this session.',
    intervalAggregationCoreMetrics: 'Core metrics',
    intervalAggregationWindowCount: 'Windows: {count}',
    intervalAggregationExplanation: 'Interval views help you understand how effort changes during a session instead of only seeing one total value. 1-minute windows highlight short, intense phases such as pressing, repeated sprints, or quick transitions. 2-minute windows smooth out noise a bit and make it easier to compare short game phases. 5-minute windows show the broader load trend, for example whether intensity drops after a high-pressure period or rises again near the end. Together, these views help coaches and players identify pacing, fatigue patterns, and where targeted training can improve match performance.',
    profileSettingsTitle: 'Profile settings',
    profilePrimaryPosition: 'Primary position',
    profileSecondaryPosition: 'Secondary position',
    profileSecondaryOptional: 'Optional',
    profileSave: 'Save profile',
    profileSaveSuccess: 'Profile updated successfully.',
    profileValidationPrimaryRequired: 'Please select a primary position.',
    profileValidationSecondaryDistinct: 'Primary and secondary position must differ.',
    profileCurrentPosition: 'Current profile: {primary} / {secondary}',
    profileThresholdsTitle: 'Metric thresholds',
    profileThresholdSprint: 'Sprint speed threshold (% of max speed)',
    profileThresholdSprintMode: 'Sprint speed threshold (% of max speed)',
    profileThresholdHighIntensity: 'High-intensity speed threshold (% of max speed)',
    profileThresholdHighIntensityMode: 'High-intensity speed threshold (% of max speed)',
    profileThresholdMaxSpeedMode: 'Max speed mode',
    profileThresholdMaxHeartRateMode: 'Max heartrate mode',
    profileThresholdAcceleration: 'Acceleration threshold (m/s²)',
    profileThresholdAccelerationMode: 'Effective max speed (read-only in adaptive mode)',
    profileThresholdDeceleration: 'Deceleration threshold (m/s²)',
    profileThresholdDecelerationMode: 'Effective max heartrate (read-only in adaptive mode)',
    profileEffectiveMaxSpeed: 'Effective max speed',
    profileEffectiveMaxHeartRate: 'Effective max heartrate',
    profileDerivedSprintThreshold: 'Derived sprint threshold',
    profileDerivedHighIntensityThreshold: 'Derived high-intensity threshold',
    sessionThresholdTransparencyTitle: 'Session threshold transparency',
    profileThresholdModeLabel: 'Threshold mode',
    profileThresholdModeFixed: 'Fixed',
    profileThresholdModeAdaptive: 'Adaptive (max over all sessions)',
    profileAdaptiveDataBasisHint: 'Adaptive mode uses the current maximum value across all sessions as data basis.',
    profileThresholdVersion: 'Threshold version',
    profileThresholdUpdatedAt: 'Last updated (UTC)',
    profileDefaultSmoothingFilter: 'Default smoothing filter',
    profileDefaultSmoothingFilterHelp: 'Used as preselected filter for new session analyses. You can still override per session.',
    profilePreferredSpeedUnit: 'Preferred speed unit',
    profilePreferredSpeedUnitHelp: 'Used as default unit for new session analyses. You can still override per session without changing your profile.',
    profilePreferredAggregationWindow: 'Preferred aggregation window',
    profilePreferredAggregationWindowHelp: 'Used as default interval aggregation window for new session analyses. You can still override per session without changing your profile.',
    sessionSpeedUnitLabel: 'Speed unit',
    sessionSpeedUnitSourceLabel: 'Speed unit source',
    speedUnitSourceProfileDefault: 'Profile default',
    speedUnitSourceManualOverride: 'Manual override',
    speedUnitSourceProfileRecalculation: 'Profile recalculation',
    filterSourceLabel: 'Filter source',
    filterSourceProfileDefault: 'Profile default',
    filterSourceManualOverride: 'Manual override',
    sessionRecalculateButton: 'Recalculate with current profile',
    sessionRecalculateSuccess: 'Session recalculated with current profile settings.',
    sessionRecalculateProfileInfo: 'Applied profile: threshold version {version} (updated {thresholdUpdated}), smoothing filter {filter} (captured {capturedAt}).',
    sessionRecalculateHistoryTitle: 'Recalculation history',
    sessionRecalculateHistoryEmpty: 'No recalculations yet.',
    filterSourceProfileRecalculation: 'Profile recalculation',
    profileRecalculateAllButton: 'Recalculate all sessions now',
    profileRecalculateAllTriggered: 'Background recalculation started.',
    profileRecalculationStatusTitle: 'Latest background recalculation',
    profileRecalculationStatusRunning: 'Running',
    profileRecalculationStatusCompleted: 'Completed',
    profileRecalculationStatusFailed: 'Failed',
    coreMetricsCategoryTitle: 'Metric categories',
    coreMetricsCategoryDescription: 'Separate external and internal load metrics to focus your interpretation. External metrics show what you did physically on the pitch, while internal metrics show how hard your body had to work to produce that output.',
    coreMetricsCategoryTabAll: 'All metrics',
    coreMetricsCategoryTabExternal: 'External metrics',
    coreMetricsCategoryTabInternal: 'Internal metrics',
    coreMetricsCategoryExternalTitle: 'External metrics (movement-based)',
    coreMetricsCategoryExternalHelp: 'External metrics describe your visible physical output and answer: What did I do on the pitch? They are built from movement and speed data, for example distance covered, top speed, and acceleration/deceleration events. In simple terms, these values show your running volume and intensity independent of how your body felt internally. A high external load usually means many intense actions, but it does not automatically mean your body coped well with them.',
    coreMetricsCategoryInternalTitle: 'Internal metrics (heart-rate-based)',
    coreMetricsCategoryInternalHelp: 'Internal metrics describe your physiological response and answer: How hard did this session feel for my body? They are derived from heart-rate intensity and recovery behavior, for example time in heart-rate zones, TRIMP load, and heart-rate recovery. In simple terms, these values show your cardiovascular strain and recovery quality, even when movement output is similar. If internal load is unusually high compared with external load, this can indicate fatigue, stress, heat effects, or incomplete recovery.',
    segmentsTitle: 'Session segments',
    segmentsEmpty: 'No segments yet. Add your first phase to structure this session.',
    segmentLabel: 'Label',
    segmentStartSecond: 'Start (s)',
    segmentEndSecond: 'End (s)',
    segmentReason: 'Reason (optional)',
    segmentAdd: 'Add segment',
    segmentUpdate: 'Save segment changes',
    segmentEdit: 'Edit',
    segmentDelete: 'Delete',
    segmentCancelEdit: 'Cancel',
    segmentMergeTitle: 'Merge segments',
    segmentMergeSource: 'Source segment',
    segmentMergeTarget: 'Target segment',
    segmentMergeLabel: 'Merged label (optional)',
    segmentMergeAction: 'Merge',
    segmentHistoryTitle: 'Segment change history',
    segmentCreateSuccess: 'Segment created.',
    segmentUpdateSuccess: 'Segment updated.',
    segmentDeleteSuccess: 'Segment deleted.',
    segmentMergeSuccess: 'Segments merged.',
    segmentErrorPrefix: 'Segment action failed:',
    segmentValidationRequired: 'Please enter label, start and end for the segment.',
    segmentValidationRange: 'End must be greater than start and both values must be non-negative.',
    segmentValidationMergeSelection: 'Please select both source and target segments for merge.'
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
    metricDataMode: 'Datenmodus',
    metricSmoothingStrategy: 'Glättungsstrategie',
    metricSmoothingOutlier: 'Ausreißer-Erkennung',
    compareTitle: 'Vergleich Rohdaten vs. geglättet',
    compareModeLabel: 'Darstellungsmodus',
    compareModeRaw: 'Rohdaten',
    compareModeSmoothed: 'Geglättet',
    filterSelectLabel: 'Glättungsfilter',
    filterDisabledNoGps: 'Die Filterauswahl ist deaktiviert, weil diese Session keine GPS-Koordinaten enthält.',
    filterRaw: 'Raw',
    filterAdaptiveMedian: 'AdaptiveMedian',
    filterSavitzkyGolay: 'Savitzky-Golay',
    filterButterworth: 'Butterworth',
    filterRecommendedBadge: 'empfohlen',
    filterRecommendationTitle: 'Filter-Hilfe',
    filterRecommendationIntro: 'Produktempfehlung: AdaptiveMedian ist der Standard für Amateur-Fußballsessions, weil kurzzeitige Richtungswechsel und Stop-and-Go-Bewegungen besser erhalten bleiben, während unplausible GPS-Ausreißer reduziert werden.',
    filterRecommendationImpact: 'Beim Wechsel des Glättungsfilters können sich Distanz, Richtungswechsel und abgeleitete Fußballmetriken ändern.',
    filterDescriptionRaw: 'Raw: Zweck: ungefilterte GPS-Punkte prüfen. Stärken: maximale Transparenz. Grenzen: enthält Jitter und Ausreißer. Typische Nutzung: Fehlersuche bei auffälligen Sessions.',
    filterDescriptionAdaptiveMedian: 'AdaptiveMedian: Zweck: fußballorientierte Glättung für kurze Beschleunigungen und Richtungswechsel. Stärken: gute Balance aus Ausreißerkorrektur und Erhalt schneller Aktionen. Grenzen: leichte Restschwankungen möglich. Typische Nutzung: empfohlener Standard für die meisten Sessions.',
    filterDescriptionSavitzkyGolay: 'Savitzky-Golay: Zweck: polynomiale Glättung für stabile Trajektorien. Stärken: ruhiger Kurvenverlauf für Trendbetrachtung. Grenzen: sehr abrupte Aktionen können abgeflacht werden. Typische Nutzung: Musteranalyse bei moderatem Rauschen.',
    filterDescriptionButterworth: 'Butterworth: Zweck: Tiefpassfilter für starke Rauschunterdrückung. Stärken: robust bei hochfrequentem GPS-Jitter. Grenzen: größtes Risiko, kurze explosive Aktionen zu glätten. Typische Nutzung: stark verrauschte Aufzeichnungen mit höherem Bereinigungsbedarf.',
    compareDisabledNoGps: 'Der Vergleich ist deaktiviert, weil diese Session keine GPS-Koordinaten enthält.',
    metricDirectionChanges: 'Richtungswechsel',
    metricDataChange: 'Datenänderung durch Glättung',
    metricDataChangeHelp: '{correctedShare}% korrigierte Punkte ({correctedPoints}/{trackpoints}), Distanzabweichung {distanceDelta}',
    qualityStatusHigh: 'hoch',
    qualityStatusMedium: 'mittel',
    qualityStatusLow: 'niedrig',
    dataModeDual: 'Dual (GPS + Herzfrequenz)',
    dataModeHeartRateOnly: 'Nur Herzfrequenz',
    dataModeGpsOnly: 'Nur GPS',
    dataModeNotAvailable: 'Nicht verfügbar',
    availabilityAvailable: 'verfügbar',
    availabilityNotMeasured: 'nicht gemessen',
    availabilityNotUsable: 'Messung unbrauchbar',
    historyTitle: 'Upload-Historie',
    historyEmpty: 'Noch keine hochgeladenen Sessions.',
    historyColumnFileName: 'Dateiname',
    historyColumnUploadTime: 'Upload-Zeit',
    historyColumnActivityTime: 'Aktivitätszeit',
    historyColumnQuality: 'Qualitätsstatus',
    historyColumnSessionType: 'Session-Typ',
    historyColumnDataMode: 'Datenmodus',
    sessionContextTitle: 'Session-Kontext',
    sessionTypeLabel: 'Typ',
    sessionTypeTraining: 'Training',
    sessionTypeMatch: 'Spiel',
    sessionTypeRehab: 'Reha',
    sessionTypeAthletics: 'Athletik',
    sessionTypeOther: 'Sonstiges',
    sessionContextMatchResult: 'Ergebnis',
    sessionContextCompetition: 'Wettbewerb',
    sessionContextOpponentName: 'Gegner',
    sessionContextOpponentLogoUrl: 'Gegner-Logo-URL (optional)',
    sessionContextSave: 'Kontext speichern',
    sessionContextSaveSuccess: 'Session-Kontext gespeichert.',
    sessionContextOnlyForMatches: 'Spielkontext-Felder werden nur für Sessions vom Typ Spiel verwendet.',
    historySortLabel: 'Nach Upload-Zeit sortieren',
    historySortNewest: 'Neueste zuerst',
    historySortOldest: 'Älteste zuerst',
    historyOpenDetails: 'Details öffnen',
    historySelectForComparison: 'Für Vergleich auswählen',
    sessionCompareTitle: 'Session-Vergleich',
    sessionCompareHint: 'Wähle mindestens 2 Sessions aus, um Metriken und Qualität zu vergleichen.',
    sessionCompareQualityWarning: 'Qualitätswarnung: Die ausgewählten Sessions haben unterschiedliche Datenqualität. Vergleiche die Ergebnisse mit Vorsicht, um Fehlinterpretationen zu vermeiden.',
    sessionCompareDelta: 'Delta zur Basis',
    sessionCompareDeltaPercent: 'Delta (%) zur Basis',
    sessionCompareMetricDistance: 'Distanz',
    sessionCompareMetricDuration: 'Dauer',
    sessionCompareMetricHeartRateAverage: 'Herzfrequenz Ø',
    sessionCompareMetricDirectionChanges: 'Richtungswechsel',
    sessionCompareMetricSprintDistance: 'Sprintdistanz',
    sessionCompareMetricSprintCount: 'Sprintanzahl',
    sessionCompareMetricHighIntensityTime: 'Hochintensive Zeit',
    sessionCompareMetricTrainingLoad: 'TRIMP (Edwards)',
    sessionCompareMetricDataMode: 'Datenmodus',
    sessionCompareBaselineLabel: 'Basis-Session',
    sessionCompareBaselineHint: 'Wähle die Basis, auf die sich alle Deltas beziehen sollen.',
    detailMissingHeartRateHint: 'In dieser Session fehlen Herzfrequenzwerte. Die Metrik wird bewusst als nicht vorhanden angezeigt.',
    detailMissingDistanceHint: 'Die Distanz kann nicht berechnet werden, weil GPS-Punkte fehlen. Es wird kein Platzhalterdiagramm angezeigt.',
    detailMissingGpsHint: 'In dieser Datei wurden keine GPS-Koordinaten erkannt.',
    gpsHeatmapTitle: 'GPS-Punkte-Heatmap',
    gpsHeatmapDescription: 'Visuelle Dichtekarte auf Basis der importierten GPS-Punkte dieser Session.',
    gpsHeatmapNoDataHint: 'Keine Heatmap verfügbar, da in dieser Session GPS-Koordinaten fehlen.',
    gpsHeatmapZoomIn: 'Hineinzoomen',
    gpsHeatmapZoomOut: 'Herauszoomen',
    gpsHeatmapZoomReset: 'Zoom zurücksetzen',
    hfOnlyInsightTitle: 'Interpretationshilfe für HF-only',
    hfOnlyInsightInterpretation: 'Diese Session wurde ausschließlich mit Herzfrequenzdaten analysiert. Nutze vor allem durchschnittliche/maximale Herzfrequenz, HF-Zonen, Zeit über 85% HFmax sowie TRIMP/TRIMP pro Minute zur Einordnung der internen Belastung. GPS-Metriken werden bewusst ausgeblendet oder als nicht verfügbar markiert.',
    coreMetricsTitle: 'Fußball-Kernmetriken (v1)',
    coreMetricsUnavailable: 'Kernmetriken nicht verfügbar: {reason}',
    metricStateNotMeasured: 'Nicht gemessen',
    metricStateNotUsable: 'Messung unbrauchbar',
    metricSprintDistance: 'Sprintdistanz',
    metricSprintCount: 'Anzahl Sprints',
    metricMaxSpeed: 'Maximalgeschwindigkeit',
    metricHighIntensityTime: 'Hochintensitätszeit',
    metricHighIntensityRunCount: 'Anzahl hochintensive Läufe',
    metricCoreThresholds: 'Schwellenwerte',
    metricHighSpeedDistance: 'Hochintensive Laufdistanz',
    metricRunningDensity: 'Laufdichte (m/min)',
    metricAccelerationCount: 'Beschleunigungen',
    metricDecelerationCount: 'Abbremsungen',
    metricHrZoneLow: 'HF-Zone <70%',
    metricHrZoneMedium: 'HF-Zone 70-85%',
    metricHrZoneHigh: 'HF-Zone >85%',
    metricTrimpEdwards: 'TRIMP (Edwards)',
    metricTrimpPerMinute: 'TRIMP/min',
    metricHrRecovery60: 'HF-Erholung nach 60s',
    intervalAggregationTitle: 'Intervall-Aggregation (1 / 2 / 5 Minuten)',
    intervalAggregationWindowLabel: 'Aggregationsfenster',
    intervalAggregationWindow1: '1 Minute',
    intervalAggregationWindow2: '2 Minuten',
    intervalAggregationWindow5: '5 Minuten',
    intervalAggregationStart: 'Fensterstart',
    intervalAggregationExternalDistance: 'Extern: Distanz',
    intervalAggregationInternalAvgHeartRate: 'Intern: durchschnittliche Herzfrequenz',
    intervalAggregationInternalLoad: 'Intern: Belastung (TRIMP)',
    intervalAggregationDuration: 'Dauer',
    intervalAggregationNoData: 'Für diese Session sind keine Intervall-Daten verfügbar.',
    intervalAggregationCoreMetrics: 'Kernmetriken',
    intervalAggregationWindowCount: 'Fenster: {count}',
    intervalAggregationExplanation: 'Die Intervallansicht hilft dir zu erkennen, wie sich die Belastung innerhalb einer Einheit verändert – statt nur einen Gesamtwert zu sehen. 1-Minuten-Fenster machen kurze, sehr intensive Phasen sichtbar, zum Beispiel Pressing, wiederholte Sprints oder schnelle Umschaltmomente. 2-Minuten-Fenster glätten das Bild etwas und eignen sich gut, um kurze Spielphasen miteinander zu vergleichen. 5-Minuten-Fenster zeigen den größeren Belastungstrend, etwa ob die Intensität nach einer Druckphase abfällt oder zum Ende wieder ansteigt. Zusammen helfen diese Sichten dabei, Tempoverteilung, Ermüdungsmuster und konkrete Trainingsansätze besser zu verstehen.',
    profileSettingsTitle: 'Profileinstellungen',
    profilePrimaryPosition: 'Primärposition',
    profileSecondaryPosition: 'Sekundärposition',
    profileSecondaryOptional: 'Optional',
    profileSave: 'Profil speichern',
    profileSaveSuccess: 'Profil erfolgreich gespeichert.',
    profileValidationPrimaryRequired: 'Bitte wähle eine Primärposition aus.',
    profileValidationSecondaryDistinct: 'Primär- und Sekundärposition müssen unterschiedlich sein.',
    profileCurrentPosition: 'Aktuelles Profil: {primary} / {secondary}',
    profileThresholdsTitle: 'Metrik-Schwellenwerte',
    profileThresholdSprint: 'Sprint-Schwelle (% von Max Speed)',
    profileThresholdSprintMode: 'Sprint-Schwelle (% von Max Speed)',
    profileThresholdHighIntensity: 'High-Intensity-Schwelle (% von Max Speed)',
    profileThresholdHighIntensityMode: 'High-Intensity-Schwelle (% von Max Speed)',
    profileThresholdMaxSpeedMode: 'Modus Max Speed',
    profileThresholdMaxHeartRateMode: 'Modus Max Heartrate',
    profileThresholdAcceleration: 'Beschleunigungs-Schwelle (m/s²)',
    profileThresholdAccelerationMode: 'Effektive Max Speed (read-only bei adaptiv)',
    profileThresholdDeceleration: 'Verzögerungs-Schwelle (m/s²)',
    profileThresholdDecelerationMode: 'Effektive Max Heartrate (read-only bei adaptiv)',
    profileEffectiveMaxSpeed: 'Effektive Max Speed',
    profileEffectiveMaxHeartRate: 'Effektive Max Heartrate',
    profileDerivedSprintThreshold: 'Abgeleitete Sprint-Schwelle',
    profileDerivedHighIntensityThreshold: 'Abgeleitete High-Intensity-Schwelle',
    sessionThresholdTransparencyTitle: 'Schwellen-Transparenz der Session',
    profileThresholdModeLabel: 'Schwellenmodus',
    profileThresholdModeFixed: 'Fix',
    profileThresholdModeAdaptive: 'Adaptiv (Maximum über alle Sessions)',
    profileAdaptiveDataBasisHint: 'Der adaptive Modus nutzt als Datenbasis den aktuellen Maximalwert über alle Sessions.',
    profileThresholdVersion: 'Schwellen-Version',
    profileThresholdUpdatedAt: 'Zuletzt aktualisiert (UTC)',
    profileDefaultSmoothingFilter: 'Standard-Glättungsfilter',
    profileDefaultSmoothingFilterHelp: 'Wird bei neuen Session-Analysen vorausgewählt. Pro Session kannst du weiterhin manuell überschreiben.',
    profilePreferredSpeedUnit: 'Bevorzugte Geschwindigkeitseinheit',
    profilePreferredSpeedUnitHelp: 'Wird als Standard für neue Session-Analysen verwendet. Pro Session kannst du temporär überschreiben, ohne das Profil zu ändern.',
    profilePreferredAggregationWindow: 'Bevorzugtes Aggregationsfenster',
    profilePreferredAggregationWindowHelp: 'Wird als Standard-Aggregationsfenster für neue Session-Analysen verwendet. Pro Session kannst du weiterhin manuell wechseln, ohne das Profil zu ändern.',
    sessionSpeedUnitLabel: 'Geschwindigkeitseinheit',
    sessionSpeedUnitSourceLabel: 'Quelle Geschwindigkeitseinheit',
    speedUnitSourceProfileDefault: 'Profil-Standard',
    speedUnitSourceManualOverride: 'Manuelle Überschreibung',
    speedUnitSourceProfileRecalculation: 'Profil-Rekalibrierung',
    filterSourceLabel: 'Filter-Herkunft',
    filterSourceProfileDefault: 'Profil-Standard',
    filterSourceManualOverride: 'Manuelle Änderung',
    sessionRecalculateButton: 'Mit aktuellem Profil neu berechnen',
    sessionRecalculateSuccess: 'Session wurde mit aktuellen Profileinstellungen neu berechnet.',
    sessionRecalculateProfileInfo: 'Aktiver Profilstand: Schwellen-Version {version} (aktualisiert {thresholdUpdated}), Glättungsfilter {filter} (übernommen {capturedAt}).',
    sessionRecalculateHistoryTitle: 'Neuberechnungsverlauf',
    sessionRecalculateHistoryEmpty: 'Noch keine Neuberechnungen.',
    filterSourceProfileRecalculation: 'Profil-Neuberechnung',
    profileRecalculateAllButton: 'Jetzt alle Sessions neu berechnen',
    profileRecalculateAllTriggered: 'Hintergrund-Neuberechnung gestartet.',
    profileRecalculationStatusTitle: 'Letzte Hintergrund-Neuberechnung',
    profileRecalculationStatusRunning: 'Läuft',
    profileRecalculationStatusCompleted: 'Abgeschlossen',
    profileRecalculationStatusFailed: 'Fehlgeschlagen',
    coreMetricsCategoryTitle: 'Metrik-Kategorien',
    coreMetricsCategoryDescription: 'Trenne externe und interne Belastungsmetriken für eine fokussierte Einordnung. Externe Metriken zeigen, was du auf dem Platz körperlich gemacht hast, interne Metriken zeigen, wie stark dein Körper dafür belastet wurde.',
    coreMetricsCategoryTabAll: 'Alle Metriken',
    coreMetricsCategoryTabExternal: 'Externe Metriken',
    coreMetricsCategoryTabInternal: 'Interne Metriken',
    coreMetricsCategoryExternalTitle: 'Externe Metriken (bewegungsbasiert)',
    coreMetricsCategoryExternalHelp: 'Externe Metriken beschreiben deine sichtbare körperliche Leistung und beantworten: Was habe ich auf dem Platz gemacht? Sie basieren auf Bewegungs- und Geschwindigkeitsdaten, zum Beispiel Distanz, Maximaltempo sowie Beschleunigungs- und Abbremsaktionen. Vereinfacht zeigen diese Werte Laufumfang und Bewegungsintensität – unabhängig davon, wie sich dein Körper dabei intern belastet hat. Eine hohe externe Last bedeutet meist viele intensive Aktionen, sagt aber allein noch nicht, wie gut dein Körper diese Last verkraftet hat.',
    coreMetricsCategoryInternalTitle: 'Interne Metriken (herzfrequenzbasiert)',
    coreMetricsCategoryInternalHelp: 'Interne Metriken beschreiben deine physiologische Reaktion und beantworten: Wie anstrengend war die Einheit für meinen Körper? Sie werden aus Herzfrequenzintensität und Erholungsverhalten abgeleitet, zum Beispiel Zeit in HF-Zonen, TRIMP-Belastung und Herzfrequenz-Erholung. Vereinfacht zeigen diese Werte die innere Herz-Kreislauf-Belastung und die Erholungsqualität – auch dann, wenn die äußere Laufleistung ähnlich war. Ist die interne Last im Verhältnis zur externen Last ungewöhnlich hoch, kann das auf Müdigkeit, Stress, Hitzeeinfluss oder unvollständige Regeneration hindeuten.',
    segmentsTitle: 'Session-Segmente',
    segmentsEmpty: 'Noch keine Segmente vorhanden. Füge die erste Phase hinzu, um die Session zu strukturieren.',
    segmentLabel: 'Label',
    segmentStartSecond: 'Start (s)',
    segmentEndSecond: 'Ende (s)',
    segmentReason: 'Grund (optional)',
    segmentAdd: 'Segment hinzufügen',
    segmentUpdate: 'Segment speichern',
    segmentEdit: 'Bearbeiten',
    segmentDelete: 'Löschen',
    segmentCancelEdit: 'Abbrechen',
    segmentMergeTitle: 'Segmente zusammenführen',
    segmentMergeSource: 'Quellsegment',
    segmentMergeTarget: 'Zielsegment',
    segmentMergeLabel: 'Label nach Merge (optional)',
    segmentMergeAction: 'Zusammenführen',
    segmentHistoryTitle: 'Änderungsverlauf Segmente',
    segmentCreateSuccess: 'Segment erstellt.',
    segmentUpdateSuccess: 'Segment aktualisiert.',
    segmentDeleteSuccess: 'Segment gelöscht.',
    segmentMergeSuccess: 'Segmente zusammengeführt.',
    segmentErrorPrefix: 'Segment-Aktion fehlgeschlagen:',
    segmentValidationRequired: 'Bitte Label, Start und Ende für das Segment eingeben.',
    segmentValidationRange: 'Ende muss größer als Start sein und beide Werte müssen >= 0 sein.',
    segmentValidationMergeSelection: 'Bitte Quell- und Zielsegment für den Merge auswählen.'
  }
};

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
    directionChanges: 'Purpose: captures directional variability. Interpretation: higher value can indicate more stop-and-go movement. Unit: count.',
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
    directionChanges: 'Zweck: erfasst Richtungsvariabilität. Interpretation: höhere Werte können mehr Stop-and-Go anzeigen. Einheit: Anzahl.',
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

function formatHeartRateAverage(value: number | null, locale: Locale, notAvailable: string): string {
  if (value === null) {
    return notAvailable;
  }

  return `${value.toLocaleString(locale, { maximumFractionDigits: 0 })} bpm`;
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

function convertSpeedFromMetersPerSecond(valueMetersPerSecond: number, unit: SpeedUnit): number {
  if (unit === 'km/h') {
    return valueMetersPerSecond * 3.6;
  }

  if (unit === 'min/km') {
    if (valueMetersPerSecond <= 0) {
      return 0;
    }

    return 1000 / (valueMetersPerSecond * 60);
  }

  return valueMetersPerSecond;
}

function convertSpeedToMetersPerSecond(value: number, unit: SpeedUnit): number {
  if (unit === 'km/h') {
    return value / 3.6;
  }

  if (unit === 'min/km') {
    if (value <= 0) {
      return 0;
    }

    return 1000 / (value * 60);
  }

  return value;
}

function formatSpeed(valueMetersPerSecond: number | null, unit: SpeedUnit, notAvailableText: string): string {
  if (valueMetersPerSecond === null) {
    return notAvailableText;
  }

  if (unit === 'km/h') {
    return `${(valueMetersPerSecond * 3.6).toFixed(1)} km/h`;
  }

  if (unit === 'min/km') {
    if (valueMetersPerSecond <= 0) {
      return notAvailableText;
    }

    const minutesPerKilometer = 1000 / (valueMetersPerSecond * 60);
    return `${minutesPerKilometer.toFixed(2)} min/km`;
  }

  return `${valueMetersPerSecond.toFixed(2)} m/s`;
}


function formatNumber(value: number | null, locale: Locale, notAvailable: string, digits = 1): string {
  if (value === null) {
    return notAvailable;
  }

  return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatSignedNumber(value: number, locale: Locale, digits = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
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

function withMetricStatus(value: string, metricKey: string, coreMetrics: FootballCoreMetrics, t: Record<TranslationKey, string>): string {
  const status = formatMetricStatus(metricKey, coreMetrics, t);
  return status ? `${value} — ${status}` : value;
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
    ? (summary.qualityStatus === 'High' ? 'Available' : 'NotUsable')
    : 'NotMeasured';

  const mode: DataAvailability['mode'] = summary.hasGpsData
    ? (hasHeartRateData ? 'Dual' : 'GpsOnly')
    : (hasHeartRateData ? 'HeartRateOnly' : 'NotAvailable');

  return {
    mode,
    gpsStatus,
    gpsReason: gpsStatus === 'NotMeasured'
      ? 'GPS not present in this session.'
      : (gpsStatus === 'NotUsable' ? `GPS unusable because quality is ${summary.qualityStatus}. Required: High.` : null),
    heartRateStatus: hasHeartRateData ? 'Available' : 'NotMeasured',
    heartRateReason: hasHeartRateData ? null : 'Heart-rate data not present in this session.'
  };
}

function normalizeUploadRecord(record: UploadRecord): UploadRecord {
  return {
    ...record,
    segments: record.segments ?? [],
    segmentChangeHistory: record.segmentChangeHistory ?? [],
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

const smoothingFilterOptions: SmoothingFilter[] = ['Raw', 'AdaptiveMedian', 'Savitzky-Golay', 'Butterworth'];

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

export function App() {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSession, setSelectedSession] = useState<UploadRecord | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [compareSelectedSessionIds, setCompareSelectedSessionIds] = useState<string[]>([]);
  const [compareBaselineSessionId, setCompareBaselineSessionId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [message, setMessage] = useState<string>(translations[resolveInitialLocale()].defaultMessage);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>('smoothed');
  const [selectedFilter, setSelectedFilter] = useState<SmoothingFilter>('AdaptiveMedian');
  const [coreMetricsCategoryFilter, setCoreMetricsCategoryFilter] = useState<CoreMetricsCategoryFilter>('all');
  const [aggregationWindowMinutes, setAggregationWindowMinutes] = useState<1 | 2 | 5>(5);
  const [sessionContextForm, setSessionContextForm] = useState<SessionContext>({
    sessionType: 'Training',
    matchResult: null,
    competition: null,
    opponentName: null,
    opponentLogoUrl: null
  });
  const [segmentForm, setSegmentForm] = useState({ label: '', startSecond: '0', endSecond: '300', reason: '' });
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [mergeForm, setMergeForm] = useState({ sourceSegmentId: '', targetSegmentId: '', label: '', reason: '' });
  const [segmentActionError, setSegmentActionError] = useState<string | null>(null);
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
      accelerationThresholdMps2: 2.0,
      decelerationThresholdMps2: -2.0,
      effectiveMaxSpeedMps: 8.0,
      effectiveMaxHeartRateBpm: 190,
      version: 1,
      updatedAtUtc: new Date().toISOString()
    },
    defaultSmoothingFilter: 'AdaptiveMedian',
    preferredSpeedUnit: 'km/h',
    preferredAggregationWindowMinutes: 5
  });
  const [profileValidationMessage, setProfileValidationMessage] = useState<string | null>(null);
  const [latestProfileRecalculationJob, setLatestProfileRecalculationJob] = useState<ProfileRecalculationJob | null>(null);

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
              preferredAggregationWindowMinutes: (profilePayload.preferredAggregationWindowMinutes as 1 | 2 | 5) ?? 5
            });
            setAggregationWindowMinutes((profilePayload.preferredAggregationWindowMinutes as 1 | 2 | 5) ?? 5);
            setLatestProfileRecalculationJob(profilePayload.latestRecalculationJob ?? null);
          }
          const normalizedPayload = payload.map(normalizeUploadRecord);
          setUploadHistory(normalizedPayload);
          if (normalizedPayload.length > 0) {
            setSelectedSession(normalizedPayload[0]);
            setSelectedFilter(normalizedPayload[0].summary.smoothing.selectedStrategy as SmoothingFilter);
            setSessionContextForm(normalizedPayload[0].sessionContext);
            const initialCompareSelection = normalizedPayload.slice(0, 2).map((item) => item.id);
            setCompareSelectedSessionIds(initialCompareSelection);
            setCompareBaselineSessionId(initialCompareSelection[0] ?? null);
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


  function applyUpdatedSession(payload: UploadRecord) {
    setSelectedSession(payload);
    setUploadHistory((previous) => previous.map((item) => (item.id === payload.id ? payload : item)));
    setSelectedFilter(payload.summary.smoothing.selectedStrategy as SmoothingFilter);
    setSessionContextForm(payload.sessionContext);
  }

  function resetSegmentForms() {
    setSegmentForm({ label: '', startSecond: '0', endSecond: '300', reason: '' });
    setEditingSegmentId(null);
    setMergeForm({ sourceSegmentId: '', targetSegmentId: '', label: '', reason: '' });
    setSegmentActionError(null);
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
    setMessage(t.sessionContextSaveSuccess);
  }


  async function onSaveSegment() {
    if (!selectedSession) {
      return;
    }

    setSegmentActionError(null);

    if (!segmentForm.label.trim() || segmentForm.startSecond.trim() === '' || segmentForm.endSecond.trim() === '') {
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
        label: segmentForm.label.trim(),
        startSecond,
        endSecond,
        reason: segmentForm.reason.trim() || null
      }
      : {
        label: segmentForm.label.trim(),
        startSecond,
        endSecond,
        reason: segmentForm.reason.trim() || null
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
    setMessage(editingSegmentId ? t.segmentUpdateSuccess : t.segmentCreateSuccess);
  }

  function onEditSegment(segment: SessionSegment) {
    setEditingSegmentId(segment.id);
    setSegmentForm({
      label: segment.label,
      startSecond: String(segment.startSecond),
      endSecond: String(segment.endSecond),
      reason: ''
    });
  }

  async function onDeleteSegment(segmentId: string) {
    if (!selectedSession) {
      return;
    }

    const reasonQuery = segmentForm.reason.trim() ? `?reason=${encodeURIComponent(segmentForm.reason.trim())}` : '';
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
    setMessage(t.segmentDeleteSuccess);
  }

  async function onMergeSegments() {
    if (!selectedSession) {
      return;
    }

    setSegmentActionError(null);

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
        reason: mergeForm.reason.trim() || null
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
    setMergeForm({ sourceSegmentId: '', targetSegmentId: '', label: '', reason: '' });
    setMessage(t.segmentMergeSuccess);
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
      setAggregationWindowMinutes(profileForm.preferredAggregationWindowMinutes);
      setUploadHistory((previous) => [payload, ...previous.filter((item) => item.id !== payload.id)]);
      setCompareSelectedSessionIds((current) => [payload.id, ...current.filter((item) => item !== payload.id)].slice(0, 4));
      setCompareBaselineSessionId(payload.id);
      setSelectedFile(null);
    } catch {
      setMessage(`${t.uploadFailedPrefix} Network error.`);
    } finally {
      setIsUploading(false);
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
      body: JSON.stringify(profileForm)
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
      preferredAggregationWindowMinutes: payload.preferredAggregationWindowMinutes
    });
    setAggregationWindowMinutes(payload.preferredAggregationWindowMinutes);
    setLatestProfileRecalculationJob(payload.latestRecalculationJob ?? null);
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

  const selectedFilterDescription = t[getFilterDescriptionKey(selectedFilter)];

  const displayedMaxSpeedMps = profileForm.metricThresholds.maxSpeedMode === 'Adaptive'
    ? profileForm.metricThresholds.effectiveMaxSpeedMps
    : profileForm.metricThresholds.maxSpeedMps;

  const displayedMaxHeartRateBpm = profileForm.metricThresholds.maxHeartRateMode === 'Adaptive'
    ? profileForm.metricThresholds.effectiveMaxHeartRateBpm
    : profileForm.metricThresholds.maxHeartRateBpm;

  const sprintThresholdMpsPreview = displayedMaxSpeedMps * (profileForm.metricThresholds.sprintSpeedPercentOfMaxSpeed / 100);
  const highIntensityThresholdMpsPreview = displayedMaxSpeedMps * (profileForm.metricThresholds.highIntensitySpeedPercentOfMaxSpeed / 100);
  const displayedMaxSpeedByPreferredUnit = convertSpeedFromMetersPerSecond(displayedMaxSpeedMps, profileForm.preferredSpeedUnit);

  const compareCandidates = sortedHistory.filter((record) => compareSelectedSessionIds.includes(record.id));
  const compareSessions = compareCandidates.slice(0, 4);
  const compareBaseline = compareSessions.find((session) => session.id === compareBaselineSessionId) ?? compareSessions[0] ?? null;
  const showCompareQualityWarning = compareSessions.length >= 2
    ? new Set(compareSessions.map((record) => record.summary.qualityStatus)).size > 1
    : false;

  useEffect(() => {
    if (compareSessions.length === 0) {
      if (compareBaselineSessionId !== null) {
        setCompareBaselineSessionId(null);
      }
      return;
    }

    const isCurrentBaselineAvailable = compareBaselineSessionId !== null
      && compareSessions.some((session) => session.id === compareBaselineSessionId);

    if (!isCurrentBaselineAvailable) {
      setCompareBaselineSessionId(compareSessions[0].id);
    }
  }, [compareSessions, compareBaselineSessionId]);

  const compareMetrics: CompareMetricDefinition[] = [
    {
      key: 'distance',
      label: t.sessionCompareMetricDistance,
      getter: (record) => record.summary.coreMetrics.distanceMeters,
      formatter: (value, currentLocale, notAvailable) => typeof value === 'number' ? formatDistanceComparison(value, currentLocale, notAvailable) : notAvailable
    },
    {
      key: 'duration',
      label: t.sessionCompareMetricDuration,
      getter: (record) => record.summary.durationSeconds,
      formatter: (value, currentLocale, notAvailable) => typeof value === 'number' ? formatDuration(value, currentLocale, notAvailable) : notAvailable
    },
    {
      key: 'heartRateAverage',
      label: t.sessionCompareMetricHeartRateAverage,
      getter: (record) => record.summary.heartRateAverageBpm,
      formatter: (value, currentLocale, notAvailable) => typeof value === 'number' ? formatHeartRateAverage(value, currentLocale, notAvailable) : notAvailable
    },
    {
      key: 'directionChanges',
      label: t.sessionCompareMetricDirectionChanges,
      getter: (record) => record.summary.smoothing.smoothedDirectionChanges,
      formatter: (value, currentLocale, notAvailable) => typeof value === 'number' ? formatNumber(value, currentLocale, notAvailable, 0) : notAvailable
    },
    {
      key: 'sprintDistance',
      label: t.sessionCompareMetricSprintDistance,
      getter: (record) => record.summary.coreMetrics.sprintDistanceMeters,
      formatter: (value, currentLocale, notAvailable) => typeof value === 'number' ? formatDistanceComparison(value, currentLocale, notAvailable) : notAvailable
    },
    {
      key: 'sprintCount',
      label: t.sessionCompareMetricSprintCount,
      getter: (record) => record.summary.coreMetrics.sprintCount,
      formatter: (value, currentLocale, notAvailable) => typeof value === 'number' ? formatNumber(value, currentLocale, notAvailable, 0) : notAvailable
    },
    {
      key: 'highIntensityTime',
      label: t.sessionCompareMetricHighIntensityTime,
      getter: (record) => record.summary.coreMetrics.highIntensityTimeSeconds,
      formatter: (value, currentLocale, notAvailable) => typeof value === 'number' ? formatDuration(value, currentLocale, notAvailable) : notAvailable
    },
    {
      key: 'trainingLoad',
      label: t.sessionCompareMetricTrainingLoad,
      getter: (record) => record.summary.coreMetrics.trainingImpulseEdwards,
      formatter: (value, currentLocale, notAvailable) => typeof value === 'number' ? formatNumber(value, currentLocale, notAvailable, 1) : notAvailable
    },
    {
      key: 'dataMode',
      label: t.sessionCompareMetricDataMode,
      getter: (record) => resolveDataAvailability(record.summary).mode,
      formatter: (value) => typeof value === 'string' ? dataModeText(value as DataAvailability['mode'], t) : t.notAvailable
    },
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
        formattedValue: metric.formatter(value, locale, t.notAvailable),
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

    const points = selectedSession.summary.gpsTrackpoints ?? [];
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
  }, [selectedSession]);

  const shouldShowGpsHeatmap = selectedSession
    ? ['Dual', 'GpsOnly'].includes(resolveDataAvailability(selectedSession.summary).mode)
    : false;

  const selectedSessionAggregates = useMemo(() => {
    if (!selectedSession) {
      return [];
    }

    return selectedSession.summary.intervalAggregates
      .filter((aggregate) => aggregate.windowMinutes === aggregationWindowMinutes)
      .sort((a, b) => a.windowIndex - b.windowIndex);
  }, [selectedSession, aggregationWindowMinutes]);


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

      <section className="profile-settings">
        <h2>{t.profileSettingsTitle}</h2>
        <form onSubmit={onProfileSubmit}>
          <label htmlFor="profile-primary-position">{t.profilePrimaryPosition}</label>
          <select
            id="profile-primary-position"
            value={profileForm.primaryPosition}
            onChange={(event) => setProfileForm((current) => ({ ...current, primaryPosition: event.target.value as PlayerPosition }))}
          >
            {playerPositions.map((position) => (
              <option key={position} value={position}>{playerPositionLabels[locale][position]}</option>
            ))}
          </select>

          <label htmlFor="profile-secondary-position">{t.profileSecondaryPosition} ({t.profileSecondaryOptional})</label>
          <select
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

          <label htmlFor="profile-default-filter">{t.profileDefaultSmoothingFilter}</label>
          <select
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

          <label htmlFor="profile-preferred-speed-unit">{t.profilePreferredSpeedUnit}</label>
          <select
            id="profile-preferred-speed-unit"
            value={profileForm.preferredSpeedUnit}
            onChange={(event) => setProfileForm((current) => ({ ...current, preferredSpeedUnit: event.target.value as SpeedUnit }))}
          >
            <option value="km/h">km/h</option>
            <option value="m/s">m/s</option>
            <option value="min/km">min/km</option>
          </select>
          <p>{t.profilePreferredSpeedUnitHelp}</p>

          <label htmlFor="profile-preferred-aggregation-window">{t.profilePreferredAggregationWindow}</label>
          <select
            id="profile-preferred-aggregation-window"
            value={profileForm.preferredAggregationWindowMinutes}
            onChange={(event) => setProfileForm((current) => ({ ...current, preferredAggregationWindowMinutes: Number(event.target.value) as 1 | 2 | 5 }))}
          >
            <option value={1}>{t.intervalAggregationWindow1}</option>
            <option value={2}>{t.intervalAggregationWindow2}</option>
            <option value={5}>{t.intervalAggregationWindow5}</option>
          </select>
          <p>{t.profilePreferredAggregationWindowHelp}</p>

          <h3>{t.profileThresholdsTitle}</h3>
          <label htmlFor="profile-threshold-max-speed">Max speed ({profileForm.preferredSpeedUnit})</label>
          <input
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
          <label htmlFor="profile-threshold-sprint-mode">{t.profileThresholdMaxSpeedMode}</label>
          <select
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

          <label htmlFor="profile-threshold-max-heartrate">Max heartrate (bpm)</label>
          <input
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
          <label htmlFor="profile-threshold-high-intensity-mode">{t.profileThresholdMaxHeartRateMode}</label>
          <select
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

          <label htmlFor="profile-threshold-sprint">{t.profileThresholdSprint}</label>
          <input
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
          <label htmlFor="profile-threshold-high-intensity">{t.profileThresholdHighIntensity}</label>
          <input
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
          <label htmlFor="profile-threshold-acceleration">{t.profileThresholdAcceleration}</label>
          <input
            id="profile-threshold-acceleration"
            type="number"
            step="0.1"
            value={profileForm.metricThresholds.accelerationThresholdMps2}
            onChange={(event) => setProfileForm((current) => ({
              ...current,
              metricThresholds: { ...current.metricThresholds, accelerationThresholdMps2: Number(event.target.value) }
            }))}
          />
          <label htmlFor="profile-threshold-deceleration">{t.profileThresholdDeceleration}</label>
          <input
            id="profile-threshold-deceleration"
            type="number"
            step="0.1"
            value={profileForm.metricThresholds.decelerationThresholdMps2}
            onChange={(event) => setProfileForm((current) => ({
              ...current,
              metricThresholds: { ...current.metricThresholds, decelerationThresholdMps2: Number(event.target.value) }
            }))}
          />
          <p>{t.profileEffectiveMaxSpeed}: {formatSpeed(profileForm.metricThresholds.effectiveMaxSpeedMps, profileForm.preferredSpeedUnit, t.notAvailable)} ({profileForm.metricThresholds.maxSpeedMode})</p>
          <p>{t.profileEffectiveMaxHeartRate}: {profileForm.metricThresholds.effectiveMaxHeartRateBpm} bpm ({profileForm.metricThresholds.maxHeartRateMode})</p>
          <p>{t.profileAdaptiveDataBasisHint}</p>

          <p>{t.profileThresholdVersion}: {profileForm.metricThresholds.version}</p>
          <p>{t.profileThresholdUpdatedAt}: {formatUtcDateTime(profileForm.metricThresholds.updatedAtUtc, locale, t.notAvailable)}</p>

          <button type="submit">{t.profileSave}</button>
          <button type="button" onClick={onTriggerProfileRecalculation}>{t.profileRecalculateAllButton}</button>
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
      </section>
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
                <th>{t.historyColumnSessionType}</th>
                <th>{t.historyColumnDataMode}</th>
                <th>{t.historySelectForComparison}</th>
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
                  <td>{sessionTypeText(record.sessionContext.sessionType, t)}</td>
                  <td>{dataModeText(resolveDataAvailability(record.summary).mode, t)}</td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${t.historySelectForComparison}: ${record.fileName}`}
                      checked={compareSelectedSessionIds.includes(record.id)}
                      onChange={(event) => {
                        setCompareSelectedSessionIds((current) => {
                          if (event.target.checked) {
                            return [...current, record.id].slice(-4);
                          }

                          return current.filter((item) => item !== record.id);
                        });
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setSelectedSession(record);
                        setCompareMode('smoothed');
                        setSelectedFilter(record.summary.smoothing.selectedStrategy as SmoothingFilter);
                        setSessionContextForm(record.sessionContext);
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

      <section className="session-compare" aria-live="polite">
        <h2>{t.sessionCompareTitle}</h2>
        <p>{t.sessionCompareHint}</p>
        {compareSessions.length >= 2 && (
          <div className="baseline-selector">
            <label htmlFor="comparison-baseline-selector">{t.sessionCompareBaselineLabel}</label>
            <select
              id="comparison-baseline-selector"
              value={compareBaseline?.id ?? ''}
              onChange={(event) => setCompareBaselineSessionId(event.target.value)}
            >
              {compareSessions.map((session) => (
                <option key={session.id} value={session.id}>{session.fileName}</option>
              ))}
            </select>
            <p>{t.sessionCompareBaselineHint}</p>
          </div>
        )}
        {showCompareQualityWarning && <p className="quality-warning">{t.sessionCompareQualityWarning}</p>}
        {compareSessions.length < 2 ? (
          <p>{t.sessionCompareHint}</p>
        ) : (
          <table className="history-table comparison-table">
            <thead>
              <tr>
                <th>{t.compareTitle}</th>
                {compareSessions.map((session) => (
                  <th key={session.id}>{session.fileName}{compareBaseline?.id === session.id ? ' (baseline)' : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t.metricQualityStatus}</td>
                {compareSessions.map((session) => (
                  <td key={`${session.id}-quality`}>{qualityStatusText(session.summary.qualityStatus, t)}</td>
                ))}
              </tr>
              {comparisonRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}-${compareSessions[index].id}`}>
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

      {selectedSession && (
        <section className="session-details" aria-live="polite">
          <h2>{t.summaryTitle}</h2>
          <button type="button" onClick={onRecalculateWithCurrentProfile}>{t.sessionRecalculateButton}</button>
          <p>{interpolate(t.sessionRecalculateProfileInfo, { version: String(selectedSession.appliedProfileSnapshot.thresholdVersion), thresholdUpdated: formatLocalDateTime(selectedSession.appliedProfileSnapshot.thresholdUpdatedAtUtc), filter: selectedSession.appliedProfileSnapshot.smoothingFilter, capturedAt: formatLocalDateTime(selectedSession.appliedProfileSnapshot.capturedAtUtc) })}</p>
          <h3>{t.sessionRecalculateHistoryTitle}</h3>
          {selectedSession.recalculationHistory.length === 0 ? <p>{t.sessionRecalculateHistoryEmpty}</p> : <ul className="metrics-list">{selectedSession.recalculationHistory.map((entry) => <li key={entry.recalculatedAtUtc}>{formatLocalDateTime(entry.recalculatedAtUtc)}: v{entry.previousProfile.thresholdVersion} → v{entry.newProfile.thresholdVersion}</li>)}</ul>}
          <p><strong>{t.historyColumnFileName}:</strong> {selectedSession.fileName}</p>
          <div className="session-context">
            <h3>{t.sessionContextTitle}</h3>
            <label htmlFor="session-type-selector">{t.sessionTypeLabel}</label>
            <select
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
                <label htmlFor="session-match-result">{t.sessionContextMatchResult}</label>
                <input id="session-match-result" value={sessionContextForm.matchResult ?? ''} onChange={(event) => setSessionContextForm((current) => ({ ...current, matchResult: event.target.value }))} />
                <label htmlFor="session-competition">{t.sessionContextCompetition}</label>
                <input id="session-competition" value={sessionContextForm.competition ?? ''} onChange={(event) => setSessionContextForm((current) => ({ ...current, competition: event.target.value }))} />
                <label htmlFor="session-opponent">{t.sessionContextOpponentName}</label>
                <input id="session-opponent" value={sessionContextForm.opponentName ?? ''} onChange={(event) => setSessionContextForm((current) => ({ ...current, opponentName: event.target.value }))} />
                <label htmlFor="session-opponent-logo">{t.sessionContextOpponentLogoUrl}</label>
                <input id="session-opponent-logo" value={sessionContextForm.opponentLogoUrl ?? ''} onChange={(event) => setSessionContextForm((current) => ({ ...current, opponentLogoUrl: event.target.value }))} />
              </>
            )}
            <button type="button" onClick={onSaveSessionContext}>{t.sessionContextSave}</button>
          </div>
          <div className="segment-management">
            <h3>{t.segmentsTitle}</h3>
            {segmentActionError && <p className="segment-error" role="alert">{segmentActionError}</p>}
            {selectedSession.segments.length === 0 ? (
              <p>{t.segmentsEmpty}</p>
            ) : (
              <table className="history-table segment-table">
                <thead>
                  <tr>
                    <th>{t.segmentLabel}</th>
                    <th>{t.segmentStartSecond}</th>
                    <th>{t.segmentEndSecond}</th>
                    <th>{t.historyOpenDetails}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSession.segments.map((segment) => (
                    <tr key={segment.id}>
                      <td>{segment.label}</td>
                      <td>{segment.startSecond}</td>
                      <td>{segment.endSecond}</td>
                      <td>
                        <button type="button" className="secondary-button" onClick={() => onEditSegment(segment)}>{t.segmentEdit}</button>
                        <button type="button" onClick={() => onDeleteSegment(segment.id)}>{t.segmentDelete}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="segment-form">
              <label htmlFor="segment-label">{t.segmentLabel}</label>
              <input id="segment-label" value={segmentForm.label} onChange={(event) => setSegmentForm((current) => ({ ...current, label: event.target.value }))} />
              <label htmlFor="segment-start">{t.segmentStartSecond}</label>
              <input id="segment-start" type="number" min={0} value={segmentForm.startSecond} onChange={(event) => setSegmentForm((current) => ({ ...current, startSecond: event.target.value }))} />
              <label htmlFor="segment-end">{t.segmentEndSecond}</label>
              <input id="segment-end" type="number" min={0} value={segmentForm.endSecond} onChange={(event) => setSegmentForm((current) => ({ ...current, endSecond: event.target.value }))} />
              <label htmlFor="segment-reason">{t.segmentReason}</label>
              <input id="segment-reason" value={segmentForm.reason} onChange={(event) => setSegmentForm((current) => ({ ...current, reason: event.target.value }))} />
              <div className="segment-actions">
                <button type="button" onClick={onSaveSegment}>{editingSegmentId ? t.segmentUpdate : t.segmentAdd}</button>
                {editingSegmentId && <button type="button" className="secondary-button" onClick={resetSegmentForms}>{t.segmentCancelEdit}</button>}
              </div>
            </div>

            <div className="segment-form">
              <h4>{t.segmentMergeTitle}</h4>
              <label htmlFor="merge-source">{t.segmentMergeSource}</label>
              <select id="merge-source" value={mergeForm.sourceSegmentId} onChange={(event) => setMergeForm((current) => ({ ...current, sourceSegmentId: event.target.value }))}>
                <option value="">--</option>
                {selectedSession.segments.map((segment) => <option key={`source-${segment.id}`} value={segment.id}>{segment.label}</option>)}
              </select>
              <label htmlFor="merge-target">{t.segmentMergeTarget}</label>
              <select id="merge-target" value={mergeForm.targetSegmentId} onChange={(event) => setMergeForm((current) => ({ ...current, targetSegmentId: event.target.value }))}>
                <option value="">--</option>
                {selectedSession.segments.map((segment) => <option key={`target-${segment.id}`} value={segment.id}>{segment.label}</option>)}
              </select>
              <label htmlFor="merge-label">{t.segmentMergeLabel}</label>
              <input id="merge-label" value={mergeForm.label} onChange={(event) => setMergeForm((current) => ({ ...current, label: event.target.value }))} />
              <label htmlFor="merge-reason">{t.segmentReason}</label>
              <input id="merge-reason" value={mergeForm.reason} onChange={(event) => setMergeForm((current) => ({ ...current, reason: event.target.value }))} />
              <button type="button" onClick={onMergeSegments}>{t.segmentMergeAction}</button>
            </div>

            <h4>{t.segmentHistoryTitle}</h4>
            {selectedSession.segmentChangeHistory.length === 0 ? (
              <p>{t.historyEmpty}</p>
            ) : (
              <ul className="metrics-list">
                {selectedSession.segmentChangeHistory.map((entry) => (
                  <li key={`${entry.version}-${entry.changedAtUtc}`}>v{entry.version} • {entry.action} • {formatLocalDateTime(entry.changedAtUtc)}{entry.reason ? ` • ${entry.reason}` : ''}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="comparison-controls">
            <h3>{t.compareTitle}</h3>
            <label htmlFor="session-filter-selector">{t.filterSelectLabel}</label>
            <select
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
            <MetricListItem label={t.metricTrackpoints} value={selectedSession.summary.trackpointCount} helpText={`${metricHelp.trackpoints} ${t.metricHelpTrackpoints}`} />
            <MetricListItem label={t.metricDistance} value={`${formatDistanceComparison(activeDistanceMeters, locale, t.notAvailable)} — ${distanceSourceText(selectedSession.summary.distanceSource)}`} helpText={`${metricHelp.distance} ${t.metricHelpDistance}`} />
            <MetricListItem label={t.metricGps} value={selectedSession.summary.hasGpsData ? t.yes : t.no} helpText={`${metricHelp.gps} ${t.metricHelpGps}`} />
            <MetricListItem label={t.metricQualityStatus} value={qualityStatusText(selectedSession.summary.qualityStatus, t)} helpText={metricHelp.qualityStatus} />
            <MetricListItem label={t.metricQualityReasons} value={selectedSession.summary.qualityReasons.join(' | ')} helpText={metricHelp.qualityReasons} />
            <MetricListItem label={t.metricDataMode} value={dataAvailabilitySummaryText(selectedSession.summary, t)} helpText={t.metricDataMode} />
            <MetricListItem label={t.metricDataChange} value={dataChangeMetric} helpText={metricHelp.dataChange} />
            <MetricListItem label={t.filterSourceLabel} value={selectedSession.selectedSmoothingFilterSource === 'ManualOverride' ? t.filterSourceManualOverride : selectedSession.selectedSmoothingFilterSource === 'ProfileRecalculation' ? t.filterSourceProfileRecalculation : t.filterSourceProfileDefault} />
            <label htmlFor="session-speed-unit">{t.sessionSpeedUnitLabel}</label>
            <select id="session-speed-unit" value={selectedSession.selectedSpeedUnit} onChange={onSpeedUnitChange}>
              <option value="km/h">km/h</option>
              <option value="m/s">m/s</option>
              <option value="min/km">min/km</option>
            </select>
            <MetricListItem label={t.sessionSpeedUnitSourceLabel} value={selectedSession.selectedSpeedUnitSource === 'ManualOverride' ? t.speedUnitSourceManualOverride : selectedSession.selectedSpeedUnitSource === 'ProfileRecalculation' ? t.speedUnitSourceProfileRecalculation : t.speedUnitSourceProfileDefault} />
            <MetricListItem label={t.metricSmoothingStrategy} value={selectedSession.summary.smoothing.selectedStrategy} helpText={metricHelp.smoothingStrategy} />
            <MetricListItem label={t.metricSmoothingOutlier} value={`${selectedSession.summary.smoothing.selectedParameters.OutlierDetectionMode ?? 'NotAvailable'} (threshold: ${selectedSession.summary.smoothing.selectedParameters.EffectiveOutlierSpeedThresholdMps ?? '12.5'} m/s)`} helpText={metricHelp.smoothingOutlier} />
          </ul>
          <div className="core-metrics-section">
            <h3>{t.coreMetricsTitle}</h3>
            {!selectedSession.summary.coreMetrics.isAvailable && (
              <p>{t.coreMetricsUnavailable.replace('{reason}', selectedSession.summary.coreMetrics.unavailableReason ?? t.notAvailable)}</p>
            )}
            <div className="core-metrics-filter" role="tablist" aria-label={t.coreMetricsCategoryTitle}>
              <button type="button" role="tab" aria-selected={coreMetricsCategoryFilter === 'all'} className={coreMetricsCategoryFilter === 'all' ? 'tab-button tab-button--active' : 'tab-button'} onClick={() => setCoreMetricsCategoryFilter('all')}>
                {t.coreMetricsCategoryTabAll}
              </button>
              <button type="button" role="tab" aria-selected={coreMetricsCategoryFilter === 'external'} className={coreMetricsCategoryFilter === 'external' ? 'tab-button tab-button--active' : 'tab-button'} onClick={() => setCoreMetricsCategoryFilter('external')}>
                {t.coreMetricsCategoryTabExternal}
              </button>
              <button type="button" role="tab" aria-selected={coreMetricsCategoryFilter === 'internal'} className={coreMetricsCategoryFilter === 'internal' ? 'tab-button tab-button--active' : 'tab-button'} onClick={() => setCoreMetricsCategoryFilter('internal')}>
                {t.coreMetricsCategoryTabInternal}
              </button>
            </div>
            <p>{t.coreMetricsCategoryDescription}</p>
            {(coreMetricsCategoryFilter === 'all' || coreMetricsCategoryFilter === 'external') && (
              <div>
                <h4>{t.coreMetricsCategoryExternalTitle}</h4>
                <p>{t.coreMetricsCategoryExternalHelp}</p>
                <ul className="metrics-list">
                  <MetricListItem label={t.metricDistance} value={withMetricStatus(formatDistanceComparison(selectedSession.summary.coreMetrics.distanceMeters, locale, t.notAvailable), 'distanceMeters', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.distance} />
                  <MetricListItem label={t.metricDuration} value={withMetricStatus(formatDuration(selectedSession.summary.durationSeconds, locale, t.notAvailable), 'durationSeconds', selectedSession.summary.coreMetrics, t)} helpText={`${metricHelp.duration} ${t.metricHelpDuration}`} />
                  <MetricListItem label={t.metricDirectionChanges} value={withMetricStatus(formatNumber(activeDirectionChanges, locale, t.notAvailable, 0), 'directionChanges', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.directionChanges} />
                  <MetricListItem label={t.metricSprintDistance} value={withMetricStatus(formatDistanceComparison(selectedSession.summary.coreMetrics.sprintDistanceMeters, locale, t.notAvailable), 'sprintDistanceMeters', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.sprintDistance} />
                  <MetricListItem label={t.metricSprintCount} value={withMetricStatus(String(selectedSession.summary.coreMetrics.sprintCount ?? t.notAvailable), 'sprintCount', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.sprintCount} />
                  <MetricListItem label={t.metricMaxSpeed} value={withMetricStatus(formatSpeed(selectedSession.summary.coreMetrics.maxSpeedMetersPerSecond, selectedSession.selectedSpeedUnit, t.notAvailable), 'maxSpeedMetersPerSecond', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.maxSpeed} />
                  <MetricListItem label={t.metricHighIntensityTime} value={withMetricStatus(formatDuration(selectedSession.summary.coreMetrics.highIntensityTimeSeconds, locale, t.notAvailable), 'highIntensityTimeSeconds', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.highIntensityTime} />
                  <MetricListItem label={t.metricHighIntensityRunCount} value={withMetricStatus(String(selectedSession.summary.coreMetrics.highIntensityRunCount ?? t.notAvailable), 'highIntensityRunCount', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.highIntensityRunCount} />
                  <MetricListItem label={t.metricHighSpeedDistance} value={withMetricStatus(formatDistanceComparison(selectedSession.summary.coreMetrics.highSpeedDistanceMeters, locale, t.notAvailable), 'highSpeedDistanceMeters', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.highSpeedDistance} />
                  <MetricListItem label={t.metricRunningDensity} value={withMetricStatus(formatNumber(selectedSession.summary.coreMetrics.runningDensityMetersPerMinute, locale, t.notAvailable, 2), 'runningDensityMetersPerMinute', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.runningDensity} />
                  <MetricListItem label={t.metricAccelerationCount} value={withMetricStatus(String(selectedSession.summary.coreMetrics.accelerationCount ?? t.notAvailable), 'accelerationCount', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.accelerationCount} />
                  <MetricListItem label={t.metricDecelerationCount} value={withMetricStatus(String(selectedSession.summary.coreMetrics.decelerationCount ?? t.notAvailable), 'decelerationCount', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.decelerationCount} />
                </ul>
              </div>
            )}
            {(coreMetricsCategoryFilter === 'all' || coreMetricsCategoryFilter === 'internal') && (
              <div>
                <h4>{t.coreMetricsCategoryInternalTitle}</h4>
                <p>{t.coreMetricsCategoryInternalHelp}</p>
                <ul className="metrics-list">
                  <MetricListItem label={t.metricHeartRate} value={withMetricStatus(formatHeartRate(selectedSession.summary, t.notAvailable), 'heartRateMinAvgMaxBpm', selectedSession.summary.coreMetrics, t)} helpText={`${metricHelp.heartRate} ${t.metricHelpHeartRate}`} />
                  <MetricListItem label={t.metricHrZoneLow} value={withMetricStatus(formatDuration(selectedSession.summary.coreMetrics.heartRateZoneLowSeconds, locale, t.notAvailable), 'heartRateZoneLowSeconds', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.hrZoneLow} />
                  <MetricListItem label={t.metricHrZoneMedium} value={withMetricStatus(formatDuration(selectedSession.summary.coreMetrics.heartRateZoneMediumSeconds, locale, t.notAvailable), 'heartRateZoneMediumSeconds', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.hrZoneMedium} />
                  <MetricListItem label={t.metricHrZoneHigh} value={withMetricStatus(formatDuration(selectedSession.summary.coreMetrics.heartRateZoneHighSeconds, locale, t.notAvailable), 'heartRateZoneHighSeconds', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.hrZoneHigh} />
                  <MetricListItem label={t.metricTrimpEdwards} value={withMetricStatus(formatNumber(selectedSession.summary.coreMetrics.trainingImpulseEdwards, locale, t.notAvailable, 1), 'trainingImpulseEdwards', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.trimpEdwards} />
                  <MetricListItem label={t.metricTrimpPerMinute} value={formatNumber(trimpPerMinute(selectedSession.summary), locale, t.notAvailable, 2)} helpText={metricHelp.trimpEdwards} />
                  <MetricListItem label={t.metricHrRecovery60} value={withMetricStatus(String(selectedSession.summary.coreMetrics.heartRateRecoveryAfter60Seconds ?? t.notAvailable), 'heartRateRecoveryAfter60Seconds', selectedSession.summary.coreMetrics, t)} helpText={metricHelp.hrRecovery60} />
                </ul>
              </div>
            )}
            <ul className="metrics-list">
              <MetricListItem label={t.metricCoreThresholds} value={formatThresholds(selectedSession.summary.coreMetrics.thresholds)} helpText={metricHelp.coreThresholds} />
              <MetricListItem label={t.sessionThresholdTransparencyTitle} value={['MaxSpeedBase=' + (selectedSession.summary.coreMetrics.thresholds.MaxSpeedEffectiveMps ?? t.notAvailable) + ' m/s (' + (selectedSession.summary.coreMetrics.thresholds.MaxSpeedSource ?? t.notAvailable) + ')', 'MaxHeartRateBase=' + (selectedSession.summary.coreMetrics.thresholds.MaxHeartRateEffectiveBpm ?? t.notAvailable) + ' bpm (' + (selectedSession.summary.coreMetrics.thresholds.MaxHeartRateSource ?? t.notAvailable) + ')', 'Sprint=' + (selectedSession.summary.coreMetrics.thresholds.SprintSpeedPercentOfMaxSpeed ?? t.notAvailable) + '% → ' + (selectedSession.summary.coreMetrics.thresholds.SprintSpeedThresholdMps ?? t.notAvailable) + ' m/s', 'HighIntensity=' + (selectedSession.summary.coreMetrics.thresholds.HighIntensitySpeedPercentOfMaxSpeed ?? t.notAvailable) + '% → ' + (selectedSession.summary.coreMetrics.thresholds.HighIntensitySpeedThresholdMps ?? t.notAvailable) + ' m/s'].join(' | ')} helpText={metricHelp.coreThresholds} />
            </ul>
          </div>
          <div className="interval-aggregation">
            <h3>{t.intervalAggregationTitle}</h3>
            <p>{t.intervalAggregationExplanation}</p>
            <label htmlFor="interval-window-selector">{t.intervalAggregationWindowLabel}</label>
            <select
              id="interval-window-selector"
              value={aggregationWindowMinutes}
              onChange={(event) => setAggregationWindowMinutes(Number(event.target.value) as 1 | 2 | 5)}
            >
              <option value={1}>{t.intervalAggregationWindow1}</option>
              <option value={2}>{t.intervalAggregationWindow2}</option>
              <option value={5}>{t.intervalAggregationWindow5}</option>
            </select>
            <p>{interpolate(t.intervalAggregationWindowCount, { count: selectedSessionAggregates.length.toString() })}</p>
            {selectedSessionAggregates.length === 0 ? (
              <p>{t.intervalAggregationNoData}</p>
            ) : (
              <table className="history-table interval-table">
                <thead>
                  <tr>
                    <th>{t.intervalAggregationStart}</th>
                    <th>{t.intervalAggregationCoreMetrics}</th>
                    <th>{t.intervalAggregationDuration}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSessionAggregates.map((aggregate) => (
                    <tr key={`${aggregate.windowMinutes}-${aggregate.windowIndex}`}>
                      <td>{formatLocalDateTime(aggregate.windowStartUtc)}</td>
                      <td>
                        <ul className="metrics-list interval-core-metrics-list">
                          <li><strong>{t.metricDistance}:</strong> {formatDistanceComparison(aggregate.coreMetrics.distanceMeters, locale, t.notAvailable)}</li>
                          <li><strong>{t.metricSprintDistance}:</strong> {formatDistanceComparison(aggregate.coreMetrics.sprintDistanceMeters, locale, t.notAvailable)}</li>
                          <li><strong>{t.metricSprintCount}:</strong> {aggregate.coreMetrics.sprintCount ?? t.notAvailable}</li>
                          <li><strong>{t.metricMaxSpeed}:</strong> {formatSpeed(aggregate.coreMetrics.maxSpeedMetersPerSecond, selectedSession.selectedSpeedUnit, t.notAvailable)}</li>
                          <li><strong>{t.metricHighIntensityTime}:</strong> {formatDuration(aggregate.coreMetrics.highIntensityTimeSeconds, locale, t.notAvailable)}</li>
                          <li><strong>{t.metricHighIntensityRunCount}:</strong> {aggregate.coreMetrics.highIntensityRunCount ?? t.notAvailable}</li>
                          <li><strong>{t.metricHighSpeedDistance}:</strong> {formatDistanceComparison(aggregate.coreMetrics.highSpeedDistanceMeters, locale, t.notAvailable)}</li>
                          <li><strong>{t.metricRunningDensity}:</strong> {formatNumber(aggregate.coreMetrics.runningDensityMetersPerMinute, locale, t.notAvailable, 2)}</li>
                          <li><strong>{t.metricAccelerationCount}:</strong> {aggregate.coreMetrics.accelerationCount ?? t.notAvailable}</li>
                          <li><strong>{t.metricDecelerationCount}:</strong> {aggregate.coreMetrics.decelerationCount ?? t.notAvailable}</li>
                          <li><strong>{t.metricHrZoneLow}:</strong> {formatDuration(aggregate.coreMetrics.heartRateZoneLowSeconds, locale, t.notAvailable)}</li>
                          <li><strong>{t.metricHrZoneMedium}:</strong> {formatDuration(aggregate.coreMetrics.heartRateZoneMediumSeconds, locale, t.notAvailable)}</li>
                          <li><strong>{t.metricHrZoneHigh}:</strong> {formatDuration(aggregate.coreMetrics.heartRateZoneHighSeconds, locale, t.notAvailable)}</li>
                          <li><strong>{t.metricTrimpEdwards}:</strong> {formatNumber(aggregate.coreMetrics.trainingImpulseEdwards, locale, t.notAvailable, 1)}</li>
                          <li><strong>{t.metricHrRecovery60}:</strong> {aggregate.coreMetrics.heartRateRecoveryAfter60Seconds ?? t.notAvailable}</li>
                        </ul>
                      </td>
                      <td>{formatDuration(aggregate.windowDurationSeconds, locale, t.notAvailable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {shouldShowGpsHeatmap && (
            <div className="gps-heatmap-section">
              <h3>{t.gpsHeatmapTitle}</h3>
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
                  sessionId={selectedSession.id}
                />
              ) : (
                <p>{t.gpsHeatmapNoDataHint}</p>
              )}
            </div>
          )}

          {resolveDataAvailability(selectedSession.summary).mode === 'HeartRateOnly' && (
            <div className="detail-hints" role="note" aria-label={t.hfOnlyInsightTitle}>
              <p><strong>{t.hfOnlyInsightTitle}:</strong> {t.hfOnlyInsightInterpretation}</p>
            </div>
          )}

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
}function formatUtcDateTime(value: string | null | undefined, locale: Locale, fallback: string): string {
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
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  zoomInLabel: string;
  zoomOutLabel: string;
  zoomResetLabel: string;
  sessionId: string;
};

type HeatmapLayerProps = {
  width: number;
  height: number;
  satelliteImageUrl: string;
  densityCells: Array<{ x: number; y: number; value: number }>;
  screenPoints: Array<{ x: number; y: number }>;
  shouldRenderPointMarkers: boolean;
  colorForDensity: (value: number) => string;
};

const HeatmapLayer = memo(function HeatmapLayer({ width, height, satelliteImageUrl, densityCells, screenPoints, shouldRenderPointMarkers, colorForDensity }: HeatmapLayerProps) {
  return (
    <>
      <image href={satelliteImageUrl} x="0" y="0" width={width} height={height} preserveAspectRatio="none" className="gps-heatmap__satellite" />
      <rect x="0" y="0" width={width} height={height} rx="8" ry="8" className="gps-heatmap__overlay" />
      {densityCells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width="8"
          height="8"
          fill={colorForDensity(cell.value)}
          className="gps-heatmap__cell"
        />
      ))}
      {shouldRenderPointMarkers ? screenPoints.map((point, index) => (
        <circle
          key={`point-${index}`}
          cx={point.x}
          cy={point.y}
          r="1.1"
          className="gps-heatmap__point-marker"
        />
      )) : null}
    </>
  );
});

function GpsPointHeatmap({ points, minLatitude, maxLatitude, minLongitude, maxLongitude, zoomInLabel, zoomOutLabel, zoomResetLabel, sessionId }: GpsPointHeatmapProps) {
  const width = 560;
  const height = 320;
  const earthRadiusMeters = 6378137;

  const toWebMercator = (latitude: number, longitude: number) => {
    const normalizedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    const x = earthRadiusMeters * (longitude * Math.PI / 180);
    const y = earthRadiusMeters * Math.log(Math.tan(Math.PI / 4 + (normalizedLatitude * Math.PI / 180) / 2));
    return { x, y };
  };

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
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const screenPoints = useMemo(() => projectedPoints.map((point) => ({
    x: Math.min(width, Math.max(0, ((point.x - centerX) / metersPerPixel) + (width / 2))),
    y: Math.min(height, Math.max(0, (height / 2) - ((point.y - centerY) / metersPerPixel)))
  })), [projectedPoints, centerX, centerY, metersPerPixel]);

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
          const weight = Math.exp(-(distance ** 2) / (2 * (Math.max(1.8, influenceRadius / 2.2) ** 2)));
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

  const shouldRenderPointMarkers = points.length <= 320;

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

  return (
    <>
      <div className="gps-heatmap-controls" role="group" aria-label="Heatmap controls">
        <button type="button" onClick={() => adjustZoom(-0.2)}>{zoomOutLabel}</button>
        <button type="button" onClick={() => adjustZoom(0.2)}>{zoomInLabel}</button>
        <button type="button" onClick={() => { setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }}>{zoomResetLabel}</button>
      </div>
      <svg className={`gps-heatmap ${dragStart ? 'gps-heatmap--dragging' : ''}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="GPS point heatmap" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onPointerLeave={onPointerEnd}>
        <rect x="0" y="0" width={width} height={height} rx="8" ry="8" className="gps-heatmap__background" />
        <g transform={`translate(${centerTranslateX} ${centerTranslateY}) scale(${zoomScale}) translate(${-width / 2} ${-height / 2})`}>
          <HeatmapLayer width={width} height={height} satelliteImageUrl={satelliteImageUrl} densityCells={densityCells} screenPoints={screenPoints} shouldRenderPointMarkers={shouldRenderPointMarkers} colorForDensity={colorForDensity} />
        </g>
      </svg>
    </>
  );
}
