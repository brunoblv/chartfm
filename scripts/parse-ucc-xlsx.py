"""Parseia "UCC (year-end charts).xlsx" → JSON (stdout).

Formato por aba (ano no nome da aba, ex.: 2007, 2008):
  - Linha 1: cabeçalhos; a partir de F1 (coluna 6) datas semanais DD.MM
  - Coluna D: "Artista - Música" (feats no título)
  - Linhas 2+: em cada coluna de semana, posição numérica ou vazio

Ignora aba "All-Time" e colunas cujo cabeçalho não é DD.MM.

Usage:
  python scripts/parse-ucc-xlsx.py <xlsx-path>
  python scripts/parse-ucc-xlsx.py <xlsx-path> --from=2008-01-01
  python scripts/parse-ucc-xlsx.py <xlsx-path> --until=2015-12-31
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from typing import Any

import openpyxl

TRACK_COL = 3  # coluna D (0-based)
DATE_START_COL = 5  # coluna F (0-based)
DATA_START_ROW = 2
DATE_HEADER_RE = re.compile(r"^(\d{1,2})\.(\d{1,2})$")


def parse_cli_date(flag: str) -> date | None:
    arg = next((item for item in sys.argv if item.startswith(flag)), None)
    if not arg:
        return None
    value = arg.split("=", 1)[1]
    return date.fromisoformat(value)


def parse_sheet_year(sheet_name: str) -> int | None:
    name = sheet_name.strip()
    if name.isdigit() and len(name) == 4:
        return int(name)
    return None


def parse_date_header(value: Any, year: int) -> date | None:
    if value is None:
        return None
    text = str(value).strip()
    match = DATE_HEADER_RE.match(text)
    if not match:
        return None
    day = int(match.group(1))
    month = int(match.group(2))
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_artist_title(raw: str) -> tuple[str, str] | None:
    text = str(raw).strip()
    sep = text.find(" - ")
    if sep == -1:
        return None
    artist = text[:sep].strip()
    title = text[sep + 3 :].strip()
    if len(artist) < 2 or len(title) < 2:
        return None
    return artist, title


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
        if sheet_name.strip().lower() == "all-time":
            continue
        year = parse_sheet_year(sheet_name)
        if year is None:
            continue

        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue

        header = rows[0]
        date_cols: list[tuple[int, date]] = []
        for col_idx in range(DATE_START_COL, len(header)):
            week_date = parse_date_header(header[col_idx], year)
            if week_date:
                date_cols.append((col_idx, week_date))

        if not date_cols:
            continue

        for col_idx, week_date in date_cols:
            if from_date and week_date < from_date:
                continue
            if until_date and week_date > until_date:
                continue

            entries: list[dict[str, Any]] = []
            for row in rows[DATA_START_ROW - 1 :]:
                if not row or len(row) <= col_idx:
                    continue
                pos_val = row[col_idx]
                if not isinstance(pos_val, (int, float)):
                    continue
                pos = int(pos_val)
                if pos < 1 or pos > 100:
                    continue

                track_raw = row[TRACK_COL] if len(row) > TRACK_COL else None
                if not track_raw:
                    continue
                parsed = parse_artist_title(str(track_raw))
                if not parsed:
                    continue
                artist, title = parsed
                entries.append({"position": pos, "artist": artist, "title": title})

            if not entries:
                continue

            entries = dedupe_entries(entries)
            key = week_date.isoformat()
            candidate = {"date": key, "sheet": sheet_name, "entries": entries}
            existing = week_map.get(key)
            if not existing or len(entries) > len(existing["entries"]):
                week_map[key] = candidate

    wb.close()
    return sorted(week_map.values(), key=lambda week: week["date"])


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(
            "Usage: python scripts/parse-ucc-xlsx.py <xlsx-path> [--from=YYYY-MM-DD] [--until=YYYY-MM-DD]"
        )

    path = sys.argv[1]
    from_date = parse_cli_date("--from=")
    until_date = parse_cli_date("--until=")
    weeks = parse_workbook(path, from_date, until_date)
    print(json.dumps(weeks, ensure_ascii=False))


if __name__ == "__main__":
    main()
