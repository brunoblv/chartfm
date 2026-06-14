"""Parse LADO B.xlsx → JSON (stdout).

Estrutura por aba (LADO B-YYYY):
  - Linha de semana: col B = rótulo, col C = data
  - Entradas: col A = posição, col B = artista, col C = música

Usage:
  python parse-lado-b-xlsx.py <path-to-xlsx>
  python parse-lado-b-xlsx.py <path-to-xlsx> --sheet="LADO B-2025"
  python parse-lado-b-xlsx.py <path-to-xlsx> --year=2025
"""
import json
import re
import sys
from datetime import datetime

import openpyxl

SHEET_PATTERN = re.compile(r"^LADO B[- ](\d{4})$", re.I)


def parse_sheet(ws, sheet_name: str) -> list[dict]:
    weeks: list[dict] = []
    current: dict | None = None

    for row in ws.iter_rows(min_row=1, values_only=True):
        a = row[0] if len(row) > 0 else None
        b = row[1] if len(row) > 1 else None
        c = row[2] if len(row) > 2 else None

        if b and isinstance(c, datetime):
            if current:
                weeks.append(current)
            current = {
                "sheet": sheet_name,
                "label": str(b).strip(),
                "date": c.strftime("%Y-%m-%d"),
                "entries": [],
            }
            continue

        if current and a is not None and b and c and isinstance(a, (int, float)):
            current["entries"].append(
                {
                    "position": int(a),
                    "artist": str(b).strip(),
                    "title": str(c).strip(),
                }
            )

    if current:
        weeks.append(current)
    return weeks


def matching_sheets(wb, year_filter: int | None = None) -> list[str]:
    names: list[str] = []
    for name in wb.sheetnames:
        m = SHEET_PATTERN.match(name.strip())
        if not m:
            continue
        year = int(m.group(1))
        if year_filter is not None and year != year_filter:
            continue
        names.append(name)
    return sorted(names, key=lambda n: int(SHEET_PATTERN.match(n).group(1)))


def parse_workbook(path: str, sheet: str | None = None, year: int | None = None) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        if sheet:
            if sheet not in wb.sheetnames:
                raise ValueError(f"Aba não encontrada: {sheet}")
            sheets = [sheet]
        else:
            sheets = matching_sheets(wb, year)

        if not sheets:
            raise ValueError("Nenhuma aba LADO B-YYYY encontrada na planilha")

        all_weeks: list[dict] = []
        for name in sheets:
            all_weeks.extend(parse_sheet(wb[name], name))

        all_weeks.sort(key=lambda w: w["date"])
        return all_weeks
    finally:
        wb.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse-lado-b-xlsx.py <path-to-xlsx> [--sheet=NAME] [--year=YYYY]", file=sys.stderr)
        sys.exit(1)

    xlsx_path = sys.argv[1]
    sheet_arg = next((a.split("=", 1)[1] for a in sys.argv[2:] if a.startswith("--sheet=")), None)
    year_arg = next((a.split("=", 1)[1] for a in sys.argv[2:] if a.startswith("--year=")), None)
    year = int(year_arg) if year_arg else None

    data = parse_workbook(xlsx_path, sheet=sheet_arg, year=year)
    print(json.dumps(data, ensure_ascii=False))
