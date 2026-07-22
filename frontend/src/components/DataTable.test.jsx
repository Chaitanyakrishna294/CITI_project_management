import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, within } from '../test/test-utils';
import DataTable from './DataTable';
import { toCsv } from '../utils/csv';

const COLUMNS = [
  { id: 'name', label: 'Name' },
  { id: 'amount', label: 'Amount', align: 'right', sortValue: (r) => Number(r.amount) },
  { id: 'status', label: 'Status', render: (r) => <span>{r.status.toUpperCase()}</span> },
];

const ROWS = [
  { id: 1, name: 'Beta', amount: '90.00', status: 'active' },
  { id: 2, name: 'Alpha', amount: '1000.00', status: 'delayed' },
  { id: 3, name: 'Gamma', amount: '250.00', status: 'active' },
];

function bodyRowTexts() {
  const [, ...bodyRows] = screen.getAllByRole('row');
  return bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent);
}

describe('DataTable', () => {
  it('renders a row per record using render functions where provided', () => {
    renderWithAuth(<DataTable columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    // Two rows are 'active', so the render function ran for each of them.
    expect(screen.getAllByText('ACTIVE', { selector: 'span' })).toHaveLength(2);
    expect(screen.getByText('DELAYED', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1); // + header
  });

  it('sorts by the default column ascending and toggles to descending on click', async () => {
    const user = userEvent.setup();
    renderWithAuth(<DataTable columns={COLUMNS} rows={ROWS} defaultOrderBy="name" />);

    expect(bodyRowTexts()).toEqual(['Alpha', 'Beta', 'Gamma']);

    await user.click(screen.getByRole('button', { name: /name/i }));
    expect(bodyRowTexts()).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('sorts numerically when the column supplies a numeric sortValue', async () => {
    const user = userEvent.setup();
    renderWithAuth(<DataTable columns={COLUMNS} rows={ROWS} defaultOrderBy="name" />);

    await user.click(screen.getByRole('button', { name: /amount/i }));

    // Lexicographic order would put '1000.00' before '250.00'.
    expect(bodyRowTexts()).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  it('does not render a sort control for columns marked sortable: false', () => {
    renderWithAuth(
      <DataTable columns={[...COLUMNS, { id: 'x', label: 'Actions', sortable: false }]} rows={ROWS} />
    );

    expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
  });

  it('paginates once there are more rows than the smallest page size', async () => {
    const user = userEvent.setup();
    const manyRows = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      name: `Row ${String(i).padStart(2, '0')}`,
      amount: '1',
      status: 'active',
    }));

    renderWithAuth(
      <DataTable columns={COLUMNS} rows={manyRows} defaultOrderBy="name" rowsPerPageOptions={[10, 25]} />
    );

    expect(bodyRowTexts()).toHaveLength(10);
    expect(screen.getByText('Row 09')).toBeInTheDocument();
    expect(screen.queryByText('Row 10')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go to next page/i }));
    expect(bodyRowTexts()).toEqual(['Row 10', 'Row 11']);
  });

  it('hides pagination when everything fits on one page', () => {
    renderWithAuth(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.queryByRole('button', { name: /go to next page/i })).not.toBeInTheDocument();
  });

  it('clamps the page when the row set shrinks under the current page', async () => {
    const user = userEvent.setup();
    const manyRows = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      name: `Row ${String(i).padStart(2, '0')}`,
      amount: '1',
      status: 'active',
    }));

    const { rerender } = renderWithAuth(
      <DataTable columns={COLUMNS} rows={manyRows} defaultOrderBy="name" rowsPerPageOptions={[10, 25]} />
    );
    await user.click(screen.getByRole('button', { name: /go to next page/i }));
    expect(bodyRowTexts()).toEqual(['Row 10', 'Row 11']);

    // Filtering away the second page must not strand the user on an empty view.
    rerender(
      <DataTable
        columns={COLUMNS}
        rows={manyRows.slice(0, 3)}
        defaultOrderBy="name"
        rowsPerPageOptions={[10, 25]}
      />
    );
    expect(bodyRowTexts()).toEqual(['Row 00', 'Row 01', 'Row 02']);
  });

  it('shows the empty message instead of rows when there is no data', () => {
    renderWithAuth(<DataTable columns={COLUMNS} rows={[]} emptyMessage="Nothing matched." />);
    expect(screen.getByText('Nothing matched.')).toBeInTheDocument();
  });

  it('renders the toolbar, title and actions when supplied', () => {
    renderWithAuth(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        title="Projects"
        toolbar={<span>filters here</span>}
        actions={<button type="button">New</button>}
      />
    );

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('filters here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('does not offer export unless an export filename is configured', () => {
    renderWithAuth(<DataTable columns={COLUMNS} rows={ROWS} title="Projects" />);
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });

  describe('CSV export', () => {
    let clickSpy;

    beforeEach(() => {
      global.URL.createObjectURL = vi.fn(() => 'blob:mock');
      global.URL.revokeObjectURL = vi.fn();
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });

    afterEach(() => {
      clickSpy.mockRestore();
    });

    it('downloads a CSV named after exportFilename', async () => {
      const user = userEvent.setup();
      renderWithAuth(<DataTable columns={COLUMNS} rows={ROWS} exportFilename="projects.csv" />);

      await user.click(screen.getByRole('button', { name: /export/i }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
    });

    it('disables export when there is nothing to export', () => {
      renderWithAuth(<DataTable columns={COLUMNS} rows={[]} exportFilename="projects.csv" />);
      expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();
    });
  });
});

describe('toCsv', () => {
  it('emits a header row followed by one row per record', () => {
    expect(toCsv(COLUMNS, ROWS.slice(0, 1))).toBe('Name,Amount,Status\nBeta,90.00,active');
  });

  it('prefers exportValue over the rendered cell', () => {
    const columns = [{ id: 'flag', label: 'At Risk', exportValue: (r) => (r.flag ? 'Yes' : 'No') }];
    expect(toCsv(columns, [{ flag: true }, { flag: false }])).toBe('At Risk\nYes\nNo');
  });

  it('exports the underlying field rather than a normalised sort key', () => {
    const columns = [{ id: 'name', label: 'Name', sortValue: (r) => r.name.toLowerCase() }];
    expect(toCsv(columns, [{ name: 'Alpha Project' }])).toBe('Name\nAlpha Project');
  });

  it('quotes values containing commas, quotes or newlines', () => {
    const columns = [{ id: 'name', label: 'Name' }];
    const rows = [{ name: 'Smith, John' }, { name: 'He said "hi"' }, { name: 'line1\nline2' }];
    expect(toCsv(columns, rows)).toBe(
      'Name\n"Smith, John"\n"He said ""hi"""\n"line1\nline2"'
    );
  });

  it('renders null and undefined as empty cells', () => {
    const columns = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    expect(toCsv(columns, [{ a: null, b: undefined }])).toBe('A,B\n,');
  });

  it('omits columns marked exportable: false', () => {
    const columns = [
      { id: 'name', label: 'Name' },
      { id: 'actions', label: 'Actions', exportable: false },
    ];
    expect(toCsv(columns, [{ name: 'Alpha', actions: 'x' }])).toBe('Name\nAlpha');
  });
});
