import openpyxl
import psycopg2
import uuid
from datetime import datetime, date, timedelta

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
    song_cache = {}

    try:
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM "User" WHERE handle = %s', (USER_HANDLE,))
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f"Usuário {USER_HANDLE} não encontrado")
            user_id = row[0]

            for sheet_name in SHEETS:
                ws = wb[sheet_name]
                weeks = parse_sheet_week(ws)
                for wk in weeks:
                    processed_weeks += 1
                    ref_date = wk["date"]
                    iso_year, iso_week = iso_week_parts(ref_date)
                    week_index = iso_year * 100 + iso_week

                    cur.execute('SELECT id FROM "Chart" WHERE "userId" = %s AND "weekIndex" = %s', (user_id, week_index))
                    if cur.fetchone():
                        skipped_existing += 1
                        continue

                    end = week_sunday(ref_date)
                    start = end - timedelta(days=6)
                    week_label = f"Semana {iso_week} - {iso_year}"
                    date_range = f"de {format_pt_day_month(start)} a {format_pt_day_month(end)}"

                    cur.execute(
                        'INSERT INTO "Chart" (id, "userId", "weekIndex", "weekLabel", "dateRange", "publishedAt", likes, comments, reposts, chart_type, is_published, max_items) '
                        "VALUES (%s, %s, %s, %s, %s, %s, 0, 0, 0, %s, %s, %s) RETURNING id",
                        (uuid.uuid4().hex, user_id, week_index, week_label, date_range, end, "SONGS", True, 100),
                    )
                    chart_id = cur.fetchone()[0]

                    for e in wk["entries"]:
                        song_key = (e["title"], e["artist"])
                        if song_key in song_cache:
                            song_id, song_spotify_id, album_spotify_id = song_cache[song_key]
                        else:
                            cur.execute(
                                'INSERT INTO "Song" (id, title, artist, album) VALUES (%s, %s, %s, %s) '
                                "ON CONFLICT (title, artist) DO NOTHING RETURNING id",
                                (uuid.uuid4().hex, e["title"], e["artist"], None),
                            )
                            song_row = cur.fetchone()
                            if song_row:
                                song_id = song_row[0]
                                created_songs += 1
                            else:
                                cur.execute(
                                    'SELECT id, "spotify_id", "album_spotify_id" FROM "Song" WHERE title = %s AND artist = %s',
                                    (e["title"], e["artist"]),
                                )
                                s = cur.fetchone()
                                song_id, song_spotify_id, album_spotify_id = s[0], s[1], s[2]
                                song_cache[song_key] = (song_id, song_spotify_id, album_spotify_id)
                                # Já carregado para o insert abaixo.
                                points = 101 - e["position"]
                                (pal_a, pal_b), seed = palette_for(e["artist"], e["title"])
                                cur.execute(
                                    'INSERT INTO "ChartEntry" (id, "chartId", "songId", position, points, status, delta, "prevPos", peak, weeks, '
                                    '"coverPaletteA", "coverPaletteB", "coverSeed", "song_spotify_id", "album_spotify_id") '
                                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
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
                                    ),
                                )
                                continue

                            cur.execute('SELECT "spotify_id", "album_spotify_id" FROM "Song" WHERE id = %s', (song_id,))
                            song_spotify_id, album_spotify_id = cur.fetchone()
                            song_cache[song_key] = (song_id, song_spotify_id, album_spotify_id)

                        points = 101 - e["position"]
                        (pal_a, pal_b), seed = palette_for(e["artist"], e["title"])

                        cur.execute(
                            'INSERT INTO "ChartEntry" (id, "chartId", "songId", position, points, status, delta, "prevPos", peak, weeks, '
                            '"coverPaletteA", "coverPaletteB", "coverSeed", "song_spotify_id", "album_spotify_id") '
                            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
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
                            ),
                        )

                    created_charts += 1
                    if len(examples) < 10:
                        examples.append((chart_id, sheet_name, ref_date.isoformat(), week_label, len(wk["entries"])))

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
