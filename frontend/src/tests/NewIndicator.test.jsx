import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NewIndicator from '../components/NewIndicator';
import { isNew } from '../utils/recency';

describe('isNew', () => {
  it('is true for a timestamp within the last 24 hours', () => {
    expect(isNew(new Date(Date.now() - 60 * 60 * 1000).toISOString())).toBe(true);
  });

  it('accepts the Postgres space-separated timestamp format', () => {
    const d = new Date(Date.now() - 60 * 60 * 1000);
    const pg = d.toISOString().replace('T', ' ');
    expect(isNew(pg)).toBe(true);
  });

  it('is false beyond the window, for garbage, and for missing values', () => {
    expect(isNew(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString())).toBe(false);
    expect(isNew('not a date')).toBe(false);
    expect(isNew(null)).toBe(false);
    expect(isNew(undefined)).toBe(false);
  });

  it('tolerates a client clock lagging the server by a few minutes', () => {
    expect(isNew(new Date(Date.now() + 2 * 60 * 1000).toISOString())).toBe(true);
    expect(isNew(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe(false);
  });
});

describe('NewIndicator', () => {
  it('renders an accessible "New" marker for a fresh record', () => {
    render(<NewIndicator createdAt={new Date().toISOString()} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders nothing for an old record', () => {
    const { container } = render(
      <NewIndicator createdAt={new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
