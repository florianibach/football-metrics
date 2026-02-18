import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
        SprintSpeedThresholdMps: '7.0',
        HighIntensitySpeedThresholdMps: '5.5',
        AccelerationThresholdMps2: '2.0',
        DecelerationThresholdMps2: '-2.0'
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
        sprintSpeedThresholdMps: 7.0,
        highIntensitySpeedThresholdMps: 5.5,
        accelerationThresholdMps2: 2.0,
        decelerationThresholdMps2: -2.0,
        version: 1,
        updatedAtUtc: '2026-02-16T22:00:00.000Z'
      },
      defaultSmoothingFilter: 'AdaptiveMedian',
      ...overrides
    };
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
      appliedProfileSnapshot: {
        thresholdVersion: 1,
        thresholdUpdatedAtUtc: '2026-02-16T22:00:00.000Z',
        smoothingFilter: 'AdaptiveMedian',
        capturedAtUtc: '2026-02-16T22:00:00.000Z'
      },
      recalculationHistory: [],
      ...overrides
    };
  }



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
    expect(fetchMock).toHaveBeenCalledWith('/api/tcx/upload-1/recalculate', expect.objectContaining({ method: 'POST' }));
  });

  it('Mvp01_Ac01_renders english UI by default as browser language fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);

    render(<App />);

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

    expect(screen.getByText('Session details')).toBeInTheDocument();
    expect(screen.getByText(/Heart rate \(min\/avg\/max\):/)).toBeInTheDocument();
    expect(screen.getAllByText(/5.100 km \(5,100(\.0)? m\)/).length).toBeGreaterThan(0);
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

    fireEvent.change(screen.getByLabelText('Sort by upload time'), { target: { value: 'asc' } });

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

    fireEvent.click(screen.getAllByRole('button', { name: 'Open details' })[1]);

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

    expect(screen.getByText(/Duration:/)).toBeInTheDocument();
    expect(screen.getByText(/61 min 1 s/)).toBeInTheDocument();
    expect(screen.getByText(/Heart rate \(min\/avg\/max\):/)).toBeInTheDocument();
    expect(screen.getByText(/110\/142\/178 bpm/)).toBeInTheDocument();
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
    expect(screen.getByText(/Heart rate \(min\/avg\/max\):/)).toBeInTheDocument();
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
          SprintSpeedThresholdMps: '7.0',
          HighIntensitySpeedThresholdMps: '5.5',
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
          SprintSpeedThresholdMps: '7.0',
          HighIntensitySpeedThresholdMps: '5.5',
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
          SprintSpeedThresholdMps: '7.0',
          HighIntensitySpeedThresholdMps: '5.5',
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
                SprintSpeedThresholdMps: '7.0',
                HighIntensitySpeedThresholdMps: '5.5',
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
      expect(screen.getByText('Football core metrics (v1)')).toBeInTheDocument();
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
                SprintSpeedThresholdMps: '7.0',
                HighIntensitySpeedThresholdMps: '5.5',
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
    expect(screen.getByText(/Data quality:/)).toBeInTheDocument();
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

    const distanceInfo = screen.getAllByRole('note', { name: 'Distance explanation' })[0];
    expect(distanceInfo).toBeInTheDocument();
    expect(distanceInfo).toHaveAttribute('title', expect.stringContaining('Purpose: quantifies covered ground'));
    expect(distanceInfo).toHaveAttribute('title', expect.stringContaining('Unit: km and m'));

    const sprintDistanceInfo = screen.getByRole('note', { name: 'Sprint distance explanation' });
    expect(sprintDistanceInfo).toHaveAttribute('title', expect.stringContaining('Very low values usually mean little sprint exposure'));
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
                SprintSpeedThresholdMps: '7.0'
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

    const sprintDistanceInfoDe = screen.getByRole('note', { name: 'Anzahl Sprints explanation' });
    expect(sprintDistanceInfoDe).toHaveAttribute('title', expect.stringContaining('0-2 niedrig, 3-6 mittel, >6 hoch'));

    const trimpInfoDe = screen.getByRole('note', { name: 'TRIMP (Edwards) explanation' });
    expect(trimpInfoDe).toHaveAttribute('title', expect.stringContaining('40-80 mittel'));

    const recoveryInfoDe = screen.getByRole('note', { name: 'HF-Erholung nach 60s explanation' });
    expect(recoveryInfoDe).toHaveAttribute('title', expect.stringContaining('12-20 mittel, >20 gut'));
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
          summary: createSummary({ qualityStatus: 'High' })
        }),
        createUploadRecord({
          id: 'compare',
          fileName: 'compare-session.tcx',
          uploadedAtUtc: '2026-02-16T21:00:00.000Z',
          summary: createSummary({
            qualityStatus: 'Low',
            durationSeconds: 2100,
            coreMetrics: {
              ...baseCoreMetrics(),
              distanceMeters: 6200,
              sprintDistanceMeters: 1200,
              sprintCount: 6,
              highIntensityTimeSeconds: 420,
              trainingImpulseEdwards: 95.0
            }
          })
        }),
        createUploadRecord({
          id: 'third',
          fileName: 'third-session.tcx',
          uploadedAtUtc: '2026-02-16T22:00:00.000Z',
          summary: createSummary({ qualityStatus: 'Medium' })
        })
      ]
    } as Response);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session comparison')).toBeInTheDocument());

    const compareCheckboxes = screen.getAllByRole('checkbox', { name: /Select for comparison/ });
    expect(compareCheckboxes.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('checkbox', { name: 'Select for comparison: base-session.tcx' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select for comparison: compare-session.tcx' })).toBeChecked();

    expect(screen.getByText('Quality warning: selected sessions have different data quality. Compare with caution to avoid misinterpretation.')).toBeInTheDocument();
    expect(screen.getByText(/\(baseline\)$/)).toBeInTheDocument();
    expect(screen.getAllByText(/Delta vs baseline:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Delta \(%\) vs baseline:/).length).toBeGreaterThan(0);

    const baselineSelector = screen.getByLabelText('Baseline session');
    expect(within(baselineSelector).getByRole('option', { name: 'base-session.tcx' })).toBeInTheDocument();
    fireEvent.change(baselineSelector, { target: { value: 'compare' } });
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'compare-session.tcx (baseline)' })).toBeInTheDocument());

    const comparisonTable = screen.getAllByRole('table')[1];
    expect(within(comparisonTable).getByText('Distance')).toBeInTheDocument();
    expect(within(comparisonTable).getByText('Duration')).toBeInTheDocument();
    expect(within(comparisonTable).getByText('TRIMP (Edwards)')).toBeInTheDocument();

    fireEvent.click(compareCheckboxes[1]);
    await waitFor(() => expect(screen.queryByText('Quality warning: selected sessions have different data quality. Compare with caution to avoid misinterpretation.')).not.toBeInTheDocument());
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
    expect(screen.getByText('Windows: 2')).toBeInTheDocument();
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
    expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PUT' }));
  });


  it('R1_5_05_Ac01_Ac04_shows_editable_thresholds_in_profile_and_session_thresholds', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/profile')) {
        return Promise.resolve({ ok: true, json: async () => createProfile({ metricThresholds: { sprintSpeedThresholdMps: 7.8, highIntensitySpeedThresholdMps: 6.2, accelerationThresholdMps2: 2.4, decelerationThresholdMps2: -2.8, version: 3, updatedAtUtc: '2026-02-16T22:00:00.000Z' } }) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [createUploadRecord()] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Metric thresholds')).toBeInTheDocument());
    expect((screen.getByLabelText('Sprint speed threshold (m/s)') as HTMLInputElement).value).toBe('7.8');
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
        if (body.metricThresholds?.sprintSpeedThresholdMps === 3) {
          return Promise.resolve({ ok: false, text: async () => 'SprintSpeedThresholdMps must be between 4.0 and 12.0.' } as Response);
        }

        return Promise.resolve({ ok: true, json: async () => createProfile({ metricThresholds: { ...body.metricThresholds, version: 2, updatedAtUtc: '2026-02-17T12:00:00.000Z' } }) } as Response);
      }

      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Profile settings')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Sprint speed threshold (m/s)'), { target: { value: '3.0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.getByText(/Upload failed:/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Sprint speed threshold (m/s)'), { target: { value: '8.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PUT' }));
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
    expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PUT' }));
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
    expect(screen.getByText('Profile default')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Open details' })[1]);
    await waitFor(() => expect(screen.getByText('Manual override')).toBeInTheDocument());
  });


  it('R1_5_06_Ac01_Ac02_Ac03_separates_external_and_internal_metrics_with_explanations', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [createUploadRecord()]
    } as Response);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Football core metrics (v1)')).toBeInTheDocument());

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

});
