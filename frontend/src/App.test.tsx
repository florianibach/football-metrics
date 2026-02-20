import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App redesign', () => {
  it('R1_5_IA_AC01_shows_session_list_as_mobile_first_start_page', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /Finden & Starten|Find & Start/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abendtraining 7v7/i })).toBeInTheDocument();
  });

  it('R1_5_IA_AC02_supports_upload_quality_analysis_flow_navigation', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Upload/i }));
    expect(screen.getByRole('heading', { name: /Upload/i })).toBeInTheDocument();
    expect(screen.getByText(/Qualitätsübersicht|Quality summary/i)).toBeInTheDocument();
  });

  it('R1_5_IA_AC03_exposes_dark_light_mode_toggle_in_profile', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Profil|Profile/i }));
    const modeSelect = screen.getByLabelText(/Designmodus|Theme mode/i);
    fireEvent.change(modeSelect, { target: { value: 'light' } });

    expect(screen.getByDisplayValue(/Hell|Light/i)).toBeInTheDocument();
  });

  it('R1_5_IA_AC04_provides_metric_component_recommendations_with_implementation_text', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Profil|Profile/i }));
    expect(screen.getByText(/Progress bar with target marker/i)).toBeInTheDocument();
    expect(screen.getByText(/Ring gauge/i)).toBeInTheDocument();
  });
});
