import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders english UI by default as browser language fallback', () => {
    render(<App />);

    expect(screen.getByText('Football Metrics – TCX Upload')).toBeInTheDocument();
    expect(screen.getByText('Maximum file size: 20 MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('switches language to german', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });

    expect(screen.getByLabelText('Sprache')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hochladen' })).toBeDisabled();
    expect(screen.getByText('Maximale Dateigröße: 20 MB.')).toBeInTheDocument();
  });

  it('shows validation message for non-tcx files in current language', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });

    const fileInput = screen.getByLabelText('TCX-Datei auswählen');
    const invalidFile = new File(['fake-content'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(screen.getByText('Nur .tcx-Dateien sind erlaubt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hochladen' })).toBeDisabled();
  });

  it('enables submit for valid tcx files', () => {
    render(<App />);

    const fileInput = screen.getByLabelText('Select TCX file');
    const validFile = new File(['<TrainingCenterDatabase></TrainingCenterDatabase>'], 'session.tcx', {
      type: 'application/xml'
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
  });
});
