"""Lista (weekIndex, posição, data, artista, título) para Doushite + TVXQ numa aba AAAA."""
from __future__ import annotations

import re
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl
from dateutil import parser as date_parser


def parse_week_date(cell_b):
    if cell_b is None:
        return None
    if isinstance(cell_b, datetime):
        return cell_b.date()
    if isinstance(cell_b, date):
        return cell_b
    if not isinstance(cell_b, str):
        return None
    try:
        return date_parser.parse(cell_b.strip(), fuzzy=False).date()
    except Exception:
        return None


def parse_artist_title(cell_b: str | None):
    if not cell_b or not isinstance(cell_b, str):
        return None
    m = re.match(r'^(.+?),\s*"([^"]*)"\s*(.*)$', cell_b.strip())
    if not m:
        return None
    a, t = m.group(1).strip(), m.group(2).strip()
    return (a, t) if a and t else None


def iso_wix(d: date) -> int:
    iso = d.isocalendar()
    return iso.year * 100 + iso.week


def main():
    year = sys.argv[1] if len(sys.argv) > 1 else "2009"
    xlsx = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(r"C:\Users\blvbr\Downloads\BANG20oficial.xlsx")
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    ws = wb[str(year)]
    cur: date | None = None
    for r in range(1, ws.max_row + 1):
        a, b = ws.cell(r, 1).value, ws.cell(r, 2).value
        wd = parse_week_date(b)
        if wd and (a is None or str(a).strip() == ""):
            cur = wd
            continue
        if cur is None or not isinstance(a, (int, float)):
            continue
        parsed = parse_artist_title(str(b) if b else "")
        if not parsed:
            continue
        art, tit = parsed
        m = (art + " " + tit).lower()
        if "doushite" in m or "shimattandarou" in m:
            pos = int(a)
            print(iso_wix(cur), cur.isoformat(), pos, art, tit, sep="\t")


if __name__ == "__main__":
    main()
