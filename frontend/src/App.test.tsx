import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders bilingual upload title and disabled upload button by default', () => {
    render(<App />);

    expect(screen.getByText('Football Metrics – TCX Upload')).toBeInTheDocument();
    expect(screen.getByText(/Maximum file size: 20 MB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload / Hochladen' })).toBeDisabled();
  });

  it('shows validation message for non-tcx files', () => {
    render(<App />);

    const fileInput = screen.getByLabelText('Select TCX file / TCX-Datei auswählen');
    const invalidFile = new File(['fake-content'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(screen.getByText(/Only \.tcx files are allowed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload / Hochladen' })).toBeDisabled();
  });

  it('enables submit for valid tcx files', () => {
    render(<App />);

    const fileInput = screen.getByLabelText('Select TCX file / TCX-Datei auswählen');
    const validFile = new File(['<TrainingCenterDatabase></TrainingCenterDatabase>'], 'session.tcx', {
      type: 'application/xml'
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(screen.getByRole('button', { name: 'Upload / Hochladen' })).toBeEnabled();
  });
});
