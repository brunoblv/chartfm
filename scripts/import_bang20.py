"""
Importa paradas do ficheiro BANG20 (formato oficial .xlsx) para um utilizador Chartify.

Formato por aba (ano): coluna A = posição, B = 'Artista, "Título" (estatísticas)', C = pontos/estatística.
Cabeçalhos de semana: célula B com data em inglês (ex.: January 5th, 2008). Ignorar abas cujo nome começa por BOF.

Uso (teste só 2008):
  cd chartify
  python scripts/import_bang20.py --xlsx "C:\\path\\BANG20oficial.xlsx" --handle romulolima22 --year 2008

Requer: openpyxl, psycopg2-binary, python-dateutil, python-dotenv (ou variável DATABASE_URL).
"""

from __future__ import annotations

import argparse
import os
import re
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl
import psycopg2
from dateutil import parser as date_parser
from dotenv import load_dotenv
from psycopg2.extras import execute_values

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

PALETTES = [
    ("#FF6B6B", "#FFE66D"),
    ("#4ECDC4", "#556270"),
    ("#C7F464", "#4ECDC4"),
    ("#FF8C94", "#FFAAA5"),
    ("#A8E6CF", "#3D5A80"),
    ("#E07856", "#F2D8A7"),
    ("#2E294E", "#EA698B"),
    ("#1B2021", "#FFD166"),
    ("#EF476F", "#06D6A0"),
    ("#073B4C", "#FFD166"),
    ("#8338EC", "#FB5607"),
]

MONTH_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


def iso_week_parts(d: date) -> tuple[int, int]:
    iso = d.isocalendar()
    return iso.year, iso.week


def week_sunday(d: date) -> date:
    delta = 6 - d.weekday()
    return d + timedelta(days=delta)


def format_pt_day_month(d: date) -> str:
    return f"{d.day} de {MONTH_PT[d.month - 1]}"


