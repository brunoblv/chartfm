from __future__ import annotations

import argparse
import json
import os
import re
from datetime import date, datetime
from pathlib import Path

import openpyxl
import psycopg2
from dateutil import parser as date_parser
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def parse_artist_title(cell_b: str):
    if not cell_b or not isinstance(cell_b, str):
        return None
    s = cell_b.strip()
    m = re.match(r'^(.+?),\s*"([^"]*)"\s*(.*)$', s)
    if not m:
        return None
    artist, title = m.group(1).strip(), m.group(2).strip()
    if not artist or not title:
        return None
    return artist, title


def parse_week_date(cell_b):
    if cell_b is None:
        return None
    if isinstance(cell_b, datetime):
        return cell_b.date()
    if isinstance(cell_b, date):
        return cell_b
    if not isinstance(cell_b, str):
        return None
    s = cell_b.strip()
    if not s:
        return None
    try:
        return date_parser.parse(s, fuzzy=False).date()
    except (ValueError, TypeError, OverflowError):
        return None


def extract_unique_songs(xlsx_path: Path, year: int):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb[str(year)]

    songs = []
    current_week_started = False
    for r in range(1, ws.max_row + 1):
        a = ws.cell(r, 1).value
        b = ws.cell(r, 2).value
        week_date = parse_week_date(b)
        if week_date and (a is None or str(a).strip() == ""):
            current_week_started = True
            continue
        if not current_week_started:
            continue
        if not isinstance(a, (int, float)):
            continue
        pos = int(a)
        if pos < 1 or pos > 1000:
            continue
        parsed = parse_artist_title(str(b) if b is not None else "")
        if not parsed:
            continue
        artist, title = parsed
        songs.append((title, artist))
    return sorted(set(songs))


def main() -> None:
    ap = argparse.ArgumentParser(description="Lista músicas da aba 2010 sem spotify_id no banco.")
    ap.add_argument("--xlsx", required=True, help="Caminho para BANG20oficial.xlsx")
    ap.add_argument("--year", type=int, default=2010)
    ap.add_argument("--out", default="scripts/_missing_2010_in_db.json")
    args = ap.parse_args()

    db_url = (os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL") or "").strip().strip('"').strip("'")
    if not db_url:
        raise SystemExit("DIRECT_URL ou DATABASE_URL ausente.")

    songs = extract_unique_songs(Path(args.xlsx), args.year)
    keys = {(title, artist) for (title, artist) in songs}

    missing: list[dict] = []
    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT title, artist, "spotify_id" FROM "Song"')
            rows = cur.fetchall()
            song_map = {(title, artist): spotify_id for (title, artist, spotify_id) in rows}

    for title, artist in sorted(keys):
        spotify_id = song_map.get((title, artist))
        if not spotify_id:
            missing.append({"title": title, "artist": artist})

    out_path = Path(args.out)
    out_path.write_text(json.dumps(missing, ensure_ascii=False, indent=2), encoding="utf-8")

    print("DB_CHECK_DONE")
    print(f"unique_songs={len(keys)}")
    print(f"missing_in_db={len(missing)}")
    print(f"output={out_path.resolve()}")


if __name__ == "__main__":
    main()
