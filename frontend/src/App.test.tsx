import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders upload title and disabled upload button by default', () => {
    render(<App />);

    expect(screen.getByText('Football Metrics – TCX Upload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hochladen' })).toBeDisabled();
  });
});
