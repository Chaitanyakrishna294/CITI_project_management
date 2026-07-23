import { describe, it, expect } from 'vitest';
import { parseCsv, mapImportRow, KNOWN_COLUMNS } from '../utils/importCsv';

describe('parseCsv', () => {
  it('splits headers and rows on plain input', () => {
    expect(parseCsv('name,status\nAlpha,active')).toEqual({
      headers: ['name', 'status'],
      rows: [['Alpha', 'active']],
    });
  });

  it('keeps commas inside quoted fields', () => {
    const { rows } = parseCsv('name,notes\nAlpha,"one, two, three"');
    expect(rows).toEqual([['Alpha', 'one, two, three']]);
  });

  it('unescapes doubled quotes', () => {
    const { rows } = parseCsv('name\n"say ""hi"" twice"');
    expect(rows).toEqual([['say "hi" twice']]);
  });

  it('keeps newlines inside quoted fields', () => {
    const { rows } = parseCsv('name,notes\nAlpha,"line one\nline two"');
    expect(rows).toEqual([['Alpha', 'line one\nline two']]);
  });

  it('strips a UTF-8 BOM before the first header', () => {
    const { headers } = parseCsv('﻿name,status\nAlpha,active');
    expect(headers).toEqual(['name', 'status']);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('name,status\r\nAlpha,active\r\nBeta,delayed')).toEqual({
      headers: ['name', 'status'],
      rows: [
        ['Alpha', 'active'],
        ['Beta', 'delayed'],
      ],
    });
  });

  it('skips fully-empty lines, including the blank trailing one', () => {
    const { rows } = parseCsv('name\nAlpha\n\nBeta\n');
    expect(rows).toEqual([['Alpha'], ['Beta']]);
  });

  it('returns empty headers and rows for empty text', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });
});

// The mapImportRow cases below are the self_test() assertions from
// data/import_projects.py, ported verbatim.
describe('mapImportRow', () => {
  it('aliases headers, preserves unknown status and manager, routes extras to metadata', () => {
    const headers = ['Project Name', 'Manager', 'Status', 'Client Contact', 'Region', 'Start Date'];
    const row = ['Website Revamp', 'Alice Smith', 'In Progress', 'bob@client.com', 'EMEA', '2026-01-05'];
    const { record, metadata } = mapImportRow(headers, row, { defaultManagerId: 7 });
    expect(record.name).toBe('Website Revamp');
    expect(record.manager_id).toBe(7);
    expect(metadata.original_manager).toBe('Alice Smith');
    expect(record.status).toBeNull();
    expect(metadata.original_status).toBe('In Progress');
    expect(record.start_date).toBe('2026-01-05');
    expect(record.description).toBeNull(); // missing -> null
    expect(record.end_date).toBeNull();
    expect(metadata['Client Contact']).toBe('bob@client.com');
    expect(metadata.Region).toBe('EMEA');
  });

  it('passes numeric manager_id and valid status straight through; empty cells drop out', () => {
    const { record, metadata } = mapImportRow(
      ['name', 'manager_id', 'status', 'notes'],
      ['X', '3', 'Active', ''],
    );
    expect(record.manager_id).toBe(3);
    expect(record.status).toBe('active');
    expect(metadata).toEqual({});
  });

  it('nulls every known column absent from the file', () => {
    const { record } = mapImportRow(['name'], ['Solo']);
    for (const column of KNOWN_COLUMNS.filter((c) => c !== 'name')) {
      expect(record[column]).toBeNull();
    }
    expect(record.manager_id).toBeNull(); // defaultManagerId defaults to null
  });
});
