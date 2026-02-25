import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  function baseCoreMetrics() {
    return {
      isAvailable: true,
      unavailableReason: null,
      distanceMeters: 5100,
      sprintDistanceMeters: 950,
      sprintCount: 4,
      maxSpeedMetersPerSecond: 7.42,
      highIntensityTimeSeconds: 380,
      highIntensityRunCount: 7,
      highSpeedDistanceMeters: 1600,
      runningDensityMetersPerMinute: 170,
      accelerationCount: 14,
      decelerationCount: 13,
      heartRateZoneLowSeconds: 180,
      heartRateZoneMediumSeconds: 900,
      heartRateZoneHighSeconds: 720,
      trainingImpulseEdwards: 83.5,
      heartRateRecoveryAfter60Seconds: 22,
      metricAvailability: {
        distanceMeters: { state: 'Available', reason: null },
        sprintDistanceMeters: { state: 'Available', reason: null },
        sprintCount: { state: 'Available', reason: null },
        maxSpeedMetersPerSecond: { state: 'Available', reason: null },
        highIntensityTimeSeconds: { state: 'Available', reason: null },
        highIntensityRunCount: { state: 'Available', reason: null },
        highSpeedDistanceMeters: { state: 'Available', reason: null },
        runningDensityMetersPerMinute: { state: 'Available', reason: null },
        accelerationCount: { state: 'Available', reason: null },
        decelerationCount: { state: 'Available', reason: null },
        heartRateZoneLowSeconds: { state: 'Available', reason: null },
        heartRateZoneMediumSeconds: { state: 'Available', reason: null },
        heartRateZoneHighSeconds: { state: 'Available', reason: null },
        trainingImpulseEdwards: { state: 'Available', reason: null },
        heartRateRecoveryAfter60Seconds: { state: 'Available', reason: null }
      },
      thresholds: {
        MaxSpeedMps: '8.0',
        MaxSpeedMode: 'Fixed',
        MaxSpeedEffectiveMps: '8.0',
        MaxSpeedSource: 'Fixed',
        SprintSpeedPercentOfMaxSpeed: '90.0',
        SprintSpeedThresholdMps: '7.2',
        MaxHeartRateBpm: '190',
        MaxHeartRateMode: 'Fixed',
        MaxHeartRateEffectiveBpm: '190',
        MaxHeartRateSource: 'Fixed',
        HighIntensitySpeedPercentOfMaxSpeed: '70.0',
        HighIntensitySpeedThresholdMps: '5.6',
        AccelerationThresholdMps2: '2.0',
        AccelerationThresholdMode: 'Fixed',
        AccelerationThresholdSource: 'Fixed',
        DecelerationThresholdMps2: '-2.0',
        DecelerationThresholdMode: 'Fixed',
        DecelerationThresholdSource: 'Fixed'
      }
    };
  }

  function createSummary(overrides?: Partial<Record<string, unknown>>) {
    return {
      activityStartTimeUtc: '2026-02-16T21:00:00.000Z',
      durationSeconds: 1800,
      trackpointCount: 25,
      heartRateMinBpm: 120,
      heartRateAverageBpm: 145,
      heartRateMaxBpm: 170,
      distanceMeters: 5100,
      hasGpsData: true,
      fileDistanceMeters: 5000,
      distanceSource: 'CalculatedFromGps',
      qualityStatus: 'High',
      qualityReasons: ['Trackpoints are complete with GPS and heart rate data. No implausible jumps detected.'],
      dataAvailability: {
        mode: 'Dual',
        gpsStatus: 'Available',
        gpsReason: null,
        heartRateStatus: 'Available',
        heartRateReason: null
      },
      gpsTrackpoints: [
        { latitude: 50.9366, longitude: 6.9603, elapsedSeconds: 0 },
        { latitude: 50.9368, longitude: 6.9605, elapsedSeconds: 5 },
        { latitude: 50.9370, longitude: 6.9608, elapsedSeconds: 10 }
      ],
      coreMetrics: baseCoreMetrics(),
      intervalAggregates: [
        {
          windowMinutes: 1,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 60,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 180,
            trainingImpulseEdwards: 1.8
          }
        },
        {
          windowMinutes: 1,
          windowIndex: 1,
          windowStartUtc: '2026-02-16T21:01:00.000Z',
          windowDurationSeconds: 45,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 150,
            trainingImpulseEdwards: 2.3
          }
        },
        {
          windowMinutes: 2,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 105,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 330,
            trainingImpulseEdwards: 4.1
          }
        },
        {
          windowMinutes: 5,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 60,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 510,
            trainingImpulseEdwards: 7.6
          }
        }
      ],
      smoothing: {
        selectedStrategy: 'AdaptiveMedian',
        selectedParameters: {
          OutlierDetectionMode: 'AdaptiveMadWithAbsoluteCap',
          EffectiveOutlierSpeedThresholdMps: '12.5'
        },
        rawDistanceMeters: 5200,
        smoothedDistanceMeters: 5100,
        rawDirectionChanges: 10,
        baselineDirectionChanges: 4,
        smoothedDirectionChanges: 9,
        correctedOutlierCount: 1,
        analyzedAtUtc: '2026-02-16T22:00:00.000Z'
      },
      ...overrides
    };
  }


  function createProfile(overrides?: Partial<Record<string, unknown>>) {
    return {
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
        effectiveMaxSpeedMps: 8.0,
        decelerationThresholdMps2: -2.0,
        effectiveMaxHeartRateBpm: 190,
        version: 1,
        updatedAtUtc: '2026-02-16T22:00:00.000Z'
      },
      defaultSmoothingFilter: 'AdaptiveMedian',
      preferredSpeedUnit: 'km/h',
      preferredAggregationWindowMinutes: 5,
      preferredTheme: 'dark',
      ...overrides
    };
  }


  function gpsTrackpointsFromOneHertzSpeeds(speedsMetersPerSecond: number[]) {
    const metersPerDegreeLatitude = 111_320;
    let latitude = 50.9366;
    const longitude = 6.9603;

    const points = [{ latitude, longitude, elapsedSeconds: 0 }];
    speedsMetersPerSecond.forEach((speed, index) => {
      latitude += speed / metersPerDegreeLatitude;
      points.push({ latitude, longitude, elapsedSeconds: index + 1 });
    });

    return points;
  }

  function createUploadRecord(overrides?: Partial<Record<string, unknown>>) {
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
      segmentChangeHistory: [],
      ...overrides
    };
  }



  it('R1_5_15_Ac01_Ac04_uses_profile_default_aggregation_window_for_new_session_analysis_and_allows_manual_override', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);

      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile({ preferredAggregationWindowMinutes: 5 }) } as Response);
      }

      if (url.endsWith('/tcx/upload') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => createUploadRecord({ id: 'upload-2' }) } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    await screen.findByText('Profile settings');

    const aggregationWindowSelector = await screen.findByLabelText('Aggregation window') as HTMLSelectElement;
    expect(aggregationWindowSelector.value).toBe('5');

    fireEvent.change(aggregationWindowSelector, { target: { value: '1' } });
    expect(aggregationWindowSelector.value).toBe('1');

    const fileInput = screen.getByLabelText('Select TCX file') as HTMLInputElement;
    const file = new File(['dummy'], 'new-session.tcx', { type: 'application/xml' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await screen.findByTestId('upload-quality-step');
    fireEvent.click(screen.getByRole('button', { name: 'To session analysis' }));

    const aggregationWindowSelectorAfterUpload = await screen.findByLabelText('Aggregation window') as HTMLSelectElement;
    await waitFor(() => expect(aggregationWindowSelectorAfterUpload.value).toBe('5'));

    const profileSaveCalls = fetchMock.mock.calls.filter(([input, init]) => String(input).endsWith('/profile') && init?.method === 'PUT');
    expect(profileSaveCalls).toHaveLength(0);
  });

  it('R1_5_09_Ac01_Ac04_recalculates_session_with_current_profile_and_shows_profile_history', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      if (url.includes('/recalculate') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => createUploadRecord({
            selectedSmoothingFilterSource: 'ProfileRecalculation',
            appliedProfileSnapshot: {
              thresholdVersion: 2,
              thresholdUpdatedAtUtc: '2026-02-17T10:00:00.000Z',
              smoothingFilter: 'Butterworth',
              capturedAtUtc: '2026-02-17T10:01:00.000Z'
            },
            recalculationHistory: [{
              recalculatedAtUtc: '2026-02-17T10:01:00.000Z',
              previousProfile: {
                thresholdVersion: 1,
                thresholdUpdatedAtUtc: '2026-02-16T22:00:00.000Z',
                smoothingFilter: 'AdaptiveMedian',
                capturedAtUtc: '2026-02-16T22:00:00.000Z'
              },
              newProfile: {
                thresholdVersion: 2,
                thresholdUpdatedAtUtc: '2026-02-17T10:00:00.000Z',
                smoothingFilter: 'Butterworth',
                capturedAtUtc: '2026-02-17T10:01:00.000Z'
              }
            }],
            summary: createSummary({
              smoothing: {
                ...createSummary().smoothing,
                selectedStrategy: 'Butterworth'
              }
            })
          })
        } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session details')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate with current profile' }));

    await waitFor(() => expect(screen.getByText('Session recalculated with current profile settings.')).toBeInTheDocument());
    expect(screen.getByText('Profile recalculation')).toBeInTheDocument();
    expect(screen.getByText('Recalculation history')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tcx/upload-1/recalculate', expect.objectContaining({ method: 'POST' }));
  });

  it('Mvp01_Ac01_renders english UI by default as browser language fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload area' }));
    expect(screen.getByText('Football Metrics – TCX Upload')).toBeInTheDocument();
    expect(screen.getByText('Maximum file size: 20 MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    await waitFor(() => expect(screen.getByText('Upload history')).toBeInTheDocument());
  });

  it('Mvp01_Ac02_shows validation message for non-tcx files in current language', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Upload history')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });
    const fileInput = screen.getByLabelText('TCX-Datei auswählen');
    fireEvent.change(fileInput, { target: { files: [new File(['fake-content'], 'notes.txt', { type: 'text/plain' })] } });

    expect(screen.getByText('Nur .tcx-Dateien sind erlaubt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hochladen' })).toBeDisabled();
  });

  it('Mvp01_Ac04_shows success message including filename and upload time', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/tcx/upload')) {
        return Promise.resolve({ ok: true, json: async () => createUploadRecord() } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText('Select TCX file'), {
      target: {
        files: [new File(['<TrainingCenterDatabase></TrainingCenterDatabase>'], 'session.tcx', { type: 'application/xml' })]
      }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(screen.getByText(/Upload successful: session\.tcx at/)).toBeInTheDocument();
    });

    const qualityStep = await screen.findByTestId('upload-quality-step');
    expect(within(qualityStep).getByRole('heading', { name: 'Quality details', level: 3 })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('Mvp05_Ac01_Ac02_renders_session_history_with_required_columns', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord(),
        createUploadRecord({
          id: 'upload-2',
          fileName: 'session-2.tcx',
          uploadedAtUtc: '2026-02-16T23:00:00.000Z',
          summary: createSummary({ qualityStatus: 'Medium' })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Upload history')).toBeInTheDocument();
    });

    expect(screen.getByText('File name')).toBeInTheDocument();
    expect(screen.getByText('Upload time')).toBeInTheDocument();
    expect(screen.getByText('Activity time')).toBeInTheDocument();
    expect(screen.getByText('Quality status')).toBeInTheDocument();
    expect(screen.getAllByText('session.tcx').length).toBeGreaterThan(0);
    expect(screen.getAllByText('session-2.tcx').length).toBeGreaterThan(0);
    expect(screen.getAllByText('high').length).toBeGreaterThan(0);
    expect(screen.getAllByText('medium').length).toBeGreaterThan(0);
  });


  it('R1_6_UXIA_Increment1_Story1_1_filters_sessions_by_type_quality_and_date_and_resets', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          id: 'match-high',
          fileName: 'match-high.tcx',
          uploadedAtUtc: '2026-02-16T20:00:00.000Z',
          sessionContext: { sessionType: 'Match', matchResult: null, competition: null, opponentName: null, opponentLogoUrl: null },
          summary: createSummary({ qualityStatus: 'High', activityStartTimeUtc: '2026-02-16T18:00:00.000Z' })
        }),
        createUploadRecord({
          id: 'training-low',
          fileName: 'training-low.tcx',
          uploadedAtUtc: '2026-02-17T20:00:00.000Z',
          sessionContext: { sessionType: 'Training', matchResult: null, competition: null, opponentName: null, opponentLogoUrl: null },
          summary: createSummary({ qualityStatus: 'Low', activityStartTimeUtc: '2026-02-17T18:00:00.000Z' })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Upload history')).toBeInTheDocument());
    expect(screen.getAllByText('match-high.tcx').length).toBeGreaterThan(0);
    expect(screen.getAllByText('training-low.tcx').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Filter & sort/ }));
    expect((screen.getByLabelText('Date from') as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText('Date to') as HTMLInputElement).value).not.toBe('');
    fireEvent.change(screen.getByLabelText('Filter by quality status'), { target: { value: 'High' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getAllByText('match-high.tcx').length).toBeGreaterThan(0);
    const historySection = document.getElementById('session-list') as HTMLElement;
    expect(within(historySection).queryByText('training-low.tcx')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filter & sort/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Match' }));
    fireEvent.change(screen.getByLabelText('Date from'), { target: { value: '2026-02-16' } });
    fireEvent.change(screen.getByLabelText('Date to'), { target: { value: '2026-02-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getAllByText('match-high.tcx').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Filter & sort/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getAllByText('training-low.tcx').length).toBeGreaterThan(0);
  });

  it('Mvp05_Ac03_sorts_history_by_upload_time_with_newest_first_as_default', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({ id: 'old', fileName: 'old.tcx', uploadedAtUtc: '2026-02-16T20:00:00.000Z' }),
        createUploadRecord({ id: 'new', fileName: 'new.tcx', uploadedAtUtc: '2026-02-16T22:00:00.000Z' })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('new.tcx').length).toBeGreaterThan(0);
    });

    const rowsNewestFirst = screen.getAllByRole('row');
    expect(rowsNewestFirst[1]).toHaveTextContent('new.tcx');

    fireEvent.click(screen.getByRole('button', { name: /Filter & sort/ }));
    fireEvent.change(screen.getByLabelText('Sort by upload time'), { target: { value: 'asc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const rowsOldestFirst = screen.getAllByRole('row');
    expect(rowsOldestFirst[1]).toHaveTextContent('old.tcx');
  });

  it('Mvp05_Ac04_clicking_history_entry_opens_the_session_detail_view', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({ id: 'first', fileName: 'first.tcx', summary: createSummary({ qualityStatus: 'Low' }) }),
        createUploadRecord({ id: 'second', fileName: 'second.tcx', summary: createSummary({ qualityStatus: 'Medium' }) })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Open details' }).length).toBe(2);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open details' })[0]);

    expect(screen.getByText(/File name:/)).toBeInTheDocument();
    expect(screen.getAllByText('second.tcx').length).toBeGreaterThan(0);
  });

  it('Mvp06_Ac01_Ac02_displays_base_metrics_including_gps_availability', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'mvp06-complete.tcx',
          summary: createSummary({
            durationSeconds: 3661,
            heartRateMinBpm: 110,
            heartRateAverageBpm: 142,
            heartRateMaxBpm: 178,
            distanceMeters: 7450,
            hasGpsData: true
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Session details')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Duration:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/61 min 1 s/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Heart rate \(min\/avg\/max\):/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/110\/142\/178 bpm/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Trackpoints:/)).toBeInTheDocument();
    expect(screen.getByText(/GPS data available:/)).toBeInTheDocument();
    expect(screen.getByText(/Yes/)).toBeInTheDocument();
    expect(screen.getByText(/Smoothing strategy:/)).toBeInTheDocument();
    expect(screen.getAllByText(/AdaptiveMedian/).length).toBeGreaterThan(0);
  });

  it('Mvp06_Ac03_shows_clear_hints_when_heart_rate_or_gps_data_are_missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'mvp06-missing-data.tcx',
          summary: createSummary({
            heartRateMinBpm: null,
            heartRateAverageBpm: null,
            heartRateMaxBpm: null,
            distanceMeters: null,
            hasGpsData: false,
            distanceSource: 'NotAvailable'
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Session details')).toBeInTheDocument();
    });

    expect(screen.getByText(/Heart-rate values are missing in this session/)).toBeInTheDocument();
    expect(screen.getByText(/Distance cannot be calculated because GPS points are missing/)).toBeInTheDocument();
    expect(screen.getByText(/No GPS coordinates were detected in this file/)).toBeInTheDocument();
    expect(screen.getAllByText(/Heart rate \(min\/avg\/max\):/).length).toBeGreaterThan(0);
    expect(screen.getByText(/GPS data available:/)).toBeInTheDocument();
  });


  it('R1_02_Ac01_Ac02_switches_between_raw_and_smoothed_and_shows_data_change_metric', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'r1-02-gps.tcx',
          summary: createSummary({
            distanceMeters: 5100,
            coreMetrics: {
        isAvailable: true,
        unavailableReason: null,
        distanceMeters: 5100,
        sprintDistanceMeters: 950,
        sprintCount: 4,
        maxSpeedMetersPerSecond: 7.42,
        highIntensityTimeSeconds: 380,
        highIntensityRunCount: 7,
        highSpeedDistanceMeters: 1600,
        runningDensityMetersPerMinute: 170,
        accelerationCount: 14,
        decelerationCount: 13,
        heartRateZoneLowSeconds: 180,
        heartRateZoneMediumSeconds: 900,
        heartRateZoneHighSeconds: 720,
        trainingImpulseEdwards: 83.5,
        heartRateRecoveryAfter60Seconds: 22,
        thresholds: {
          MaxSpeedMps: '7.0',
          MaxHeartRateBpm: '5.5',
          AccelerationThresholdMps2: '2.0',
          DecelerationThresholdMps2: '-2.0'
        }
      },
      intervalAggregates: [
        {
          windowMinutes: 1,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 60,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 180,
            trainingImpulseEdwards: 1.8
          }
        },
        {
          windowMinutes: 1,
          windowIndex: 1,
          windowStartUtc: '2026-02-16T21:01:00.000Z',
          windowDurationSeconds: 45,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 150,
            trainingImpulseEdwards: 2.3
          }
        },
        {
          windowMinutes: 2,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 105,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 330,
            trainingImpulseEdwards: 4.1
          }
        },
        {
          windowMinutes: 5,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 60,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 510,
            trainingImpulseEdwards: 7.6
          }
        }
      ],
      smoothing: {
              selectedStrategy: 'AdaptiveMedian',
              selectedParameters: {
                OutlierDetectionMode: 'AdaptiveMadWithAbsoluteCap',
                EffectiveOutlierSpeedThresholdMps: '12.5'
              },
              rawDistanceMeters: 5200,
              smoothedDistanceMeters: 5100,
              rawDirectionChanges: 10,
              baselineDirectionChanges: 4,
              smoothedDirectionChanges: 9,
              correctedOutlierCount: 1,
              analyzedAtUtc: '2026-02-16T22:00:00.000Z'
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Raw vs. smoothed comparison')).toBeInTheDocument();
    });

    expect(screen.getByText(/Data change due to smoothing:/)).toBeInTheDocument();
    expect(screen.getByText(/4.0% corrected points \(1\/25\), distance delta 100(\.000)? m/)).toBeInTheDocument();
    expect(screen.getByText(/Direction changes:/)).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Display mode'), { target: { value: 'raw' } });

    expect(screen.getByText(/5.200 km \(5,200(\.0)? m\)/)).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });


  it('R1_02_shows_small_distance_delta_with_meter_precision', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'r1-02-small-delta.tcx',
          summary: createSummary({
            trackpointCount: 6201,
            coreMetrics: {
        isAvailable: true,
        unavailableReason: null,
        distanceMeters: 5100,
        sprintDistanceMeters: 950,
        sprintCount: 4,
        maxSpeedMetersPerSecond: 7.42,
        highIntensityTimeSeconds: 380,
        highIntensityRunCount: 7,
        highSpeedDistanceMeters: 1600,
        runningDensityMetersPerMinute: 170,
        accelerationCount: 14,
        decelerationCount: 13,
        heartRateZoneLowSeconds: 180,
        heartRateZoneMediumSeconds: 900,
        heartRateZoneHighSeconds: 720,
        trainingImpulseEdwards: 83.5,
        heartRateRecoveryAfter60Seconds: 22,
        thresholds: {
          MaxSpeedMps: '7.0',
          MaxHeartRateBpm: '5.5',
          AccelerationThresholdMps2: '2.0',
          DecelerationThresholdMps2: '-2.0'
        }
      },
      intervalAggregates: [
        {
          windowMinutes: 1,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 60,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 180,
            trainingImpulseEdwards: 1.8
          }
        },
        {
          windowMinutes: 1,
          windowIndex: 1,
          windowStartUtc: '2026-02-16T21:01:00.000Z',
          windowDurationSeconds: 45,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 150,
            trainingImpulseEdwards: 2.3
          }
        },
        {
          windowMinutes: 2,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 105,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 330,
            trainingImpulseEdwards: 4.1
          }
        },
        {
          windowMinutes: 5,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 60,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 510,
            trainingImpulseEdwards: 7.6
          }
        }
      ],
      smoothing: {
              selectedStrategy: 'AdaptiveMedian',
              selectedParameters: {
                OutlierDetectionMode: 'AdaptiveMadWithAbsoluteCap',
                EffectiveOutlierSpeedThresholdMps: '7.69'
              },
              rawDistanceMeters: 7052.720691907273,
              smoothedDistanceMeters: 7052.476360802489,
              rawDirectionChanges: 1882,
              baselineDirectionChanges: 770,
              smoothedDirectionChanges: 2064,
              correctedOutlierCount: 0,
              analyzedAtUtc: '2026-02-16T22:00:00.000Z'
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Raw vs. smoothed comparison')).toBeInTheDocument();
    });

    expect(screen.getByText(/distance delta 0\.244 m/)).toBeInTheDocument();
  });

  it('R1_02_Ac03_disables_comparison_for_sessions_without_gps_with_clear_hint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'r1-02-no-gps.tcx',
          summary: createSummary({
            hasGpsData: false,
            distanceMeters: null,
            distanceSource: 'NotAvailable',
            coreMetrics: {
        isAvailable: true,
        unavailableReason: null,
        distanceMeters: 5100,
        sprintDistanceMeters: 950,
        sprintCount: 4,
        maxSpeedMetersPerSecond: 7.42,
        highIntensityTimeSeconds: 380,
        highIntensityRunCount: 7,
        highSpeedDistanceMeters: 1600,
        runningDensityMetersPerMinute: 170,
        accelerationCount: 14,
        decelerationCount: 13,
        heartRateZoneLowSeconds: 180,
        heartRateZoneMediumSeconds: 900,
        heartRateZoneHighSeconds: 720,
        trainingImpulseEdwards: 83.5,
        heartRateRecoveryAfter60Seconds: 22,
        thresholds: {
          MaxSpeedMps: '7.0',
          MaxHeartRateBpm: '5.5',
          AccelerationThresholdMps2: '2.0',
          DecelerationThresholdMps2: '-2.0'
        }
      },
      intervalAggregates: [
        {
          windowMinutes: 1,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 60,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 180,
            trainingImpulseEdwards: 1.8
          }
        },
        {
          windowMinutes: 1,
          windowIndex: 1,
          windowStartUtc: '2026-02-16T21:01:00.000Z',
          windowDurationSeconds: 45,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 150,
            trainingImpulseEdwards: 2.3
          }
        },
        {
          windowMinutes: 2,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 105,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 330,
            trainingImpulseEdwards: 4.1
          }
        },
        {
          windowMinutes: 5,
          windowIndex: 0,
          windowStartUtc: '2026-02-16T21:00:00.000Z',
          windowDurationSeconds: 60,
          coreMetrics: {
            ...baseCoreMetrics(),
            distanceMeters: 510,
            trainingImpulseEdwards: 7.6
          }
        }
      ],
      smoothing: {
              selectedStrategy: 'AdaptiveMedian',
              selectedParameters: {
                OutlierDetectionMode: 'AdaptiveMadWithAbsoluteCap',
                EffectiveOutlierSpeedThresholdMps: '12.5'
              },
              rawDistanceMeters: null,
              smoothedDistanceMeters: null,
              rawDirectionChanges: 0,
              baselineDirectionChanges: 0,
              smoothedDirectionChanges: 0,
              correctedOutlierCount: 0,
              analyzedAtUtc: '2026-02-16T22:00:00.000Z'
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Raw vs. smoothed comparison')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Display mode')).toBeDisabled();
    expect(screen.getByText('Comparison is disabled because this session does not contain GPS coordinates.')).toBeInTheDocument();
  });


  it('R1_03_Ac01_Ac04_Ac05_shows_football_core_metrics_extended_set_and_quality_gated_hint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'r1-03-high-quality.tcx',
          summary: createSummary({
            coreMetrics: {
              isAvailable: true,
              unavailableReason: null,
              distanceMeters: 5100,
              sprintDistanceMeters: 850,
              sprintCount: 5,
              maxSpeedMetersPerSecond: 7.75,
              highIntensityTimeSeconds: 420,
              highIntensityRunCount: 6,
              highSpeedDistanceMeters: 1200,
              runningDensityMetersPerMinute: 165,
              accelerationCount: 11,
              decelerationCount: 9,
              heartRateZoneLowSeconds: 200,
              heartRateZoneMediumSeconds: 850,
              heartRateZoneHighSeconds: 750,
              trainingImpulseEdwards: 78.4,
              heartRateRecoveryAfter60Seconds: 19,
              thresholds: {
                MaxSpeedMps: '7.0',
                MaxHeartRateBpm: '5.5',
                AccelerationThresholdMps2: '2.0',
                DecelerationThresholdMps2: '-2.0'
              }
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Football core metrics')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Sprint distance:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sprint count:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Maximum speed:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/High-intensity time:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/High-intensity runs:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/High-speed distance:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Running density \(m\/min\):/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Accelerations:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Decelerations:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TRIMP \(Edwards\):/).length).toBeGreaterThan(0);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'r1-03-low-quality.tcx',
          summary: createSummary({
            qualityStatus: 'Low',
            coreMetrics: {
              isAvailable: false,
              unavailableReason: 'Core metrics unavailable because data quality is Low. Required: High.',
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
              heartRateZoneLowSeconds: null,
              heartRateZoneMediumSeconds: null,
              heartRateZoneHighSeconds: null,
              trainingImpulseEdwards: null,
              heartRateRecoveryAfter60Seconds: null,
              thresholds: {
                MaxSpeedMps: '7.0',
                MaxHeartRateBpm: '5.5',
                AccelerationThresholdMps2: '2.0',
                DecelerationThresholdMps2: '-2.0'
              }
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Core metrics unavailable:/)).toBeInTheDocument();
    });
  });

  it('R1_04_Ac02_Ac03_marks_unavailable_metrics_as_not_measured_or_unusable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'r1-04-status.tcx',
          summary: createSummary({
            hasGpsData: false,
            distanceMeters: null,
            distanceSource: 'NotAvailable',
            coreMetrics: {
              ...baseCoreMetrics(),
              distanceMeters: null,
              sprintCount: null,
              metricAvailability: {
                ...baseCoreMetrics().metricAvailability,
                distanceMeters: { state: 'NotMeasured', reason: 'GPS coordinates were not recorded for this session.' },
                sprintCount: { state: 'NotUsable', reason: 'GPS measurements are present but do not contain usable time segments.' }
              }
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Session details')).toBeInTheDocument();
    });

    expect(screen.getByText(/Not measured: GPS coordinates were not recorded/)).toBeInTheDocument();
    expect(screen.getByText(/Measurement unusable: GPS measurements are present/)).toBeInTheDocument();
  });

  it('R1_04_Ac04_does_not_render_fake_zero_values_for_unavailable_metrics', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          fileName: 'r1-04-no-zero.tcx',
          summary: createSummary({
            coreMetrics: {
              ...baseCoreMetrics(),
              distanceMeters: null,
              sprintDistanceMeters: null,
              sprintCount: null,
              metricAvailability: {
                ...baseCoreMetrics().metricAvailability,
                distanceMeters: { state: 'NotMeasured', reason: 'GPS coordinates were not recorded for this session.' },
                sprintDistanceMeters: { state: 'NotMeasured', reason: 'GPS coordinates were not recorded for this session.' },
                sprintCount: { state: 'NotMeasured', reason: 'GPS coordinates were not recorded for this session.' }
              }
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Session details')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Not available/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^0\.00 m\/s$/)).not.toBeInTheDocument();
  });

  it('Mvp06_Ac04_keeps_detail_view_readable_on_mobile_layout', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [createUploadRecord()]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Session details')).toBeInTheDocument();
    });

    expect(screen.getByText('Sort by upload time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Quality info' }).length).toBeGreaterThan(0);
  });


  it('R1_06_Ac01_Ac02_shows_info_elements_with_metric_explanations', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [createUploadRecord()]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Session details')).toBeInTheDocument();
    });

    const distanceInfo = screen.getAllByRole('button', { name: 'Distance explanation' })[0];
    expect(distanceInfo).toBeInTheDocument();

    fireEvent.click(distanceInfo);
    expect(screen.getByText(/Purpose: quantifies covered ground/)).toBeInTheDocument();
    expect(screen.getByText(/Unit: km and m/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    const sprintDistanceInfo = screen.getByRole('button', { name: 'Sprint distance explanation' });
    fireEvent.click(sprintDistanceInfo);
    expect(screen.getByText(/Very low values usually mean little sprint exposure/)).toBeInTheDocument();
  });

  it('R1_06_Ac03_Ac04_localizes_and_explains_quality_gated_unavailable_metrics', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          summary: createSummary({
            coreMetrics: {
              isAvailable: false,
              unavailableReason: 'Quality status must be High.',
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
              heartRateZoneLowSeconds: null,
              heartRateZoneMediumSeconds: null,
              heartRateZoneHighSeconds: null,
              trainingImpulseEdwards: null,
              heartRateRecoveryAfter60Seconds: null,
              metricAvailability: {
                sprintDistanceMeters: { state: 'NotUsable', reason: 'GPS quality below threshold.' }
              },
              thresholds: {
                MaxSpeedMps: '7.0'
              }
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Core metrics unavailable/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Not available — Measurement unusable: GPS quality below threshold\./)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });

    fireEvent.click(screen.getByRole('button', { name: 'Anzahl Sprints explanation' }));
    expect(screen.getByText(/0-2 niedrig, 3-6 mittel, >6 hoch/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Details schließen' }));
    fireEvent.click(screen.getByRole('button', { name: 'TRIMP (Edwards) explanation' }));
    expect(screen.getByText(/40-80 mittel/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Details schließen' }));
    fireEvent.click(screen.getByRole('button', { name: 'HF-Erholung nach 60s explanation' }));
    expect(screen.getByText(/12-20 mittel, >20 gut/)).toBeInTheDocument();
  });


  it('R1_07_Ac01_Ac02_Ac04_allows_filter_selection_and_disables_without_gps', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && !init) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }
      if (url.includes('/smoothing-filter')) {
        return Promise.resolve({
          ok: true,
          json: async () => createUploadRecord({ summary: createSummary({ smoothing: { ...createSummary().smoothing, selectedStrategy: 'Butterworth' } }) })
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    const firstRender = render(<App />);

    await waitFor(() => expect(screen.getByLabelText('Smoothing filter')).toBeInTheDocument());
    const filterSelector = screen.getByLabelText('Smoothing filter');
    const filterOptions = within(filterSelector).getAllByRole('option').map((option) => option.textContent);
    expect(filterOptions).toEqual(['Raw', 'AdaptiveMedian (recommended)', 'Savitzky-Golay', 'Butterworth']);

    fireEvent.change(screen.getByLabelText('Smoothing filter'), { target: { value: 'Butterworth' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/smoothing-filter'), expect.anything()));

    fetchMock.mockRestore();
    firstRender.unmount();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [createUploadRecord({ summary: createSummary({ hasGpsData: false }) })]
    } as Response);

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Smoothing filter')).toBeDisabled());
    expect(screen.getByText(/Filter selection is disabled/)).toBeInTheDocument();
  });

  function createR108FetchMock() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && !init) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }

      if (url.includes('/smoothing-filter')) {
        return Promise.resolve({
          ok: true,
          json: async () => createUploadRecord({ summary: createSummary({ smoothing: { ...createSummary().smoothing, selectedStrategy: 'Butterworth' } }) })
        } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });
  }

  it('R1_08_Ac01_shows_short_description_for_each_available_filter', async () => {
    createR108FetchMock();

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Smoothing filter')).toBeInTheDocument());

    expect(screen.getByText(/football-first smoothing for short accelerations and turns/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Smoothing filter'), { target: { value: 'Raw' } });
    await waitFor(() => expect(screen.getByText(/inspect unprocessed GPS points/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Smoothing filter'), { target: { value: 'Savitzky-Golay' } });
    await waitFor(() => expect(screen.getByText(/polynomial smoothing for stable trajectories/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Smoothing filter'), { target: { value: 'Butterworth' } });
    await waitFor(() => expect(screen.getByText(/low-pass filtering for strong noise suppression/)).toBeInTheDocument());
  });

  it('R1_08_Ac02_marks_adaptive_median_as_recommended_default_in_filter_selector', async () => {
    createR108FetchMock();

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Smoothing filter')).toBeInTheDocument());

    const filterSelector = screen.getByLabelText('Smoothing filter');
    expect(within(filterSelector).getByRole('option', { name: 'AdaptiveMedian (recommended)' })).toBeInTheDocument();
    expect(screen.getByText(/Product recommendation: AdaptiveMedian is the default/)).toBeInTheDocument();
  });

  it('R1_08_Ac03_explains_that_metrics_can_change_after_filter_switch', async () => {
    const fetchMock = createR108FetchMock();

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Smoothing filter')).toBeInTheDocument());

    expect(screen.getByText(/Changing the smoothing filter can alter shown distance/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Smoothing filter'), { target: { value: 'Butterworth' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/smoothing-filter'), expect.anything()));
  });

  it('R1_08_Ac04_localizes_filter_help_and_recommendation_for_de_and_en', async () => {
    createR108FetchMock();

    render(<App />);

    await waitFor(() => expect(screen.getByLabelText('Smoothing filter')).toBeInTheDocument());

    const filterSelector = screen.getByLabelText('Smoothing filter');
    expect(within(filterSelector).getByRole('option', { name: 'AdaptiveMedian (recommended)' })).toBeInTheDocument();
    expect(screen.getByText(/Product recommendation: AdaptiveMedian is the default/)).toBeInTheDocument();

    fireEvent.change(filterSelector, { target: { value: 'Butterworth' } });
    await waitFor(() => expect(screen.getByText(/low-pass filtering for strong noise suppression/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });
    await waitFor(() => expect(within(filterSelector).getByRole('option', { name: /AdaptiveMedian \(empfohlen\)/ })).toBeInTheDocument());
    expect(screen.getByText(/Produktempfehlung: AdaptiveMedian ist der Standard/)).toBeInTheDocument();
    expect(screen.getByText(/Beim Wechsel des Glättungsfilters können sich Distanz/)).toBeInTheDocument();
    expect(screen.getByText(/Tiefpassfilter für starke Rauschunterdrückung/)).toBeInTheDocument();
  });


  it('R1_5_01_Ac01_Ac02_Ac03_Ac04_compares_multiple_sessions_with_quality_and_delta_highlights', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          id: 'base',
          fileName: 'base-session.tcx',
          uploadedAtUtc: '2026-02-16T20:00:00.000Z',
          sessionContext: {
            sessionType: 'Training',
            matchResult: null,
            competition: null,
            opponentName: null,
            opponentLogoUrl: null
          },
          summary: createSummary({ qualityStatus: 'High' })
        }),
        createUploadRecord({
          id: 'compare',
          fileName: 'compare-session.tcx',
          uploadedAtUtc: '2026-02-16T21:00:00.000Z',
          summary: createSummary({ qualityStatus: 'Low' })
        }),
        createUploadRecord({
          id: 'third',
          fileName: 'third-session.tcx',
          uploadedAtUtc: '2026-02-16T22:00:00.000Z',
          sessionContext: {
            sessionType: 'Match',
            matchResult: null,
            competition: null,
            opponentName: null,
            opponentLogoUrl: null
          },
          summary: createSummary({ qualityStatus: 'Medium' })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session details')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Compare|Vergleich/ }));

    await waitFor(() => expect(screen.getByText('Session comparison')).toBeInTheDocument());

    const selector = screen.getByLabelText('Comparison session');
    expect(within(selector).getByRole('option', { name: /base-session\.tcx \(active session\)/ })).toBeInTheDocument();
    expect(within(selector).getByRole('option', { name: 'compare-session.tcx' })).toBeInTheDocument();
    expect(within(selector).queryByRole('option', { name: 'third-session.tcx' })).not.toBeInTheDocument();

    fireEvent.change(selector, { target: { value: 'compare' } });
    expect(screen.getByText('Quality warning: selected sessions have different data quality. Compare with caution to avoid misinterpretation.')).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: 'base' } });

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /base-session\.tcx \(baseline\)/ })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'base-session.tcx' })).toBeInTheDocument();
    });

    expect(screen.queryByText('Quality warning: selected sessions have different data quality. Compare with caution to avoid misinterpretation.')).not.toBeInTheDocument();
  });



  it('R1_5_03_hides_match_context_fields_when_session_type_is_not_match', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => [createUploadRecord()] } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText('Type')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('Result')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Competition')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Opponent')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Opponent logo URL (optional)')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Match' } });

    expect(screen.getByLabelText('Result')).toBeInTheDocument();
    expect(screen.getByLabelText('Competition')).toBeInTheDocument();
    expect(screen.getByLabelText('Opponent')).toBeInTheDocument();
    expect(screen.getByLabelText('Opponent logo URL (optional)')).toBeInTheDocument();
  });

  it('R1_5_02_Ac01_Ac02_Ac04_shows_aggregated_intervals_with_window_switch_and_missing_data_marker', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => [createUploadRecord()] } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Interval aggregation (1 / 2 / 5 minutes)')).toBeInTheDocument();
    });

    expect(screen.getByText(/Interval views help you understand how effort changes during a session/)).toBeInTheDocument();
    expect(screen.getByText('Windows: 1')).toBeInTheDocument();
    expect(screen.getAllByText(/Duration:/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Aggregation window'), { target: { value: '5' } });

    await waitFor(() => {
      expect(screen.getByText('Windows: 1')).toBeInTheDocument();
      expect(screen.getByText(/1 min 0 s/)).toBeInTheDocument();
    });
  });



  it('R1_5_04_Ac01_Ac04_shows_current_profile_positions_in_settings', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/profile')) {
        return Promise.resolve({ ok: true, json: async () => createProfile({ primaryPosition: 'FullBack', secondaryPosition: 'Winger' }) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Profile settings')).toBeInTheDocument();
    });

    expect(screen.getByText('Current profile: Full-back / Winger')).toBeInTheDocument();
    expect((screen.getByLabelText('Primary position') as HTMLSelectElement).value).toBe('FullBack');
    expect((screen.getByLabelText('Secondary position (Optional)') as HTMLSelectElement).value).toBe('Winger');
  });

  it('R1_5_04_Ac02_Ac03_validates_and_saves_profile_positions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      if (url.endsWith('/profile') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({ ok: true, json: async () => body } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Profile settings')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Secondary position (Optional)'), { target: { value: 'CentralMidfielder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(screen.getByText('Primary and secondary position must differ.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Secondary position (Optional)'), { target: { value: 'Winger' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/profile', expect.objectContaining({ method: 'PUT' }));
    expect((screen.getByLabelText('Preferred speed unit') as HTMLSelectElement).value).toBe('km/h');
  });


  it('R1_5_05_Ac01_Ac04_shows_editable_thresholds_in_profile_and_session_thresholds', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/profile')) {
        return Promise.resolve({ ok: true, json: async () => createProfile({ metricThresholds: { maxSpeedMps: 7.8, maxSpeedMode: 'Fixed', maxHeartRateBpm: 192, maxHeartRateMode: 'Adaptive', sprintSpeedPercentOfMaxSpeed: 88, highIntensitySpeedPercentOfMaxSpeed: 68, accelerationThresholdMps2: 2.4, effectiveMaxSpeedMps: 7.8, decelerationThresholdMps2: -2.8, effectiveMaxHeartRateBpm: 192, version: 3, updatedAtUtc: '2026-02-16T22:00:00.000Z' } }) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Metric thresholds')).toBeInTheDocument());
    expect((screen.getByLabelText('Max speed (km/h)') as HTMLInputElement).value).toBe('28.1');
    expect(screen.getByText('Threshold version: 3')).toBeInTheDocument();
  });

  it('R1_5_05_Ac02_Ac03_saves_threshold_changes_with_validation_feedback_from_api', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      if (url.endsWith('/profile') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        if (body.metricThresholds?.maxSpeedMps < 4) {
          return Promise.resolve({ ok: false, text: async () => 'MaxSpeedMps must be between 4.0 and 12.0.' } as Response);
        }

        return Promise.resolve({ ok: true, json: async () => createProfile({ metricThresholds: { ...body.metricThresholds, version: 2, updatedAtUtc: '2026-02-17T12:00:00.000Z' } }) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Profile settings')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Max speed (km/h)'), { target: { value: '3.0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.getByText(/Upload failed:/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Max speed (km/h)'), { target: { value: '30.0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/profile', expect.objectContaining({ method: 'PUT' }));
    expect(screen.getByText('Threshold version: 2')).toBeInTheDocument();
  });
  it('R1_5_08_Ac01_shows_profile_default_filter_setting_and_saves_it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile({ defaultSmoothingFilter: 'Butterworth' }) } as Response);
      }

      if (url.endsWith('/profile') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({ ok: true, json: async () => createProfile(body) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Profile settings')).toBeInTheDocument());
    expect((screen.getByLabelText('Default smoothing filter') as HTMLSelectElement).value).toBe('Butterworth');
    const profileFilterSelector = screen.getByLabelText('Default smoothing filter');
    expect(within(profileFilterSelector).getByRole('option', { name: 'AdaptiveMedian (recommended)' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Default smoothing filter'), { target: { value: 'Raw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/profile', expect.objectContaining({ method: 'PUT' }));
    expect((screen.getByLabelText('Preferred speed unit') as HTMLSelectElement).value).toBe('km/h');
  });

  it('R1_5_10_Ac01_Ac03_shows_and_saves_threshold_modes_with_adaptive_source_visibility', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      if (url.endsWith('/profile') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({ ok: true, json: async () => createProfile({ metricThresholds: { ...body.metricThresholds, version: 2, updatedAtUtc: '2026-02-17T12:00:00.000Z' } }) } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => [createUploadRecord({ summary: createSummary({ coreMetrics: { ...baseCoreMetrics(), thresholds: { ...baseCoreMetrics().thresholds, SprintSpeedThresholdSource: 'Adaptive' } } }) })]
      } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Metric thresholds')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Max speed mode'), { target: { value: 'Adaptive' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument());
    expect(screen.getByText(/MaxSpeedSource=/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/profile', expect.objectContaining({ method: 'PUT' }));
  });


  it('R1_5_08_Ac04_shows_if_filter_is_profile_default_or_manual_override', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({ id: 'profile-default', selectedSmoothingFilterSource: 'ProfileDefault' }),
        createUploadRecord({ id: 'manual-override', fileName: 'manual.tcx', selectedSmoothingFilterSource: 'ManualOverride' })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => expect(screen.getByText(/Filter source/)).toBeInTheDocument());
    expect(screen.getAllByText('Profile default').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Open details' })[1]);
    await waitFor(() => expect(screen.getByText('Manual override')).toBeInTheDocument());
  });



  it('R1_5_14_Ac01_Ac04_shows_only_absolute_adaptive_modes_and_consistent_session_threshold_transparency', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => createProfile({
            metricThresholds: {
              ...createProfile().metricThresholds,
              maxSpeedMode: 'Adaptive',
              maxHeartRateMode: 'Adaptive',
              maxSpeedMps: 7.5,
              effectiveMaxSpeedMps: 8.3,
              maxHeartRateBpm: 188,
              effectiveMaxHeartRateBpm: 197,
              sprintSpeedPercentOfMaxSpeed: 91,
              highIntensitySpeedPercentOfMaxSpeed: 71
            }
          })
        } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByLabelText('Max speed mode')).toBeInTheDocument());
    expect(screen.getByLabelText('Max speed mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Max heartrate mode')).toBeInTheDocument();
    expect(screen.queryByLabelText('Sprint mode')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('High-intensity mode')).not.toBeInTheDocument();

    expect((screen.getByLabelText('Max speed (km/h)') as HTMLInputElement)).toHaveAttribute('readonly');
    expect((screen.getByLabelText('Max heartrate (bpm)') as HTMLInputElement)).toHaveAttribute('readonly');

    expect(screen.getByText(/Effective max speed: 29.9 km\/h \(Adaptive\)/)).toBeInTheDocument();
    expect(screen.getByText(/Effective max heartrate: 197 bpm \(Adaptive\)/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Open details' })[0]);
    await waitFor(() => expect(screen.getByText(/Session threshold transparency/)).toBeInTheDocument());
    expect(screen.getByText(/MaxSpeedBase=8.0 m\/s \(Fixed\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sprint=90.0% → 7.2 m\/s/)).toBeInTheDocument();
  });
  it('R1_5_12_Ac01_profile_thresholds_use_preferred_speed_unit_in_profile_view', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => createProfile({
            preferredSpeedUnit: 'min/km',
            metricThresholds: { ...createProfile().metricThresholds, maxSpeedMps: 6.0, maxSpeedMode: 'Fixed', sprintSpeedPercentOfMaxSpeed: 90, highIntensitySpeedPercentOfMaxSpeed: 70 }
          })
        } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByLabelText('Max speed (min/km)')).toBeInTheDocument());
    expect((screen.getByLabelText('Max speed (min/km)') as HTMLInputElement).value).toBe('2.78');
    expect(screen.getByText('Derived sprint threshold: 3.09 min/km')).toBeInTheDocument();
    expect(screen.getByText('Derived high-intensity threshold: 3.97 min/km')).toBeInTheDocument();
  });

  it('R1_5_12_Ac01_Ac02_profile_speed_unit_is_selectable_and_applied_to_new_sessions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile({ preferredSpeedUnit: 'min/km' }) } as Response);
      }

      if (url.endsWith('/profile') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({ ok: true, json: async () => createProfile(body) } as Response);
      }

      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord({ selectedSpeedUnit: 'min/km' })] } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Profile settings')).toBeInTheDocument());
    expect((screen.getByLabelText('Preferred speed unit') as HTMLSelectElement).value).toBe('min/km');

    fireEvent.change(screen.getByLabelText('Preferred speed unit'), { target: { value: 'km/h' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/profile', expect.objectContaining({ method: 'PUT' }));
    expect((screen.getByLabelText('Preferred speed unit') as HTMLSelectElement).value).toBe('km/h');
  });

  it('R1_5_12_Ac03_Ac04_session_speed_unit_can_be_temporarily_overridden_with_consistent_rounding', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord({ selectedSpeedUnit: 'km/h', summary: createSummary({ coreMetrics: { ...baseCoreMetrics(), maxSpeedMetersPerSecond: 7.42 } }) })] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile({ preferredSpeedUnit: 'km/h' }) } as Response);
      }

      if (url.includes('/speed-unit') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({ ok: true, json: async () => createUploadRecord({ selectedSpeedUnit: body.speedUnit, selectedSpeedUnitSource: 'ManualOverride', summary: createSummary({ coreMetrics: { ...baseCoreMetrics(), maxSpeedMetersPerSecond: 7.42 } }) }) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getAllByText(/26\.7 km\/h/).length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText('Speed unit'), { target: { value: 'm/s' } });

    await waitFor(() => expect(screen.getAllByText(/7\.42 m\/s/).length).toBeGreaterThan(0));
    expect(screen.getAllByText('Manual override').length).toBeGreaterThan(0);
  });


  it('R1_5_06_Ac01_Ac02_Ac03_separates_external_and_internal_metrics_with_explanations', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [createUploadRecord()]
    } as Response);

    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'en' } });
    await waitFor(() => expect(screen.getByText('Football core metrics')).toBeInTheDocument());

    expect(screen.getByText('External metrics (movement-based)')).toBeInTheDocument();
    expect(screen.getByText('Internal metrics (heart-rate-based)')).toBeInTheDocument();
    expect(screen.getByText(/External metrics describe your visible physical output/)).toBeInTheDocument();
    expect(screen.getByText(/Internal metrics describe your physiological response/)).toBeInTheDocument();
  });

  it('R1_5_06_Ac04_filters_metric_view_by_category_tabs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [createUploadRecord()]
    } as Response);

    render(<App />);

    await waitFor(() => expect(screen.getByRole('tab', { name: 'External metrics' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'External metrics' }));
    expect(screen.getByText('External metrics (movement-based)')).toBeInTheDocument();
    expect(screen.queryByText('Internal metrics (heart-rate-based)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Internal metrics' }));
    expect(screen.getByText('Internal metrics (heart-rate-based)')).toBeInTheDocument();
    expect(screen.queryByText('External metrics (movement-based)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'All metrics' }));
    expect(screen.getByText('External metrics (movement-based)')).toBeInTheDocument();
    expect(screen.getByText('Internal metrics (heart-rate-based)')).toBeInTheDocument();
  });


  it('R1_5_13_Ac01_Ac02_Ac03_moves_duration_hr_direction_changes_into_core_metric_categories_without_duplicates', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/profile')) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'en' } });
    await waitFor(() => expect(screen.getByText('Football core metrics')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'External metrics' }));
    const externalSection = screen.getByText('External metrics (movement-based)').closest('div');
    expect(within(externalSection as HTMLElement).getByText('Duration:')).toBeInTheDocument();
    expect(within(externalSection as HTMLElement).getByText('Direction changes:')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Internal metrics' }));
    const internalSection = screen.getByText('Internal metrics (heart-rate-based)').closest('div');
    expect(within(internalSection as HTMLElement).getByText('Heart rate (min/avg/max):')).toBeInTheDocument();

  });

  it('R1_5_13_Ac04_shows_missing_data_transparently_for_moved_metrics', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/profile')) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      const first = createUploadRecord({
        id: 'upload-a',
        fileName: 'a.tcx',
        summary: createSummary({
          heartRateMinBpm: null,
          heartRateAverageBpm: null,
          heartRateMaxBpm: null,
          smoothing: { ...createSummary().smoothing, smoothedDirectionChanges: null }
        })
      });

      const second = createUploadRecord({ id: 'upload-b', fileName: 'b.tcx' });

      first.summary.coreMetrics.metricAvailability = {
        ...first.summary.coreMetrics.metricAvailability,
        durationSeconds: { state: 'NotMeasured', reason: 'No moving timestamps available.' },
        directionChanges: { state: 'NotUsable', reason: 'Insufficient heading stability.' },
        heartRateMinAvgMaxBpm: { state: 'NotMeasured', reason: 'No heart-rate stream in file.' }
      };

      return Promise.resolve({ ok: true, json: async () => [first, second] } as Response);
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'en' } });
    await waitFor(() => expect(screen.getByText('Football core metrics')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'External metrics' }));
    const externalSection = screen.getByText('External metrics (movement-based)').closest('div');
    expect(externalSection).toHaveTextContent('Duration: 30 min 0 s — Not measured: No moving timestamps available.');
    expect(externalSection).toHaveTextContent('Direction changes: Not available — Measurement unusable: Insufficient heading stability.');

    fireEvent.click(screen.getByRole('tab', { name: 'Internal metrics' }));
    const internalSection = screen.getByText('Internal metrics (heart-rate-based)').closest('div');
    expect(internalSection).toHaveTextContent('Heart rate (min/avg/max): Not available — Not measured: No heart-rate stream in file.');

  });



  it('R1_6_09_Ac05_shows_single_external_warning_banner_instead_of_repeating_warning_per_metric', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/profile')) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      const session = createUploadRecord();
      const warningReason = 'GPS-derived metric calculated with reduced confidence. Please interpret with caution.';
      session.summary.coreMetrics.metricAvailability = {
        ...session.summary.coreMetrics.metricAvailability,
        distanceMeters: { state: 'AvailableWithWarning', reason: warningReason },
        sprintDistanceMeters: { state: 'AvailableWithWarning', reason: warningReason },
        sprintCount: { state: 'AvailableWithWarning', reason: warningReason },
        maxSpeedMetersPerSecond: { state: 'AvailableWithWarning', reason: warningReason },
        highIntensityTimeSeconds: { state: 'AvailableWithWarning', reason: warningReason },
        highIntensityRunCount: { state: 'AvailableWithWarning', reason: warningReason },
        highSpeedDistanceMeters: { state: 'AvailableWithWarning', reason: warningReason },
        runningDensityMetersPerMinute: { state: 'AvailableWithWarning', reason: warningReason },
        accelerationCount: { state: 'AvailableWithWarning', reason: warningReason },
        decelerationCount: { state: 'AvailableWithWarning', reason: warningReason }
      };

      return Promise.resolve({ ok: true, json: async () => [session] } as Response);
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'en' } });
    await waitFor(() => expect(screen.getByText('Football core metrics')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'External metrics' }));
    const externalSection = screen.getByText('External metrics (movement-based)').closest('div') as HTMLElement;

    expect(within(externalSection).getByText('Warning: GPS-based external metrics were calculated with reduced confidence. Please interpret with caution.')).toBeInTheDocument();
    expect(within(externalSection).queryByText(/Available with warning:/i)).not.toBeInTheDocument();
  });

  it('R1_6_02_Ac01_Ac02_Ac03_Ac04_supports_hf_only_insights_without_gps_zero_values_and_with_comparison_label', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              id: 'upload-hf-1',
              fileName: 'hf-only-1.tcx',
              summary: createSummary({
                hasGpsData: false,
                distanceMeters: null,
                fileDistanceMeters: null,
                distanceSource: 'NotAvailable',
                dataAvailability: {
                  mode: 'HeartRateOnly',
                  gpsStatus: 'NotMeasured',
                  gpsReason: 'GPS not present in this session.',
                  heartRateStatus: 'Available',
                  heartRateReason: null
                },
                coreMetrics: {
                  ...baseCoreMetrics(),
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
                  trainingImpulseEdwards: 75,
                  metricAvailability: {
                    ...baseCoreMetrics().metricAvailability,
                    distanceMeters: { state: 'NotMeasured', reason: 'GPS coordinates were not recorded for this session.' },
                    sprintDistanceMeters: { state: 'NotMeasured', reason: 'GPS coordinates were not recorded for this session.' },
                    sprintCount: { state: 'NotMeasured', reason: 'GPS coordinates were not recorded for this session.' }
                  }
                }
              })
            }),
            createUploadRecord({ id: 'upload-dual-2', fileName: 'dual-2.tcx' })
          ]
        } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);
    fireEvent.change(await screen.findByLabelText('Language'), { target: { value: 'en' } });

    expect((await screen.findAllByText('Heart-rate only')).length).toBeGreaterThan(0);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Open details' }))[0]);

    expect(await screen.findByText(/HF-only interpretation aid/)).toBeInTheDocument();
    expect(screen.getByText(/TRIMP\/min/)).toBeInTheDocument();
    expect(screen.getAllByText(/GPS coordinates were not recorded for this session\./).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Compare|Vergleich/ }));
    await screen.findByText('Session comparison');
    const comparisonSelector = await screen.findByLabelText('Comparison session');
    fireEvent.change(comparisonSelector, { target: { value: 'upload-dual-2' } });

    await waitFor(() => expect(screen.getByRole('columnheader', { name: /dual-2\.tcx/ })).toBeInTheDocument());
    expect(screen.getAllByText('Data mode').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Heart-rate only').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dual (GPS + heart rate)').length).toBeGreaterThan(0);
  });

  it('R1_6_01_Ac02_shows_data_mode_in_session_history_and_detail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);
    fireEvent.change(await screen.findByLabelText('Language'), { target: { value: 'en' } });

    expect(await screen.findByText('Data mode')).toBeInTheDocument();
    expect(screen.getAllByText('Dual (GPS + heart rate)').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /Details|Open details/ })[0]);
    expect((await screen.findAllByText(/Dual \(GPS \+ heart rate\)/)).length).toBeGreaterThan(0);
  });



  it('R1_6_01_regression_handles_existing_sessions_without_dataAvailability_field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [createUploadRecord({ summary: createSummary({ dataAvailability: null }) })]
        } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);
    fireEvent.change(await screen.findByLabelText('Language'), { target: { value: 'en' } });

    expect(await screen.findByText('Data mode')).toBeInTheDocument();
    expect(screen.getAllByText('Dual (GPS + heart rate)').length).toBeGreaterThan(0);
  });

  it('R1_6_01_Ac03_Ac04_marks_unavailable_mode_with_clear_reasons', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              summary: createSummary({
                hasGpsData: true,
                qualityStatus: 'Low',
                dataAvailability: {
                  mode: 'GpsOnly',
                  gpsStatus: 'NotUsable',
                  gpsReason: 'GPS unusable because quality is Low. Required: High.',
                  heartRateStatus: 'NotMeasured',
                  heartRateReason: 'Heart-rate data not present in this session.'
                }
              })
            })
          ]
        } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);
    fireEvent.change(await screen.findByLabelText('Language'), { target: { value: 'en' } });

    fireEvent.click((await screen.findAllByRole('button', { name: 'Open details' }))[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Quality info' })[0]);
    expect((await screen.findAllByText(/GPS unusable because quality is Low\. Required: High\./)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Heart-rate data not present in this session\./).length).toBeGreaterThan(0);
  });

  it('R1_6_03_Ac01_Ac02_ui_allows_segment_creation_and_editing', async () => {
    const initial = createUploadRecord({
      id: 'upload-segment',
      segments: [],
      segmentChangeHistory: []
    });

    const createdResponse = createUploadRecord({
      id: 'upload-segment',
      segments: [{ id: 'seg-1', label: 'Warm-up', startSecond: 0, endSecond: 300 }],
      segmentChangeHistory: [{ version: 1, changedAtUtc: '2026-02-16T22:10:00.000Z', action: 'Created', notes: 'Initial', segmentsSnapshot: [{ id: 'seg-1', label: 'Warm-up', startSecond: 0, endSecond: 300 }] }]
    });

    const updatedResponse = createUploadRecord({
      id: 'upload-segment',
      segments: [{ id: 'seg-1', label: 'Activation', startSecond: 0, endSecond: 240 }],
      segmentChangeHistory: [{ version: 1, changedAtUtc: '2026-02-16T22:10:00.000Z', action: 'Created', notes: 'Initial', segmentsSnapshot: [{ id: 'seg-1', label: 'Warm-up', startSecond: 0, endSecond: 300 }] }, { version: 2, changedAtUtc: '2026-02-16T22:20:00.000Z', action: 'Updated', notes: 'Trimmed', segmentsSnapshot: [{ id: 'seg-1', label: 'Activation', startSecond: 0, endSecond: 240 }] }]
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);

      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [initial] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      if (url.includes('/segments') && init?.method === 'POST' && !url.endsWith('/merge')) {
        return Promise.resolve({ ok: true, json: async () => createdResponse } as Response);
      }

      if (url.includes('/segments/seg-1') && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => updatedResponse } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => initial } as Response);
    });

    render(<App />);
    await screen.findByText('Upload history');

    fireEvent.click(screen.getAllByRole('button', { name: 'Open details' })[0]);
    await screen.findByText('Session segments');
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    const editPanelToggle = document.querySelector('#session-segment-edit .analysis-disclosure__toggle') as HTMLButtonElement;
    fireEvent.click(editPanelToggle);

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Warm-up' } });
    fireEvent.change(screen.getByLabelText('Start (s)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('End (s)'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add segment' }));

    await waitFor(() => expect(screen.getAllByText('Warm-up').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Activation' } });
    fireEvent.change(screen.getByLabelText('End (s)'), { target: { value: '240' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save segment changes' }));

    await waitFor(() => expect(screen.getAllByText('Activation').length).toBeGreaterThan(0));

    const segmentCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/segments'));
    expect(segmentCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('R1_6_03_Ac03_ui_shows_backend_validation_errors_for_overlap_and_merge', async () => {
    const initial = createUploadRecord({
      id: 'upload-segment-errors',
      segments: [{ id: 'seg-a', label: 'A', startSecond: 0, endSecond: 200 }, { id: 'seg-b', label: 'B', startSecond: 400, endSecond: 600 }],
      segmentChangeHistory: []
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);

      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [initial] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      if (url.includes('/segments') && init?.method === 'POST' && !url.endsWith('/merge')) {
        return Promise.resolve({ ok: false, json: async () => ({ detail: 'Segments must not overlap.' }) } as Response);
      }

      if (url.endsWith('/segments/merge') && init?.method === 'POST') {
        return Promise.resolve({ ok: false, json: async () => ({ detail: 'Only adjacent segments can be merged.' }) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => initial } as Response);
    });

    render(<App />);
    await screen.findByText('Upload history');
    fireEvent.click(screen.getAllByRole('button', { name: 'Open details' })[0]);
    await screen.findByText('Session segments');
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    const editPanelToggle = document.querySelector('#session-segment-edit .analysis-disclosure__toggle') as HTMLButtonElement;
    fireEvent.click(editPanelToggle);

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Overlap' } });
    fireEvent.change(screen.getByLabelText('Start (s)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('End (s)'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add segment' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Segments must not overlap.'));

    const mergePanelToggle = document.querySelectorAll('#session-segment-edit .analysis-disclosure__toggle')[1] as HTMLButtonElement;
    fireEvent.click(mergePanelToggle);
    fireEvent.change(screen.getByLabelText('Source segment'), { target: { value: 'seg-a' } });
    fireEvent.change(screen.getByLabelText('Target segment'), { target: { value: 'seg-b' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Merge' }).at(-1)!);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Only adjacent segments can be merged.'));

    const errorCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/segments'));
    expect(errorCalls.length).toBeGreaterThanOrEqual(2);
  });
  it('R1_6_13_Ac01_Ac02_renders_gps_heatmap_for_dual_mode_sessions_with_imported_points', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByText('GPS point heatmap')).toBeInTheDocument();
    const heatmap = screen.getByRole('img', { name: 'GPS point heatmap' });
    expect(heatmap).toBeInTheDocument();

    const satelliteImage = heatmap.querySelector('image');
    expect(satelliteImage).not.toBeNull();
    expect(satelliteImage?.getAttribute('href')).toContain('static-maps.yandex.ru/1.x');
    expect(satelliteImage?.getAttribute('href')).toContain('l=sat');
  });


  it('R1_6_13_Ac06_allows_switching_between_heatmap_and_track_points_view', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByText('GPS point heatmap')).toBeInTheDocument();

    const heatmap = screen.getByRole('img', { name: 'GPS point heatmap' });
    expect(heatmap.querySelectorAll('.gps-heatmap__cell').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Track points' }));

    await waitFor(() => {
      const switchedHeatmap = screen.getByRole('img', { name: 'GPS point heatmap' });
      expect(switchedHeatmap.querySelectorAll('.gps-heatmap__cell').length).toBe(0);
      expect(switchedHeatmap.querySelector('.gps-heatmap__track-line')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Heatmap' }));

    await waitFor(() => {
      const switchedBackHeatmap = screen.getByRole('img', { name: 'GPS point heatmap' });
      expect(switchedBackHeatmap.querySelectorAll('.gps-heatmap__cell').length).toBeGreaterThan(0);
    });
  });

  it('R1_6_14_Ac01_Ac02_Ac03_Ac05_renders_separate_runs_map_with_filter_and_selectable_run_list', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              summary: createSummary({
                gpsTrackpoints: [
                  { latitude: 50.9366, longitude: 6.9603, elapsedSeconds: 0 },
                  { latitude: 50.9366, longitude: 6.96085, elapsedSeconds: 5 },
                  { latitude: 50.9366, longitude: 6.9614, elapsedSeconds: 10 },
                  { latitude: 50.9366, longitude: 6.96182, elapsedSeconds: 15 },
                  { latitude: 50.9366, longitude: 6.96224, elapsedSeconds: 20 }
                ]
              })
            })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByText('Sprint & high-intensity trackpoints')).toBeInTheDocument();
    expect(screen.getByText('Separate map with the same controls as the heatmap. Filter sprint/high-intensity runs and select single runs from the list.')).toBeInTheDocument();

    const runsMap = screen.getByRole('img', { name: 'GPS sprint and high-intensity runs map' });
    expect(runsMap.querySelectorAll('.gps-heatmap__run-point.gps-heatmap__run--sprint').length).toBeGreaterThan(0);
    expect(runsMap.querySelectorAll('.gps-heatmap__run-point.gps-heatmap__run--high-intensity').length).toBeGreaterThan(0);

    expect(screen.getByText('Detected runs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sprint count #1/ })).toBeInTheDocument();
    const runEntries = screen.getAllByRole('button').filter((button) => button.textContent?.includes('Top speed:'));
    expect(runEntries.length).toBeGreaterThan(0);
  });


  it('R1_6_15_Ac04_prefers_backend_detected_runs_to_keep_logic_in_single_place', async () => {
    const trackpoints = gpsTrackpointsFromOneHertzSpeeds([7.4, 3.0, 7.5, 7.6, 3.0, 3.0, 6.0, 6.1, 3.0, 3.0]);

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              summary: createSummary({
                gpsTrackpoints: trackpoints,
                detectedRuns: [
                  { runType: 'highIntensity', startElapsedSeconds: 2, durationSeconds: 3, distanceMeters: 20, topSpeedMetersPerSecond: 6.1, pointIndices: [2, 3, 4] },
                  { runType: 'sprint', startElapsedSeconds: 6, durationSeconds: 2, distanceMeters: 14, topSpeedMetersPerSecond: 7.6, pointIndices: [6, 7] }
                ],
                coreMetrics: {
                  ...baseCoreMetrics(),
                  sprintCount: 1,
                  highIntensityRunCount: 1
                }
              })
            })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByText('Sprint & high-intensity trackpoints')).toBeInTheDocument();

    const runsRegion = screen.getByRole('region', { name: 'Detected runs' });
    const runEntries = within(runsRegion).getAllByRole('button').filter((button) => button.textContent?.includes('Top speed:'));
    expect(runEntries.length).toBeGreaterThanOrEqual(2);
    expect(runEntries.some((entry) => entry.textContent?.includes('High-intensity runs #'))).toBe(true);
    expect(runEntries.some((entry) => entry.textContent?.includes('Sprint count #'))).toBe(true);
  });

  it('R1_6_16_Ac06_Ac10_Ac11_Ac12_Ac13_supports_hierarchical_hsr_filters_and_nested_sprint_coloring', async () => {
    const trackpoints = gpsTrackpointsFromOneHertzSpeeds([6.0, 6.1, 7.5, 7.6, 6.2, 6.1, 3.0, 3.0]);

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              summary: createSummary({
                gpsTrackpoints: trackpoints,
                detectedRuns: [
                  {
                    runId: 'highIntensity-1',
                    runType: 'highIntensity',
                    startElapsedSeconds: 1,
                    durationSeconds: 5,
                    distanceMeters: 33,
                    topSpeedMetersPerSecond: 7.6,
                    pointIndices: [1, 2, 3, 4, 5],
                    parentRunId: null,
                    sprintPhases: [
                      {
                        runId: 'sprint-1',
                        startElapsedSeconds: 2,
                        durationSeconds: 2,
                        distanceMeters: 15,
                        topSpeedMetersPerSecond: 7.6,
                        pointIndices: [2, 3],
                        parentRunId: 'highIntensity-1'
                      }
                    ]
                  },
                  {
                    runId: 'sprint-1',
                    runType: 'sprint',
                    startElapsedSeconds: 2,
                    durationSeconds: 2,
                    distanceMeters: 15,
                    topSpeedMetersPerSecond: 7.6,
                    pointIndices: [2, 3],
                    parentRunId: 'highIntensity-1',
                    sprintPhases: []
                  }
                ],
                coreMetrics: {
                  ...baseCoreMetrics(),
                  sprintCount: 1,
                  highIntensityRunCount: 1
                }
              })
            })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByRole('img', { name: 'GPS sprint and high-intensity runs map' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'HSR runs with sprint phases' }));
    const runsMap = screen.getByRole('img', { name: 'GPS sprint and high-intensity runs map' });
    expect(runsMap.querySelectorAll('.gps-heatmap__run-point.gps-heatmap__run--sprint').length).toBeGreaterThan(0);
    expect(runsMap.querySelectorAll('.gps-heatmap__run-point.gps-heatmap__run--high-intensity').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Only HSR runs' }));
    expect(screen.queryByRole('button', { name: /Sprint count #/ })).not.toBeInTheDocument();
  });

  it('R1_6_15_Ac01_Ac02_Ac03_runs_list_should_follow_consecutive_logic_and_avoid_zero_meter_entries', async () => {
    const trackpoints = gpsTrackpointsFromOneHertzSpeeds([7.4, 3.0, 7.5, 7.6, 3.0, 3.0, 6.0, 6.1, 3.0, 3.0]);

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              summary: createSummary({
                gpsTrackpoints: trackpoints,
                coreMetrics: {
                  ...baseCoreMetrics(),
                  sprintCount: 1,
                  highIntensityRunCount: 2
                }
              })
            })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByText('Sprint & high-intensity trackpoints')).toBeInTheDocument();

    const runEntries = screen.getAllByRole('button').filter((button) => button.textContent?.includes('Top speed:'));
    expect(runEntries).toHaveLength(3);
    runEntries.forEach((entry) => {
      expect(entry.textContent).not.toContain('(0 m)');
    });

    const sprintEntries = runEntries.filter((entry) => entry.textContent?.includes('Sprint count #'));
    const highIntensityEntries = runEntries.filter((entry) => entry.textContent?.includes('High-intensity runs #'));
    expect(sprintEntries).toHaveLength(1);
    expect(highIntensityEntries).toHaveLength(2);
  });

  it('R1_6_14_Ac04_Ac06_filters_run_types_and_keeps_independent_map_controls', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              summary: createSummary({
                gpsTrackpoints: [
                  { latitude: 50.9366, longitude: 6.9603, elapsedSeconds: 0 },
                  { latitude: 50.9366, longitude: 6.96085, elapsedSeconds: 5 },
                  { latitude: 50.9366, longitude: 6.9614, elapsedSeconds: 10 },
                  { latitude: 50.9366, longitude: 6.96182, elapsedSeconds: 15 },
                  { latitude: 50.9366, longitude: 6.96224, elapsedSeconds: 20 }
                ]
              })
            })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByRole('img', { name: 'GPS sprint and high-intensity runs map' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Only sprint phases' }));

    const runsMap = screen.getByRole('img', { name: 'GPS sprint and high-intensity runs map' });
    expect(runsMap.querySelectorAll('.gps-heatmap__run-point.gps-heatmap__run--sprint').length).toBeGreaterThan(0);
    expect(runsMap.querySelectorAll('.gps-heatmap__run-point.gps-heatmap__run--high-intensity').length).toBe(0);
    const firstRunPoint = runsMap.querySelector('.gps-heatmap__run-point') as SVGCircleElement | null;
    expect(firstRunPoint).not.toBeNull();
    expect(Number(firstRunPoint?.getAttribute('r'))).toBeLessThan(2.5);

    const runsMapContainer = runsMap.closest('.gps-runs-layout');
    expect(runsMapContainer).not.toBeNull();
    fireEvent.click(within(runsMapContainer as HTMLElement).getByRole('button', { name: 'Zoom in' }));
    const transformedRunsLayer = runsMap.querySelector('g');
    expect(transformedRunsLayer?.getAttribute('transform')).toContain('scale(1.2)');
  });


  it('R1_6_13_Ac04_resets_local_heatmap_zoom_when_switching_sessions', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({ id: 'upload-newer', fileName: 'newer.tcx', uploadedAtUtc: '2026-02-16T22:00:00.000Z' }),
            createUploadRecord({ id: 'upload-older', fileName: 'older.tcx', uploadedAtUtc: '2026-02-16T21:00:00.000Z' })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByText('GPS point heatmap')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Zoom in' })[0]);

    const heatmapBeforeSwitch = screen.getByRole('img', { name: 'GPS point heatmap' });
    const transformedLayerBeforeSwitch = heatmapBeforeSwitch.querySelector('g');
    expect(transformedLayerBeforeSwitch?.getAttribute('transform')).toContain('scale(1.2)');

    const openDetailButtons = screen.getAllByRole('button', { name: 'Open details' });
    fireEvent.click(openDetailButtons[1]);

    await waitFor(() => {
      const heatmapAfterSwitch = screen.getByRole('img', { name: 'GPS point heatmap' });
      const transformedLayerAfterSwitch = heatmapAfterSwitch.querySelector('g');
      expect(transformedLayerAfterSwitch?.getAttribute('transform')).toContain('scale(1)');
    });
  });

  it('R1_6_13_Ac05_allows_more_zoom_in_clicks_before_hitting_the_max_scale', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    expect(await screen.findByText('GPS point heatmap')).toBeInTheDocument();
    const zoomInButton = screen.getAllByRole('button', { name: 'Zoom in' })[0];

    for (let click = 0; click < 20; click += 1) {
      fireEvent.click(zoomInButton);
    }

    const heatmap = screen.getByRole('img', { name: 'GPS point heatmap' });
    const transformedLayer = heatmap.querySelector('g');
    expect(transformedLayer?.getAttribute('transform')).toContain('scale(5)');
  });

  it('R1_6_13_Ac03_hides_heatmap_and_shows_gps_missing_hint_for_hf_only_sessions', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              summary: createSummary({
                hasGpsData: false,
                gpsTrackpoints: [],
                distanceMeters: null,
                dataAvailability: {
                  mode: 'HeartRateOnly',
                  gpsStatus: 'NotMeasured',
                  gpsReason: 'GPS not present in this session.',
                  heartRateStatus: 'Available',
                  heartRateReason: null
                }
              })
            })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    await screen.findByText('No GPS coordinates were detected in this file.');
    expect(screen.queryByText('GPS point heatmap')).not.toBeInTheDocument();
  });


  it('R1_6_13_Ac05_overview_hides_gps_metrics_in_hr_only_mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              id: 'hr-only-overview',
              summary: createSummary({
                hasGpsData: false,
                gpsTrackpoints: [],
                dataAvailability: {
                  mode: 'HeartRateOnly',
                  gpsStatus: 'NotMeasured',
                  gpsReason: 'GPS not present in this session.',
                  heartRateStatus: 'Available',
                  heartRateReason: null
                }
              })
            })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);
    await screen.findByText('Session details');

    const hrOnlyOverview = screen.getByRole('heading', { name: 'Overview' }).closest('.analysis-disclosure__content') as HTMLElement;
    expect(within(hrOnlyOverview).queryByText(/Distance:/)).not.toBeInTheDocument();
    expect(within(hrOnlyOverview).getByText(/Heart rate \(min\/avg\/max\):/)).toBeInTheDocument();
  });

  it('R1_6_13_Ac06_overview_hides_hr_metrics_in_gps_only_mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            createUploadRecord({
              id: 'gps-only-overview',
              fileName: 'gps-only.tcx',
              summary: createSummary({
                heartRateMinBpm: null,
                heartRateAverageBpm: null,
                heartRateMaxBpm: null,
                dataAvailability: {
                  mode: 'GpsOnly',
                  gpsStatus: 'Available',
                  gpsReason: null,
                  heartRateStatus: 'NotMeasured',
                  heartRateReason: 'No heart-rate stream in file.'
                }
              })
            })
          ]
        } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);
    await screen.findByText('Session details');

    const gpsOnlyOverview = screen.getByRole('heading', { name: 'Overview' }).closest('.analysis-disclosure__content') as HTMLElement;
    expect(within(gpsOnlyOverview).getByText(/Distance:/)).toBeInTheDocument();
    expect(within(gpsOnlyOverview).queryByText(/Heart rate \(min\/avg\/max\):/)).not.toBeInTheDocument();
  });

    it('R1_6_14_Ac01_updates_url_and_supports_browser_history_on_navigation', async () => {
    const withSegment = createUploadRecord({
      segments: [{ id: 'seg-1', label: 'Segment A', startSecond: 0, endSecond: 300, category: 'Other', notes: 'Segment note' }]
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [withSegment] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    window.history.pushState({}, '', '/');

    render(<App />);

    await screen.findByText('Session details');
    await waitFor(() => expect(window.location.pathname).toBe('/sessions/upload-1'));
    expect(screen.getByText('Overview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Segments|Segmente/ }));
    await waitFor(() => expect(window.location.pathname).toBe('/sessions/upload-1/segments'));

    fireEvent.click(screen.getByRole('button', { name: /Compare|Vergleich/ }));
    await waitFor(() => expect(window.location.pathname).toBe('/sessions/upload-1/compare'));

    fireEvent.click(screen.getByRole('button', { name: /Analysis|Analyse/ }));
    await waitFor(() => expect(window.location.pathname).toBe('/sessions/upload-1'));

    fireEvent.click(screen.getByRole('button', { name: /Segments|Segmente/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze segment' }));
    await waitFor(() => expect(window.location.pathname).toBe('/sessions/upload-1/segments/seg-1'));
    expect(screen.getByText('Segment Overview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to segment list' }));
    await waitFor(() => expect(window.location.pathname).toBe('/sessions/upload-1/segments'));

    fireEvent.click(screen.getByRole('button', { name: 'Upload area' }));
    await waitFor(() => expect(window.location.pathname).toBe('/uploads'));

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    await waitFor(() => expect(window.location.pathname).toBe('/profiles'));

    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    await waitFor(() => expect(window.location.pathname).toBe('/sessions'));

    await act(async () => {
      window.history.back();
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => {
      expect(window.location.pathname).toBe('/profiles');
      expect(screen.getByText('Profile settings')).toBeInTheDocument();
    });
  });

  it('R1_6_14_Ac02_clicking_brand_navigates_to_start_page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
      }

      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => createProfile() } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    window.history.pushState({}, '', '/profiles');

    render(<App />);

    await screen.findByText('Profile settings');
    fireEvent.click(screen.getByText('Football Metrics'));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/sessions');
      expect(screen.getByText('Upload history')).toBeInTheDocument();
    });
  });



  it('R1_6_UXIA_Increment2_Story2_1_shows_quality_check_step_after_upload_and_allows_continue_to_analysis', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/tcx/upload')) {
        return Promise.resolve({
          ok: true,
          json: async () => createUploadRecord({
            summary: createSummary({
              qualityStatus: 'Medium',
              qualityReasons: ['GPS quality is moderate; interpret speed peaks carefully.'],
              dataAvailability: {
                mode: 'Dual',
                gpsStatus: 'AvailableWithWarning',
                gpsReason: 'GPS jitter detected in parts of the session.',
                heartRateStatus: 'Available',
                heartRateReason: null,
                gpsQualityStatus: 'Medium',
                heartRateQualityStatus: 'High'
              }
            })
          })
        } as Response);
      }

      if (url.endsWith('/tcx')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }

      if (url.endsWith('/profile')) {
        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload area' }));
    fireEvent.change(screen.getByLabelText('Select TCX file'), {
      target: { files: [new File(['<TrainingCenterDatabase></TrainingCenterDatabase>'], 'increment2.tcx', { type: 'application/xml' })] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    const qualityStep = await screen.findByTestId('upload-quality-step');
    expect(within(qualityStep).getByRole('heading', { name: 'Quality details', level: 3 })).toBeInTheDocument();
    expect(within(qualityStep).getByText(/Session data/)).toBeInTheDocument();

    expect(within(qualityStep).getByText(/Data change due to smoothing:/)).toBeInTheDocument();
    expect(within(qualityStep).queryByLabelText('Speed unit')).not.toBeInTheDocument();
    expect(screen.queryByText('Session context')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'To session analysis' }));
    await waitFor(() => {
      expect(screen.queryByTestId('upload-quality-step')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText(/Data mode:/).length).toBeGreaterThan(0);
  });

  it('R1_6_UXIA_Increment2_Story2_2_opens_persistent_quality_details_sidebar_in_session_analysis', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [
        createUploadRecord({
          summary: createSummary({
            qualityStatus: 'Low',
            qualityReasons: ['Heart-rate signal has dropouts; intensity interpretation is limited.'],
            dataAvailability: {
              mode: 'Dual',
              gpsStatus: 'Available',
              gpsReason: null,
              heartRateStatus: 'NotUsable',
              heartRateReason: 'Heart-rate channel unusable in second half.',
              gpsQualityStatus: 'High',
              heartRateQualityStatus: 'Low'
            }
          })
        })
      ]
    } as Response);

    render(<App />);

    await screen.findByText('Session details');
    fireEvent.click(screen.getAllByRole('button', { name: 'Quality info' })[0]);

    const qualitySidebar = await screen.findByTestId('quality-details-sidebar');
    expect(within(qualitySidebar).getByRole('heading', { name: 'Quality details', level: 3 })).toBeInTheDocument();
    expect(within(qualitySidebar).getByText(/Data quality:/)).toBeInTheDocument();
    expect(within(qualitySidebar).getByText(/Warning: Quality is reduced in at least one channel/)).toBeInTheDocument();
    expect(within(qualitySidebar).queryByLabelText('Speed unit')).not.toBeInTheDocument();
    expect(within(qualitySidebar).getAllByText(/Heart-rate signal has dropouts/).length).toBeGreaterThan(0);
  });


  it('R1_6_UXIA_Increment2_allows_deleting_a_session_from_danger_zone', async () => {
    const first = createUploadRecord({ id: 'delete-me', fileName: 'delete-me.tcx' });
    const second = createUploadRecord({ id: 'keep-me', fileName: 'keep-me.tcx', uploadedAtUtc: '2026-02-16T23:00:00.000Z' });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [first, second] } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }
      if (url.endsWith('/tcx/delete-me') && init?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, text: async () => '' } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    await screen.findByText('Session details');
    const sessionList = document.getElementById('session-list') as HTMLElement;
    const deleteMeRow = within(sessionList).getByText('delete-me.tcx').closest('tr') as HTMLElement;
    fireEvent.click(within(deleteMeRow).getByRole('button', { name: 'Open details' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));

    await waitFor(() => {
      expect(screen.getByText('Session deleted successfully.')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/sessions');
    });
    expect(screen.getByText('Upload history')).toBeInTheDocument();
  });


  it('R1_6_UXIA_Increment2_keeps_new_upload_selected_instead_of_switching_back_to_previous_session', async () => {
    const oldSession = createUploadRecord({ id: 'old-session', fileName: 'old-session.tcx' });
    const newUpload = createUploadRecord({ id: 'new-session', fileName: 'new-session.tcx' });

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [oldSession] } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }
      if (url.endsWith('/tcx/upload')) {
        return Promise.resolve({ ok: true, json: async () => newUpload } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    await screen.findByText('Session details');
    fireEvent.click(screen.getByRole('button', { name: 'Upload area' }));
    fireEvent.change(screen.getByLabelText('Select TCX file'), {
      target: { files: [new File(['<TrainingCenterDatabase></TrainingCenterDatabase>'], 'new-session.tcx', { type: 'application/xml' })] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(screen.getAllByText('new-session.tcx').length).toBeGreaterThan(0);
      expect(window.location.pathname).toBe('/sessions/new-session');
    });
  });

  it('R1_6_UXIA_Increment2_refresh_on_sessions_list_stays_on_sessions_list', async () => {
    window.history.pushState({}, '', '/sessions');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [createUploadRecord({ id: 'existing', fileName: 'existing.tcx' })] } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    await screen.findByText('Upload history');
    expect(window.location.pathname).toBe('/sessions');
  });


  it('R1_6_UXIA_Increment2_upload_from_compare_always_returns_to_analysis_subpage', async () => {
    const oldSession = createUploadRecord({ id: 'old-session', fileName: 'old-session.tcx' });
    const compareSession = createUploadRecord({ id: 'compare-session', fileName: 'compare-session.tcx', uploadedAtUtc: '2026-02-16T23:10:00.000Z' });
    const newUpload = createUploadRecord({ id: 'new-session', fileName: 'new-session.tcx' });

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/tcx') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => [oldSession, compareSession] } as Response);
      }
      if (url.endsWith('/profile') && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }
      if (url.endsWith('/tcx/upload')) {
        return Promise.resolve({ ok: true, json: async () => newUpload } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    render(<App />);

    await screen.findByText('Session details');
    fireEvent.click(screen.getByRole('button', { name: /Compare|Vergleich/ }));
    await waitFor(() => expect(window.location.pathname).toBe('/sessions/old-session/compare'));

    fireEvent.click(screen.getByRole('button', { name: 'Upload area' }));
    fireEvent.change(screen.getByLabelText('Select TCX file'), {
      target: { files: [new File(['<TrainingCenterDatabase></TrainingCenterDatabase>'], 'new-session.tcx', { type: 'application/xml' })] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/sessions/new-session');
    });
    const qualityStep = await screen.findByTestId('upload-quality-step');
    expect(within(qualityStep).getByRole('heading', { name: 'Quality details', level: 3 })).toBeInTheDocument();
  });

});
