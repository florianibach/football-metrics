import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function createSummary() {
  return {
    activityStartTimeUtc: '2026-02-16T21:00:00.000Z',
    durationSeconds: 300,
    trackpointCount: 1,
    heartRateMinBpm: 120,
    heartRateAverageBpm: 150,
    heartRateMaxBpm: 175,
    distanceMeters: 1000,
    hasGpsData: true,
    fileDistanceMeters: 1000,
    distanceSource: 'CalculatedFromGps',
    qualityStatus: 'High',
    qualityReasons: [],
    dataAvailability: { mode: 'Dual', gpsStatus: 'Available', gpsReason: null, heartRateStatus: 'Available', heartRateReason: null },
    gpsTrackpoints: [{ latitude: 50.9, longitude: 6.9, elapsedSeconds: 0 }],
    smoothing: {
      selectedStrategy: 'AdaptiveMedian',
      selectedParameters: {},
      rawDistanceMeters: 1000,
      smoothedDistanceMeters: 980,
      rawDirectionChanges: 4,
      baselineDirectionChanges: 2,
      smoothedDirectionChanges: 3,
      correctedOutlierCount: 0,
      analyzedAtUtc: '2026-02-16T22:00:00.000Z'
    },
    coreMetrics: {
      isAvailable: true,
      unavailableReason: null,
      distanceMeters: 1000,
      sprintDistanceMeters: 120,
      sprintCount: 2,
      maxSpeedMetersPerSecond: 8.2,
      highIntensityTimeSeconds: 60,
      highIntensityRunCount: 3,
      highSpeedDistanceMeters: 200,
      runningDensityMetersPerMinute: 45,
      accelerationCount: 10,
      decelerationCount: 9,
      heartRateZoneLowSeconds: 70,
      heartRateZoneMediumSeconds: 100,
      heartRateZoneHighSeconds: 80,
      trainingImpulseEdwards: 14,
      heartRateRecoveryAfter60Seconds: 24,
      metricAvailability: {},
      thresholds: {}
    },
    intervalAggregates: []
  };
}

function createUploadRecord() {
  return {
    id: 'upload-1',
    fileName: 'session.tcx',
    uploadedAtUtc: '2026-02-16T22:00:00.000Z',
    summary: createSummary(),
    sessionContext: {
      sessionType: 'Training',
      matchResult: null,
      competition: null,
      opponentName: null,
      opponentLogoUrl: null
    },
    selectedSmoothingFilterSource: 'ProfileDefault',
    selectedSpeedUnitSource: 'ProfileDefault',
    selectedSpeedUnit: 'km/h',
    appliedProfileSnapshot: {
      thresholdVersion: 1,
      thresholdUpdatedAtUtc: '2026-02-16T22:00:00.000Z',
      smoothingFilter: 'AdaptiveMedian',
      capturedAtUtc: '2026-02-16T22:00:00.000Z'
    },
    recalculationHistory: [],
    segments: [],
    segmentChangeHistory: []
  };
}

function createProfile() {
  return {
    primaryPosition: 'CentralMidfielder',
    secondaryPosition: null,
    metricThresholds: {
      maxSpeedMps: 8,
      maxSpeedMode: 'Adaptive',
      maxHeartRateBpm: 190,
      maxHeartRateMode: 'Adaptive',
      sprintSpeedPercentOfMaxSpeed: 90,
      highIntensitySpeedPercentOfMaxSpeed: 70,
      accelerationThresholdMps2: 2,
      decelerationThresholdMps2: -2,
      effectiveMaxSpeedMps: 8,
      effectiveMaxHeartRateBpm: 190,
      version: 1,
      updatedAtUtc: '2026-02-16T22:00:00.000Z'
    },
    defaultSmoothingFilter: 'AdaptiveMedian',
    preferredSpeedUnit: 'km/h',
    preferredAggregationWindowMinutes: 5
  };
}

describe('App multi-page IA navigation', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });
  });

  it('shows Session list as entry page', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'Sessions' });
    expect(screen.getByText('File name')).toBeInTheDocument();
  });

  it('navigates to Upload page', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Upload' }));
    expect(screen.getByLabelText('Select TCX file')).toBeInTheDocument();
  });

  it('navigates to Compare page', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Compare' }));
    expect(screen.getAllByText('Select at least 2 sessions to compare metrics and quality.').length).toBeGreaterThan(0);
  });

  it('navigates to Profile page', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Profile' }));
    expect(screen.getByLabelText('Primary position')).toBeInTheDocument();
  });
});
