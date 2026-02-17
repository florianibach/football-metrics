import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Mvp01_Ac01_renders english UI by default as browser language fallback', () => {
    render(<App />);

    expect(screen.getByText('Football Metrics – TCX Upload')).toBeInTheDocument();
    expect(screen.getByText('Maximum file size: 20 MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('Mvp01_Ac01_accepts file via drag and drop', () => {
    render(<App />);

    const validFile = new File(['<TrainingCenterDatabase></TrainingCenterDatabase>'], 'session.tcx', {
      type: 'application/xml'
    });

    const dropzoneText = screen.getByText('Drag & drop a TCX file here or choose one.');
    const dropzone = dropzoneText.closest('label');

    expect(dropzone).not.toBeNull();
    fireEvent.drop(dropzone!, { dataTransfer: { files: [validFile] } });

    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
  });

  it('Mvp01_Ac02_switches language to german', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });

    expect(screen.getByLabelText('Sprache')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hochladen' })).toBeDisabled();
    expect(screen.getByText('Maximale Dateigröße: 20 MB.')).toBeInTheDocument();
  });

  it('Mvp01_Ac02_shows validation message for non-tcx files in current language', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });

    const fileInput = screen.getByLabelText('TCX-Datei auswählen');
    const invalidFile = new File(['fake-content'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(screen.getByText('Nur .tcx-Dateien sind erlaubt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hochladen' })).toBeDisabled();
  });

  it('Mvp01_Ac03_shows validation message for oversized files', () => {
    render(<App />);

    const fileInput = screen.getByLabelText('Select TCX file');
    const oversizedBytes = new Uint8Array(20 * 1024 * 1024 + 1);
    const oversizedFile = new File([oversizedBytes], 'large.tcx', { type: 'application/xml' });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(screen.getByText('File is too large (max 20 MB).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('Mvp01_Ac04_shows success message including filename and upload time', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'upload-1',
        fileName: 'session.tcx',
        uploadedAtUtc: '2026-02-16T22:00:00.000Z'
      })
    } as Response);

    render(<App />);

    const fileInput = screen.getByLabelText('Select TCX file');
    const validFile = new File(
      ['<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>'],
      'session.tcx',
      { type: 'application/xml' }
    );

    fireEvent.change(fileInput, { target: { files: [validFile] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(screen.getByText(/Upload successful: session\.tcx at/)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Mvp01_Ac04_prevents_double_submit_while_upload_is_running', async () => {
    let resolveRequest: (value: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(pendingResponse);

    render(<App />);

    const fileInput = screen.getByLabelText('Select TCX file');
    const validFile = new File(
      ['<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint /></Track></Lap></Activity></Activities></TrainingCenterDatabase>'],
      'session.tcx',
      { type: 'application/xml' }
    );

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const uploadButton = screen.getByRole('button', { name: 'Upload' });
    fireEvent.click(uploadButton);
    fireEvent.click(uploadButton);

    expect(screen.getByText('Upload in progress...')).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();

    resolveRequest!({
      ok: true,
      json: async () => ({ id: 'upload-1', fileName: 'session.tcx', uploadedAtUtc: '2026-02-16T22:00:00.000Z' })
    } as Response);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Upload successful: session\.tcx at/)).toBeInTheDocument();
    });
  });

  it('Mvp01_Ac01_enables submit for valid tcx files', () => {
    render(<App />);

    const fileInput = screen.getByLabelText('Select TCX file');
    const validFile = new File(['<TrainingCenterDatabase></TrainingCenterDatabase>'], 'session.tcx', {
      type: 'application/xml'
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
  });
});
