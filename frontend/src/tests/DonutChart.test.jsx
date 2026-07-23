import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithAuth, screen } from '../test/test-utils';
import DonutChart from '../components/charts/DonutChart';

const SLICES = [
  { label: 'Completed', value: 6, color: '#15803d' },
  { label: 'In progress', value: 3, color: '#194391' },
  { label: 'Blocked', value: 1, color: '#b91c1c' },
];

describe('DonutChart', () => {
  it('shows the total in the centre and draws one segment per non-zero slice', () => {
    const { container } = renderWithAuth(
      <DonutChart slices={SLICES} centerLabel="deliverables" />
    );

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('deliverables')).toBeInTheDocument();
    expect(container.querySelectorAll('.donut-segment')).toHaveLength(SLICES.length);
  });

  it('swaps the centre to the hovered segment and restores the total on leave', () => {
    const onSliceHover = vi.fn();
    const { container } = renderWithAuth(
      <DonutChart slices={SLICES} centerLabel="deliverables" onSliceHover={onSliceHover} />
    );

    const [completed] = container.querySelectorAll('.donut-segment');
    fireEvent.mouseEnter(completed);

    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('60% of total')).toBeInTheDocument();
    expect(onSliceHover).toHaveBeenCalledWith(expect.objectContaining({ label: 'Completed' }));

    fireEvent.mouseLeave(container.firstChild);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByText('60% of total')).not.toBeInTheDocument();
    expect(onSliceHover).toHaveBeenLastCalledWith(null);
  });

  it('skips zero-value slices entirely', () => {
    const { container } = renderWithAuth(
      <DonutChart
        slices={[...SLICES, { label: 'Not started', value: 0, color: '#64748b' }]}
        centerLabel="deliverables"
      />
    );
    expect(container.querySelectorAll('.donut-segment')).toHaveLength(SLICES.length);
  });
});
