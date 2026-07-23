"""
Import existing projects from an Excel (.xlsx) or CSV file into the projects table.

Column handling:
  - Headers matching a projects column (after lowercasing, trimming, spaces -> _,
    plus a few aliases like "project name") map onto that column.
  - Every other column lands in the JSONB `metadata` column, keyed by its
    original header.
  - Known columns absent from the file are inserted as NULL (None).

Usage:
    python import_projects.py projects.xlsx --manager-id 1
    python import_projects.py --self-test

Connection comes from POSTGRES_HOST/PORT/USER/PASS/NAME env vars (same names the
backend uses), defaulting to the local dev database.
"""

import argparse
import csv
import datetime
import json
import os
import sys

# Columns the website's projects table accepts on import.
KNOWN_COLUMNS = ["name", "description", "status", "manager_id", "department", "start_date", "end_date"]
ALIASES = {
    "project_name": "name",
    "project": "name",
    "title": "name",
    "desc": "description",
    "dept": "department",
    "start": "start_date",
    "end": "end_date",
    "manager": "manager_id",
}
VALID_STATUSES = {"active", "completed", "delayed", "archived"}


def normalize(header):
    key = str(header).strip().lower().replace(" ", "_")
    return ALIASES.get(key, key)


def clean(value):
    """Empty cells -> None; dates -> ISO strings; everything else JSON-safe."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.date().isoformat() if isinstance(value, datetime.datetime) else value.isoformat()
    return value


def map_row(headers, row, default_manager_id=None):
    """Map one sheet row to (projects-columns dict, metadata dict)."""
    record = dict.fromkeys(KNOWN_COLUMNS)  # missing known columns stay None
    metadata = {}
    for header, value in zip(headers, row):
        if header is None or str(header).strip() == "":
            continue
        value = clean(value)
        key = normalize(header)
        if key in KNOWN_COLUMNS:
            record[key] = value
        elif value is not None:
            metadata[str(header).strip()] = value

    if record["status"] is not None:
        status = str(record["status"]).strip().lower()
        if status in VALID_STATUSES:
            record["status"] = status
        else:  # unknown status: preserve the original in metadata, default the column
            metadata["original_status"] = record["status"]
            record["status"] = None
    try:
        record["manager_id"] = int(record["manager_id"])
    except (TypeError, ValueError):
        if record["manager_id"] is not None:  # e.g. a manager *name* — keep it
            metadata["original_manager"] = record["manager_id"]
        record["manager_id"] = default_manager_id
    return record, metadata


def read_rows(path):
    """Yield (headers, rows) from an .xlsx or .csv file."""
    if path.lower().endswith(".csv"):
        with open(path, newline="", encoding="utf-8-sig") as f:
            rows = list(csv.reader(f))
    else:
        import openpyxl

        sheet = openpyxl.load_workbook(path, read_only=True, data_only=True).active
        rows = [list(r) for r in sheet.iter_rows(values_only=True)]
    if not rows:
        sys.exit("File is empty.")
    return rows[0], rows[1:]


def import_file(path, default_manager_id, conninfo):
    import psycopg

    headers, rows = read_rows(path)
    imported, skipped = 0, 0
    with psycopg.connect(conninfo) as conn:
        for i, row in enumerate(rows, start=2):  # start=2: row 1 is the header
            record, metadata = map_row(headers, row, default_manager_id)
            if not record["name"]:
                print(f"row {i}: skipped — no project name")
                skipped += 1
                continue
            if not record["manager_id"]:
                print(f"row {i}: skipped — no manager_id and no --manager-id fallback")
                skipped += 1
                continue
            try:
                with conn.transaction():
                    conn.execute(
                        """
                        INSERT INTO projects (name, description, status, manager_id,
                                              department, start_date, end_date, metadata)
                        VALUES (%s, %s, COALESCE(%s, 'active')::project_status, %s, %s, %s, %s, %s)
                        """,
                        (
                            record["name"], record["description"], record["status"],
                            record["manager_id"], record["department"],
                            record["start_date"], record["end_date"],
                            json.dumps(metadata),
                        ),
                    )
                imported += 1
            except psycopg.Error as e:
                print(f"row {i}: skipped — {e}")
                skipped += 1
    print(f"Done: {imported} imported, {skipped} skipped.")


def self_test():
    headers = ["Project Name", "Manager", "Status", "Client Contact", "Region", "Start Date"]
    row = ["Website Revamp", "Alice Smith", "In Progress", "bob@client.com", "EMEA", datetime.date(2026, 1, 5)]
    record, metadata = map_row(headers, row, default_manager_id=7)
    assert record["name"] == "Website Revamp"
    assert record["manager_id"] == 7 and metadata["original_manager"] == "Alice Smith"
    assert record["status"] is None and metadata["original_status"] == "In Progress"
    assert record["start_date"] == "2026-01-05"
    assert record["description"] is None and record["end_date"] is None  # missing -> None
    assert metadata["Client Contact"] == "bob@client.com" and metadata["Region"] == "EMEA"
    # numeric manager_id and valid status pass straight through, empty cells drop out
    record, metadata = map_row(["name", "manager_id", "status", "notes"], ["X", "3", "Active", ""])
    assert record["manager_id"] == 3 and record["status"] == "active" and metadata == {}
    print("self-test OK")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", nargs="?", help=".xlsx or .csv file to import")
    parser.add_argument("--manager-id", type=int, help="fallback manager user id for rows without a numeric manager_id")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return
    if not args.file:
        parser.error("file is required (or use --self-test)")
    conninfo = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASS', 'postgres123')} "
        f"dbname={os.getenv('POSTGRES_NAME', 'postgres')}"
    )
    import_file(args.file, args.manager_id, conninfo)


if __name__ == "__main__":
    main()
