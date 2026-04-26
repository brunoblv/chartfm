import openpyxl
import psycopg2
import uuid
from datetime import datetime, date, timedelta
from psycopg2.extras import execute_values

XLSX = r"C:\Users\blvbr\Documents\Brunos Top 20.xlsx"
DB_URL = "postgresql://postgres.jvbnrzgrivxavdlzoxbq:Twwz7zCbsaHjjOdj@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
USER_HANDLE = "blvbruno"
SHEETS = ["2002-2010", "2010-2015"]

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


def iso_week_parts(d: date):
    iso = d.isocalendar()
    return iso.year, iso.week


def week_sunday(d: date) -> date:
    # Python weekday: Mon=0..Sun=6
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


def parse_sheet_week(ws):
    # col B = artista, col C = musica
    date_cols = []
    for c in range(1, ws.max_column + 1):
        v = ws.cell(1, c).value
        if isinstance(v, datetime):
            date_cols.append((c, v.date()))

    weeks = []
    for col, dt in date_cols:
        by_pos = {}
        for r in range(2, ws.max_row + 1):
            pos = ws.cell(r, col).value
            if not isinstance(pos, (int, float)):
                continue
            artist = ws.cell(r, 2).value
            title = ws.cell(r, 3).value
            if not artist or not title:
                continue
            p = int(pos)
            if p < 1 or p > 1000:
                continue
            # Em algumas colunas existem posições duplicadas; preservamos a primeira ocorrência.
            if p not in by_pos:
                by_pos[p] = {"position": p, "artist": str(artist).strip(), "title": str(title).strip()}
        entries = sorted(by_pos.values(), key=lambda x: x["position"])
        if not entries:
            continue
        weeks.append({"date": dt, "entries": entries})
    return weeks


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=False)
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False

    created_charts = 0
    skipped_existing = 0
    created_songs = 0
    processed_weeks = 0
    examples = []

    try:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = 0")
            cur.execute('SELECT id FROM "User" WHERE handle = %s', (USER_HANDLE,))
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f"Usuário {USER_HANDLE} não encontrado")
            user_id = row[0]

            all_weeks = []
            for sheet_name in SHEETS:
                ws = wb[sheet_name]
                for wk in parse_sheet_week(ws):
                    processed_weeks += 1
                    ref_date = wk["date"]
                    iso_year, iso_week = iso_week_parts(ref_date)
                    all_weeks.append(
                        {
                            "sheet": sheet_name,
                            "date": ref_date,
                            "week_index": iso_year * 100 + iso_week,
                            "week_label": f"Semana {iso_week} - {iso_year}",
                            "entries": wk["entries"],
                        }
                    )

            cur.execute('SELECT "weekIndex" FROM "Chart" WHERE "userId" = %s', (user_id,))
            existing_indexes = {r[0] for r in cur.fetchall()}
            weeks_to_create = []
            for wk in all_weeks:
                if wk["week_index"] in existing_indexes:
                    skipped_existing += 1
                else:
                    weeks_to_create.append(wk)

            # Carrega todas as músicas já existentes uma vez.
            cur.execute('SELECT id, title, artist, "spotify_id", "album_spotify_id" FROM "Song"')
            song_map = {(r[1], r[2]): (r[0], r[3], r[4]) for r in cur.fetchall()}

            # Descobre músicas novas para inserir em lote.
            new_song_keys = set()
            for wk in weeks_to_create:
                for e in wk["entries"]:
                    key = (e["title"], e["artist"])
                    if key not in song_map:
                        new_song_keys.add(key)

            if new_song_keys:
                rows = [(uuid.uuid4().hex, title, artist, None) for (title, artist) in new_song_keys]
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
                    points = 101 - e["position"]
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
                if len(examples) < 10:
                    examples.append((chart_id, wk["sheet"], wk["date"].isoformat(), wk["week_label"], len(wk["entries"])))

        conn.commit()
        print("IMPORT_OK")
        print(f"weeks_found={processed_weeks}")
        print(f"charts_created={created_charts}")
        print(f"charts_skipped_existing={skipped_existing}")
        print(f"songs_created={created_songs}")
        for ex in examples:
            print("example_chart=", ex)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
