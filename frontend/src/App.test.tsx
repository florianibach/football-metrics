import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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
      smoothing: {
        selectedStrategy: 'FootballAdaptiveMedian',
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

  function createUploadRecord(overrides?: Partial<Record<string, unknown>>) {
    return {
      id: 'upload-1',
      fileName: 'session.tcx',
      uploadedAtUtc: '2026-02-16T22:00:00.000Z',
      summary: createSummary(),
      ...overrides
    };
  }

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
    expect(screen.getByText(/5.1 km/)).toBeInTheDocument();
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
    expect(screen.getByText('session-2.tcx')).toBeInTheDocument();
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
      expect(screen.getByText('new.tcx')).toBeInTheDocument();
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
    expect(screen.getByText(/FootballAdaptiveMedian/)).toBeInTheDocument();
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

});
