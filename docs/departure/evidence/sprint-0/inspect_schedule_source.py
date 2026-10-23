"""Read only the checked-in schedule schema and source worksheet; no DB imports."""
from collections import Counter
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
WORKBOOK = ROOT / "docs/hackathon/data/Batam SmartFlow Data Master (1).xlsx"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


before = digest(WORKBOOK)
with ZipFile(WORKBOOK) as archive:
    shared = ["".join(node.itertext()) for node in ET.fromstring(
        archive.read("xl/sharedStrings.xml")
    )] if "xl/sharedStrings.xml" in archive.namelist() else []
    relationships = {node.attrib["Id"]: node.attrib["Target"] for node in
                     ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheet = next(node for node in workbook.find("s:sheets", NS)
                 if node.attrib["name"] == "ferry_schedules")
    target = relationships[sheet.attrib[REL_ID]]
    target = target.lstrip("/") if target.startswith("/") else "xl/" + target
    xml_rows = ET.fromstring(archive.read(target)).findall("s:sheetData/s:row", NS)
    values, formula_cells = [], []
    for row in xml_rows:
        cells = {}
        for cell in row:
            ref = cell.attrib["r"]
            column = "".join(char for char in ref if char.isalpha())
            value = cell.findtext("s:v", namespaces=NS)
            if cell.attrib.get("t") == "s":
                value = shared[int(value)]
            elif cell.attrib.get("t") == "inlineStr":
                value = "".join(cell.find("s:is", NS).itertext())
            if cell.find("s:f", NS) is not None:
                formula_cells.append(ref)
            cells[column] = value
        values.append((int(row.attrib["r"]), cells))
    headers = values[0][1]
    assert list(headers.values()) == [
        "terminal_id", "terminal", "terminal_name", "destination", "vessel_type",
        "departure_time", "cutoff_time", "cargo_capacity_tons",
    ]
    styles = ET.fromstring(archive.read("xl/styles.xml"))
    custom_formats = {node.attrib["numFmtId"]: node.attrib["formatCode"] for node in
                      styles.find("s:numFmts", NS)}
    time_format_ids = {styles.find("s:cellXfs", NS)[int(cell.attrib["s"])].attrib["numFmtId"]
                       for row in xml_rows[1:] for cell in row
                       if cell.attrib["r"].startswith(("F", "G")) and cell.find("s:v", NS) is not None}
    time_formats = {key: custom_formats.get(key, "built-in format") for key in sorted(time_format_ids)}


def clock(value):
    if value is None:
        return None
    serial = Decimal(value)
    assert 0 <= serial < 1, "Date-bearing serial requires explicit inspection"
    # Excel stores these clock values as fractions of a day, with float noise.
    seconds = int((serial * 86400).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    assert 0 <= seconds < 86400
    return f"{seconds // 3600:02}:{seconds // 60 % 60:02}:{seconds % 60:02}"


rows = []
for number, cells in values[1:]:
    if not cells.get("A"):
        continue
    item = {name: cells.get(column) for column, name in headers.items()}
    for key in ("departure_time", "cutoff_time"):
        item[key] = clock(item[key])
    if item["cargo_capacity_tons"] is not None:
        item["cargo_capacity_tons"] = float(item["cargo_capacity_tons"])
    rows.append({"source_row": number, **item})


def duplicates(keys):
    groups = {}
    for row in rows:
        key = tuple(row[name] for name in keys)
        groups.setdefault(key, []).append(row["source_row"])
    return [{"key": dict(zip(keys, key)), "source_rows": numbers}
            for key, numbers in groups.items() if len(numbers) > 1]


schema = (ROOT / "backend/database/schema.sql").read_text()
start = schema.index("CREATE TABLE public.ferry_schedules (")
end = schema.index("\n);", start) + len("\n);")
(OUT / "schedule-schema.txt").write_text(
    "Checked-in DDL excerpt only; NOT live schema; read, never executed.\n"
    "Source: backend/database/schema.sql\n\n" + schema[start:end] + "\n"
)
report = {
    "captured_at": datetime.now(ZoneInfo("Asia/Jakarta")).isoformat(),
    "command": "python3 docs/departure/evidence/sprint-0/inspect_schedule_source.py",
    "cwd": "repository root",
    "source": str(WORKBOOK.relative_to(ROOT)),
    "sheet": "ferry_schedules",
    "range": f"A1:H{max(row['source_row'] for row in rows)}",
    "provenance": "Checked-in project source workbook. Not a live DB export or verified operational sailings.",
    "sanitization": "Only schedule columns retained; no credentials, identities, workbook author metadata, or other sheets exported.",
    "sha256_before": before,
    "sha256_after": digest(WORKBOOK),
    "source_unchanged": before == digest(WORKBOOK),
    "headers": list(headers.values()),
    "clock_formats": time_formats,
    "formula_cells": formula_cells,
    "row_count": len(rows),
    "terminals": [dict(zip(("terminal_id", "terminal", "terminal_name"), item)) for item in
                  sorted({(row["terminal_id"], row["terminal"], row["terminal_name"]) for row in rows})],
    "null_cutoff_count": sum(row["cutoff_time"] is None for row in rows),
    "null_cutoff_source_rows": [row["source_row"] for row in rows if row["cutoff_time"] is None],
    "service_types": dict(sorted(Counter(row["vessel_type"] for row in rows).items())),
    "exact_duplicate_groups": duplicates(list(headers.values())),
    "same_terminal_destination_service_departure_groups": duplicates([
        "terminal", "destination", "vessel_type", "departure_time"
    ]),
    "repeated_terminal_ids_are_not_schedule_ids": True,
    "service_date": None,
    "recurrence": None,
    "source_timezone": None,
    "verified_freshness": None,
    "missing_metadata": "No date/recurrence/timezone/observed_at/updated_at/source columns on this sheet. File timestamps cannot establish schedule freshness.",
    "live_schema_status": "PENDING: no inherited SUPABASE_URL/SUPABASE_ANON_KEY; .env files must not be read.",
    "live_sample_status": "PENDING; no live read attempted and no live counts inferred.",
    "sample": rows,
}
assert report["source_unchanged"]
(OUT / "schedule-source.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({key: value for key, value in report.items() if key != "sample"}, indent=2, ensure_ascii=False))