def js_hash_abs(s: str) -> int:
    h = 0
    for ch in s:
        h = ((h * 31) + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return abs(h)


def palette_for(artist: str, title: str):
    seed = js_hash_abs(artist + title)
    pal = PALETTES[seed % len(PALETTES)]
    return pal, seed


def parse_artist_title(cell_b: str) -> tuple[str, str] | None:
    if not cell_b or not isinstance(cell_b, str):
        return None
    s = cell_b.strip()
    m = re.match(r"^(.+?),\s*\"([^\"]*)\"\s*(.*)$", s)
    if not m:
        return None
    artist, title = m.group(1).strip(), m.group(2).strip()
    if not artist or not title:
        return None
    return artist, title


def parse_week_date(cell_b) -> date | None:
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
        dt = date_parser.parse(s, fuzzy=False)
        return dt.date()
    except (ValueError, TypeError, OverflowError):
        return None


def sheet_is_bof(name: str) -> bool:
    return name.strip().upper().startswith("BOF")


def sheet_year_name(name: str) -> int | None:
    if sheet_is_bof(name):
        return None
    m = re.fullmatch(r"(\d{4})", name.strip())
    return int(m.group(1)) if m else None


def parse_year_sheet(ws: openpyxl.worksheet.worksheet.Worksheet) -> list[dict]:
    """Devolve lista de semanas: { 'ref_date', 'entries': [{position, artist, title, points}] }."""
    weeks: list[dict] = []
    current: dict | None = None

    for r in range(1, ws.max_row + 1):
        a = ws.cell(r, 1).value
        b = ws.cell(r, 2).value
        c = ws.cell(r, 3).value

        week_date = parse_week_date(b)
        if week_date and (a is None or str(a).strip() == ""):
            if current and current["entries"]:
                weeks.append(current)
            current = {"ref_date": week_date, "entries": []}
            continue

        if current is None:
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
        if isinstance(c, (int, float)):
            points = int(c)
        else:
            points = max(0, 101 - pos)
        current["entries"].append(
            {"position": pos, "artist": artist, "title": title, "points": points}
        )

    if current and current["entries"]:
        weeks.append(current)

    for wk in weeks:
        wk["entries"] = sorted(wk["entries"], key=lambda e: e["position"])
    return weeks


def recompute_streak(cur, user_id: str) -> int:
    cur.execute(
        'SELECT DISTINCT "weekIndex" FROM "Chart" WHERE "userId" = %s ORDER BY "weekIndex" DESC',
        (user_id,),
    )
    indexes = [row[0] for row in cur.fetchall()]
    if not indexes:
        return 0

    def iso_weeks_in_year(year: int) -> int:
        dec28 = date(year, 12, 28)
        return dec28.isocalendar()[1]

    def prev_week_index(idx: int) -> int:
        year = idx // 100
        week = idx % 100
        if week > 1:
            return year * 100 + (week - 1)
        py = year - 1
        return py * 100 + iso_weeks_in_year(py)

    sorted_unique = sorted(set(indexes), reverse=True)
    streak = 1
    cursor = sorted_unique[0]
    for i in range(1, len(sorted_unique)):
        if sorted_unique[i] != prev_week_index(cursor):
            break
        streak += 1
        cursor = sorted_unique[i]
    cur.execute('UPDATE "User" SET streak = %s WHERE id = %s', (streak, user_id))
    return streak


def main():
    ap = argparse.ArgumentParser(description="Import BANG20 xlsx into Chartify charts")
    ap.add_argument("--xlsx", required=True, help="Caminho para BANG20oficial.xlsx")
    ap.add_argument("--handle", default="romulolima22", help="Handle do utilizador")
    ap.add_argument(
        "--year",
        type=int,
        default=None,
        help="Importar só esta aba numérica (ex.: 2008). Se omitido, importa todas as abas AAAA sem BOF.",
    )
    args = ap.parse_args()

    # psycopg2 não aceita ?pgbouncer=true; Prisma usa DIRECT_URL para sessão directa.
    db_url = (os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL") or "").strip().strip('"').strip("'")
    if not db_url:
        raise SystemExit("Defina DIRECT_URL ou DATABASE_URL (ex.: .env na raiz do chartify).")

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    sheet_names: list[str] = []
    for name in wb.sheetnames:
        if sheet_is_bof(name):
            continue
        y = sheet_year_name(name)
        if y is None:
            continue
        if args.year is not None and y != args.year:
            continue
        sheet_names.append(name)

    if not sheet_names:
        raise SystemExit("Nenhuma aba elegível (use --year ou verifique o ficheiro).")

    all_weeks: list[dict] = []
    for sn in sorted(sheet_names, key=lambda x: int(x) if x.isdigit() else 0):
        ws = wb[sn]
        for wk in parse_year_sheet(ws):
            ref = wk["ref_date"]
            iso_y, iso_w = iso_week_parts(ref)
            all_weeks.append(
                {
                    "sheet": sn,
                    "date": ref,
                    "week_index": iso_y * 100 + iso_w,
                    "week_label": f"Semana {iso_w} - {iso_y}",
                    "entries": wk["entries"],
                }
            )

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    created_charts = 0
    skipped_existing = 0
    created_songs = 0

    try:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = 0")
            cur.execute('SELECT id FROM "User" WHERE handle = %s', (args.handle,))
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f'Utilizador "{args.handle}" não encontrado')
            user_id = row[0]

            cur.execute('SELECT "weekIndex" FROM "Chart" WHERE "userId" = %s', (user_id,))
            existing_indexes = {r[0] for r in cur.fetchall()}
            weeks_to_create = [w for w in all_weeks if w["week_index"] not in existing_indexes]
            skipped_existing = len(all_weeks) - len(weeks_to_create)

            cur.execute('SELECT id, title, artist, "spotify_id", "album_spotify_id" FROM "Song"')
            song_map = {(r[1], r[2]): (r[0], r[3], r[4]) for r in cur.fetchall()}

            new_song_keys: set[tuple[str, str]] = set()
            for wk in weeks_to_create:
                for e in wk["entries"]:
                    key = (e["title"], e["artist"])
                    if key not in song_map:
                        new_song_keys.add(key)

            if new_song_keys:
                rows = [(uuid.uuid4().hex, title, artist, None) for (title, artist) in sorted(new_song_keys)]
                execute_values(
                    cur,
                    'INSERT INTO "Song" (id, title, artist, album) VALUES %s ON CONFLICT (title, artist) DO NOTHING',
                    rows,
                    page_size=200,
                )
                created_songs = len(rows)
                cur.execute('SELECT id, title, artist, "spotify_id", "album_spotify_id" FROM "Song"')
                song_map = {(r[1], r[2]): (r[0], r[3], r[4]) for r in cur.fetchall()}

            for wk in weeks_to_create:
                end = week_sunday(wk["date"])
                start = end - timedelta(days=6)
                date_range = f"de {format_pt_day_month(start)} a {format_pt_day_month(end)}"
                chart_id = uuid.uuid4().hex
                cur.execute(
                    'INSERT INTO "Chart" (id, "userId", "weekIndex", "weekLabel", "dateRange", "publishedAt", likes, comments, reposts, chart_type, is_published, max_items) '
                    "VALUES (%s, %s, %s, %s, %s, %s, 0, 0, 0, %s, %s, %s)",
                    (chart_id, user_id, wk["week_index"], wk["week_label"], date_range, end, "SONGS", True, 100),
                )

                entry_rows = []
                for e in wk["entries"]:
                    song_id, song_spotify_id, album_spotify_id = song_map[(e["title"], e["artist"])]
                    points = e["points"]
                    (pal_a, pal_b), seed = palette_for(e["artist"], e["title"])
                    entry_rows.append(
                        (
                            uuid.uuid4().hex,
                            chart_id,
                            song_id,
                            e["position"],
                            points,
                            "new",
                            None,
                            None,
                            e["position"],
                            1,
                            pal_a,
                            pal_b,
                            seed,
                            song_spotify_id,
                            album_spotify_id,
                        )
                    )

                execute_values(
                    cur,
                    'INSERT INTO "ChartEntry" (id, "chartId", "songId", position, points, status, delta, "prevPos", peak, weeks, "coverPaletteA", "coverPaletteB", "coverSeed", "song_spotify_id", "album_spotify_id") VALUES %s',
                    entry_rows,
                    page_size=200,
                )
                created_charts += 1

            streak = recompute_streak(cur, user_id)

        conn.commit()
        print("IMPORT_OK")
        print(f"sheets={sheet_names}")
        print(f"weeks_total={len(all_weeks)}")
        print(f"charts_created={created_charts}")
        print(f"charts_skipped_existing={skipped_existing}")
        print(f"songs_insert_attempted={created_songs}")
        print(f"streak={streak}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
