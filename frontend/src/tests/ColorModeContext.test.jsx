import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { ColorModeProvider, useColorMode } from '../contexts/ColorModeContext';

function Probe() {
  const { mode, toggleMode } = useColorMode();
  return (
    <button type="button" onClick={toggleMode}>
      mode: {mode}
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('ColorModeProvider', () => {
  it('defaults to light and toggles to dark, persisting the choice', async () => {
    const user = userEvent.setup();
    render(
      <ColorModeProvider>
        <Probe />
      </ColorModeProvider>
    );

    // The matchMedia stub only matches min-width queries, so the OS
    // preference resolves to light.
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('mode: light');

    await user.click(button);
    expect(button).toHaveTextContent('mode: dark');
    expect(localStorage.getItem('citi_color_mode')).toBe('dark');

    await user.click(button);
    expect(button).toHaveTextContent('mode: light');
    expect(localStorage.getItem('citi_color_mode')).toBe('light');
  });

  it('honours a stored preference over the OS default', () => {
    localStorage.setItem('citi_color_mode', 'dark');
    render(
      <ColorModeProvider>
        <Probe />
      </ColorModeProvider>
    );
    expect(screen.getByRole('button')).toHaveTextContent('mode: dark');
  });

  it('follows the OS dark preference on first visit', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      media: query,
      matches: query.includes('prefers-color-scheme: dark'),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    render(
      <ColorModeProvider>
        <Probe />
      </ColorModeProvider>
    );
    expect(screen.getByRole('button')).toHaveTextContent('mode: dark');
  });

  it('falls back to a light no-op outside the provider', () => {
    render(<Probe />);
    expect(screen.getByRole('button')).toHaveTextContent('mode: light');
  });
});
