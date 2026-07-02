"""Parseia planilha MGOLD (ohmymog_) → JSON (stdout).

Formato por aba:
  - Coluna A: data da semana (datetime Excel ou texto DD.MM.YY), depois posições (#01, #02, …)
  - Coluna B: artista
  - Coluna C: música (feats entre parênteses, ex.: "Die With A Smile (feat. Lady Gaga)")

Usage:
  python scripts/parse-mgold-xlsx.py <xlsx-path>
  python scripts/parse-mgold-xlsx.py <xlsx-path> --until=2020-01-31
  python scripts/parse-mgold-xlsx.py <xlsx-path> --from=2020-01-01
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from typing import Any

import openpyxl

POS_RE = re.compile(r"^#?(\d+)$", re.I)
DATE_TEXT_RE = re.compile(r"^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$")


def parse_date_cell(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value is None:
        return None
    text = str(value).strip()
    match = DATE_TEXT_RE.match(text)
    if not match:
        return None
    day = int(match.group(1))
    month = int(match.group(2))
    year = int(match.group(3))
    if year < 100:
        year += 2000
    return date(year, month, day)


def parse_position(value: Any) -> int | None:
    if value is None:
        return None
    match = POS_RE.match(str(value).strip())
    if not match:
        return None
    pos = int(match.group(1))
    return pos if pos >= 1 else None


def dedupe_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_pos: dict[int, dict[str, Any]] = {}
    for entry in entries:
        pos = entry["position"]
        if pos not in by_pos:
            by_pos[pos] = entry
    return [by_pos[pos] for pos in sorted(by_pos)]


def parse_workbook(path: str, from_date: date | None, until_date: date | None) -> list[dict[str, Any]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    week_map: dict[str, dict[str, Any]] = {}

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        current: dict[str, Any] | None = None

        def flush_week() -> None:
            nonlocal current
            if not current or not current["entries"]:
                current = None
                return

            entries = dedupe_entries(current["entries"])
            if not entries:
                current = None
                return

            week_date = date.fromisoformat(current["date"])
            if from_date and week_date < from_date:
                current = None
                return
            if until_date and week_date > until_date:
                current = None
                return

            key = current["date"]
            candidate = {
                "date": key,
                "sheet": sheet_name,
                "entries": entries,
            }
            existing = week_map.get(key)
            if not existing or len(entries) > len(existing["entries"]):
                week_map[key] = candidate
            current = None

        for row in ws.iter_rows(values_only=True):
            col_a = row[0] if row else None
            col_b = row[1] if len(row) > 1 else None
            col_c = row[2] if len(row) > 2 else None

            week_date = parse_date_cell(col_a)
            if week_date:
                flush_week()
                current = {"date": week_date.isoformat(), "sheet": sheet_name, "entries": []}
                continue

            position = parse_position(col_a)
            if current and position and col_b and col_c:
                artist = str(col_b).strip()
                title = str(col_c).strip()
                if len(artist) >= 2 and len(title) >= 2:
                    current["entries"].append(
                        {"position": position, "artist": artist, "title": title}
                    )

        flush_week()

    wb.close()
    return sorted(week_map.values(), key=lambda week: week["date"])


def parse_cli_date(flag: str) -> date | None:
    arg = next((item for item in sys.argv if item.startswith(flag)), None)
    if not arg:
        return None
    value = arg.split("=", 1)[1]
    return date.fromisoformat(value)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/parse-mgold-xlsx.py <xlsx-path> [--from=YYYY-MM-DD] [--until=YYYY-MM-DD]")

    path = sys.argv[1]
    from_date = parse_cli_date("--from=")
    until_date = parse_cli_date("--until=")
    weeks = parse_workbook(path, from_date, until_date)
    print(json.dumps(weeks, ensure_ascii=False))


if __name__ == "__main__":
    main()
