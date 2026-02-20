import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('UI redesign - IA structure', () => {
  it('R1_6_UI_IA_AC01_starts_on_session_list_and_allows_filtering', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Session-Liste' })).toBeInTheDocument();
    expect(screen.getByText('Ligaspiel vs. Blau-Weiß')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Qualität'), { target: { value: 'Medium' } });

    expect(screen.getByText('Abschlusstraining')).toBeInTheDocument();
    expect(screen.queryByText('Ligaspiel vs. Blau-Weiß')).not.toBeInTheDocument();
  });

  it('R1_6_UI_IA_AC02_supports_mobile_subpages_via_bottom_navigation', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(screen.getByRole('heading', { name: 'Upload-Flow' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Analyse' }));
    expect(screen.getByRole('heading', { name: 'Session-Analyse' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Segmente' }));
    expect(screen.getByRole('heading', { name: 'Segment-Analyse' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vergleich' }));
    expect(screen.getByRole('heading', { name: 'Vergleich' })).toBeInTheDocument();
  });

  it('R1_6_UI_IA_AC03_supports_light_dark_toggle_in_profile', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Profil' }));
    expect(screen.getByRole('heading', { name: 'Profil & Einstellungen' })).toBeInTheDocument();

    const appRoot = screen.getByText('Football-Metriken').closest('.fm-app');
    expect(appRoot).toHaveAttribute('data-theme', 'dark');

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(appRoot).toHaveAttribute('data-theme', 'light');

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(appRoot).toHaveAttribute('data-theme', 'dark');
  });
});
