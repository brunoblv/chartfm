from __future__ import annotations

"""
Import BANG20 (aba por ano no .xlsx) com busca Spotify lenta e segura.

- `--year` escolhe a aba (ex.: 2011).
- Linhas `Artista feat. X, "Título"`: grava só o artista principal em `Song.artist`;
  feats entram em `song_feats` via ordem de artistas da faixa no Spotify.
- Pacing: `--delay-seconds` + `--delay-jitter-seconds`; retries em 429.

Exemplo 2011:
  python scripts/import_bang20_2010_slow.py --xlsx "C:/.../BANG20oficial.xlsx" --year 2011
"""

import argparse
import base64
import json
import os
import random
import re
import time
import unicodedata
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import openpyxl
import psycopg2
import requests
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
    return d + timedelta(days=(6 - d.weekday()))


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


def parse_artist_title(cell_b: str) -> Optional[tuple[str, str]]:
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


# Só divide por feat/ft/featuring — não por vírgula (evita confundir "2NE1, \"Título\"").
_FEAT_TAIL_IN_ARTIST = re.compile(
    r"^(?P<main>.+?)\s+(?:feat\.?|ft\.?|featuring)\s+(?P<feats>.+)$",
    re.IGNORECASE,
)


def split_main_artist_and_feat_names(artist_cell: str) -> tuple[str, list[str]]:
    """Artista principal + nomes de feats (só texto da planilha; IDs vêm do Spotify)."""
    s = (artist_cell or "").strip()
    m = _FEAT_TAIL_IN_ARTIST.match(s)
    if not m:
        return s, []
    main = m.group("main").strip()
    raw = m.group("feats").strip()
    parts = re.split(r"\s*&\s*|\s*,\s*|\s+and\s+", raw, flags=re.IGNORECASE)
    feats = [p.strip() for p in parts if p.strip()]
    return main or s, feats


def clean_title_feat_credits(title: str) -> str:
    """Remove créditos feat no fim do título (ex.: \"(feat. X)\" ou \" feat. X\")."""
    t = (title or "").strip()
    if not t:
        return t
    t = re.sub(r"\s*\([^)]*\b(?:feat\.?|ft\.?|featuring)\b[^)]*\)\s*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+(?:feat\.?|ft\.?|featuring)\s+.+$", "", t, flags=re.IGNORECASE)
    return t.strip()


def parse_week_date(cell_b) -> Optional[date]:
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


def parse_year_sheet(ws: openpyxl.worksheet.worksheet.Worksheet) -> list[dict]:
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

        artist_raw, title_raw = parsed
        artist, _ = split_main_artist_and_feat_names(artist_raw)
        title = clean_title_feat_credits(title_raw)
        if not artist or not title:
            continue
        points = int(c) if isinstance(c, (int, float)) else max(0, 101 - pos)
        current["entries"].append({"position": pos, "artist": artist, "title": title, "points": points})

    if current and current["entries"]:
        weeks.append(current)

    for wk in weeks:
        wk["entries"] = sorted(wk["entries"], key=lambda e: e["position"])
    return weeks


def normalize_key(s: str) -> str:
    out = s.lower().strip()
    out = unicodedata.normalize("NFD", out)
    out = "".join(ch for ch in out if unicodedata.category(ch) != "Mn")
    out = re.sub(r"[^a-z0-9]+", " ", out)
    out = re.sub(r"\s+", " ", out)
    return out.strip()


def token_overlap_score(a: str, b: str) -> float:
    ta = {w for w in a.split(" ") if len(w) > 1}
    tb = {w for w in b.split(" ") if len(w) > 1}
    if not ta or not tb:
        return 0.0
    overlap = len(ta & tb)
    return round((overlap / max(len(ta), len(tb))) * 50, 3)


def score_track_match(want_title: str, want_artist: str, got_title: str, got_artist: str) -> int:
    wt = normalize_key(want_title)
    wa = normalize_key((want_artist.split(",")[0] or want_artist).split(" feat ")[0])
    ct = normalize_key(got_title)
    ca = normalize_key((got_artist.split(",")[0] or got_artist))

    score = 0.0
    if ct == wt:
        score += 100
    elif ct in wt or wt in ct:
        score += 58
    else:
        score += token_overlap_score(wt, ct)

    if ca == wa:
        score += 90
    elif ca in wa or wa in ca:
        score += 48
    else:
        score += token_overlap_score(wa, ca) * 0.6

    return round(score)


def build_queries(title: str, artist: str) -> list[str]:
    main_artist = artist.split(",")[0].strip()
    t = title.replace('"', "").strip()[:120]
    a = main_artist.replace('"', "").strip()[:120]
    out: list[str] = []
    if t and a:
        out.append(f'track:"{t}" artist:"{a}"')
        out.append(f"{t} {a}")
    elif t:
        out.append(t)
    return out


def strip_spotify_metadata(best: dict) -> None:
    """Limpa tudo que liga esta linha ao Spotify/catalog quando não pode gravar a faixa (ex.: collision de spotify_id)."""
    best["spotify_id"] = None
    best["spotify_url"] = None
    best["preview_url"] = None
    best["duration_ms"] = None
    best["track_number"] = None
    best["primary_artist_spotify_id"] = None
    best["primary_artist_name"] = None
    best["album_spotify_id"] = None
    best["album_type_raw"] = None
    best["album_release_raw"] = None
    best["album_total_tracks"] = None
    best["album_cover_url"] = None
    best["album_spotify_page_url"] = None


def pick_best_image_url(images: list) -> Optional[str]:
    if not images:
        return None
    ranked = sorted(images, key=lambda im: im.get("height") or -1, reverse=True)
    u = ranked[0].get("url")
    return u.strip() if isinstance(u, str) and u.strip() else None


def spotify_release_to_pg_date(raw: Optional[str]):
    """Converte release_date da API Spotify (YYYY, YYYY-MM ou YYYY-MM-DD) para date ou None."""
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    try:
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            return datetime.strptime(s, "%Y-%m-%d").date()
        if len(s) == 7 and s[4] == "-":
            return datetime.strptime(f"{s}-01", "%Y-%m-%d").date()
        if len(s) == 4 and s.isdigit():
            return datetime(int(s), 1, 1).date()
    except (ValueError, TypeError):
        return None
    return None


def upsert_artist_row(cur, spotify_id: str, name: str, spotify_url: Optional[str], image_url: Optional[str]) -> None:
    if not spotify_id or not isinstance(spotify_id, str):
        return
    nm = name.strip() if isinstance(name, str) and name.strip() else "Artista"
    genres: list[str] = []
    cur.execute(
        """
        INSERT INTO "artists" ("spotify_id", "name", "genres", "spotify_url", "image_url", "created_at", "updated_at")
        VALUES (%s, %s, %s::text[], %s, %s, NOW(), NOW())
        ON CONFLICT ("spotify_id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "spotify_url" = COALESCE(EXCLUDED."spotify_url", "artists"."spotify_url"),
          "image_url" = COALESCE(EXCLUDED."image_url", "artists"."image_url"),
          "updated_at" = NOW()
        """,
        (spotify_id, nm, genres, spotify_url, image_url),
    )


def upsert_album_row(
    cur,
    album_spotify_id: str,
    title: str,
    artist_spotify_id: str,
    *,
    release_date,
    cover_url: Optional[str],
    spotify_url_a: Optional[str],
    total_tracks: Optional[int],
) -> None:
    if not album_spotify_id or not isinstance(album_spotify_id, str):
        return
    if not artist_spotify_id:
        return
    ttl = title.strip() if isinstance(title, str) and title.strip() else "Álbum"
    tt = None
    if total_tracks is not None:
        try:
            tt = int(total_tracks)
        except (TypeError, ValueError):
            tt = None
    cur.execute(
        """
        INSERT INTO "albums" (
          "spotify_id", "title", "artist_spotify_id",
          "release_date", "cover_url", "spotify_url", "total_tracks",
          "created_at", "updated_at"
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        ON CONFLICT ("spotify_id") DO UPDATE SET
          "title" = EXCLUDED."title",
          "artist_spotify_id" = EXCLUDED."artist_spotify_id",
          "release_date" = COALESCE(EXCLUDED."release_date", "albums"."release_date"),
          "cover_url" = COALESCE(EXCLUDED."cover_url", "albums"."cover_url"),
          "spotify_url" = COALESCE(EXCLUDED."spotify_url", "albums"."spotify_url"),
          "total_tracks" = COALESCE(EXCLUDED."total_tracks", "albums"."total_tracks"),
          "updated_at" = NOW()
        """,
        (album_spotify_id, ttl, artist_spotify_id, release_date, cover_url, spotify_url_a, tt),
    )


def upsert_song_feats_from_spotify_artists(cur, song_spotify_id: str, artists_after_primary: list) -> None:
    """Preenche `song_feats` com artistas adicionais da faixa (Spotify devolve ordem: principal primeiro)."""
    if not song_spotify_id or not artists_after_primary:
        return
    for a in artists_after_primary:
        if not isinstance(a, dict):
            continue
        aid = a.get("id")
        aname = (a.get("name") or "").strip() if isinstance(a.get("name"), str) else ""
        if not aid:
            continue
        upsert_artist_row(cur, str(aid), aname or "Artista", None, None)
        cur.execute(
            """
            INSERT INTO "song_feats" ("song_spotify_id", "artist_spotify_id", "created_at")
            VALUES (%s, %s, NOW())
            ON CONFLICT ("song_spotify_id", "artist_spotify_id") DO NOTHING
            """,
            (song_spotify_id, str(aid)),
        )


def upsert_catalog_from_best(cur, best: dict) -> None:
    """Cria/atualiza artista e álbum catalog (FKs esperadas pela app), alinhado a apply-spotify-metadata-to-song.ts."""
    aid = best.get("primary_artist_spotify_id")
    aname = best.get("primary_artist_name") or ""
    aurl = None
    if not aid:
        return
    upsert_artist_row(cur, str(aid), aname if isinstance(aname, str) else "", aurl, None)

    lid = best.get("album_spotify_id")
    if not lid:
        return
    release_d = spotify_release_to_pg_date(best.get("album_release_raw"))
    alb_title = str(best.get("album") or "").strip() or "Álbum"
    upsert_album_row(
        cur,
        str(lid),
        alb_title,
        str(aid),
        release_date=release_d,
        cover_url=best.get("album_cover_url"),
        spotify_url_a=best.get("album_spotify_page_url"),
        total_tracks=best.get("album_total_tracks"),
    )


class SpotifySlowClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        min_interval_seconds: float,
        jitter_seconds: float = 0.0,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.min_interval_seconds = max(0.0, min_interval_seconds)
        self.jitter_seconds = max(0.0, jitter_seconds)
        self.last_request_at = 0.0
        self.token = ""

    def _throttle(self):
        now = time.monotonic()
        wait = self.min_interval_seconds - (now - self.last_request_at)
        if self.jitter_seconds > 0:
            wait += random.uniform(0.0, self.jitter_seconds)
        if wait > 0:
            time.sleep(wait)

    def _request(self, method: str, url: str, **kwargs) -> requests.Response:
        self._throttle()
        res = requests.request(method=method, url=url, timeout=30, **kwargs)
        self.last_request_at = time.monotonic()
        return res

    def auth(self):
        auth = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode("utf-8")).decode("utf-8")
        res = self._request(
            "POST",
            "https://accounts.spotify.com/api/token",
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
        res.raise_for_status()
        self.token = res.json()["access_token"]

    def search_track(self, query: str, market: str, limit: int = 10) -> requests.Response | None:
        headers = {"Authorization": f"Bearer {self.token}"}
        max_attempts = 10
        for attempt in range(1, max_attempts + 1):
            res = self._request(
                "GET",
                "https://api.spotify.com/v1/search",
                headers=headers,
                params={"q": query, "type": "track", "limit": limit, "market": market},
            )
            if res.status_code != 429:
                return res
            retry_after = res.headers.get("Retry-After")
            try:
                wait_s = max(2.0, float(retry_after)) if retry_after else 3.0
            except ValueError:
                wait_s = 3.0
            wait_s = min(120.0, wait_s * (1.0 + 0.35 * attempt))
            time.sleep(wait_s)
        return None


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


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Importa BANG20 (aba anual) com busca na API Spotify com pacing seguro "
        "(espaço mínimo + jitter entre requisições; respeito a 429/Retry-After)."
    )
    ap.add_argument("--xlsx", required=True, help="Caminho para BANG20oficial.xlsx")
    ap.add_argument("--handle", default="romulolima22", help="Handle do usuário")
    ap.add_argument("--year", type=int, default=2010, help="Ano para importar")
    ap.add_argument(
        "--delay-seconds",
        type=float,
        default=0.85,
        help="Espera base mínima entre cada chamada HTTP à API Spotify (OAuth + search)",
    )
    ap.add_argument(
        "--delay-jitter-seconds",
        type=float,
        default=0.2,
        help="Aleatório extra após delay base (suaviza picos síncronos)",
    )
    ap.add_argument(
        "--out-missing",
        default=None,
        help="JSON de não encontrados (padrão: scripts/_bang20_<ano>_not_found_spotify.json)",
    )
    ap.add_argument(
        "--out-collisions",
        default=None,
        help="JSON de colisões de spotify_id (padrão: scripts/_bang20_<ano>_spotify_id_collisions.json)",
    )
    ap.add_argument(
        "--markets",
        default="BR,US",
        help="Mercados separados por vírgula (ordem preservada; segunda tenta se precisar de mais cobertura)",
    )
    ap.add_argument("--queries-per-song", type=int, default=1, help="Máximo de queries por música")
    args = ap.parse_args()

    if not args.out_missing:
        args.out_missing = str(ROOT / "scripts" / f"_bang20_{args.year}_not_found_spotify.json")
    if not args.out_collisions:
        args.out_collisions = str(ROOT / "scripts" / f"_bang20_{args.year}_spotify_id_collisions.json")

    db_url = (os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL") or "").strip().strip('"').strip("'")
    if not db_url:
        raise SystemExit("Defina DIRECT_URL ou DATABASE_URL no ambiente (.env).")

    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise SystemExit("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no ambiente (.env).")

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    if str(args.year) not in wb.sheetnames:
        raise SystemExit(f"Aba {args.year} não encontrada em {args.xlsx}")

    ws = wb[str(args.year)]
    parsed_weeks = parse_year_sheet(ws)
    all_weeks: list[dict] = []
    for wk in parsed_weeks:
        ref = wk["ref_date"]
        iso_y, iso_w = iso_week_parts(ref)
        all_weeks.append(
            {
                "date": ref,
                "week_index": iso_y * 100 + iso_w,
                "week_label": f"Semana {iso_w} - {iso_y}",
                "entries": wk["entries"],
            }
        )

    markets = [m.strip() for m in args.markets.split(",") if m.strip()]
    spotify = SpotifySlowClient(client_id, client_secret, args.delay_seconds, args.delay_jitter_seconds)
    spotify.auth()

    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    created_charts = 0
    skipped_existing = 0
    created_songs = 0
    reused_from_db = 0
    searched_spotify = 0
    found_on_spotify = 0
    not_found_spotify: list[dict] = []
    spotify_id_collisions: list[dict] = []

    try:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = 0")
            cur.execute('SELECT id FROM "User" WHERE handle = %s', (args.handle,))
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f'Usuário "{args.handle}" não encontrado')
            user_id = row[0]

            cur.execute('SELECT "weekIndex" FROM "Chart" WHERE "userId" = %s', (user_id,))
            existing_indexes = {r[0] for r in cur.fetchall()}
            weeks_to_create = [w for w in all_weeks if w["week_index"] not in existing_indexes]
            skipped_existing = len(all_weeks) - len(weeks_to_create)

            # Busca todas as músicas necessárias para a importação da vez.
            needed_keys: set[tuple[str, str]] = set()
            for wk in weeks_to_create:
                for e in wk["entries"]:
                    needed_keys.add((e["title"], e["artist"]))

            cur.execute(
                'SELECT id, title, artist, album, "spotify_id", "artist_spotify_id", "album_spotify_id", "spotify_url", "preview_url", "duration_ms", "track_number" FROM "Song"'
            )
            rows = cur.fetchall()
            song_map: dict[tuple[str, str], dict] = {}
            for r in rows:
                song_map[(r[1], r[2])] = {
                    "id": r[0],
                    "title": r[1],
                    "artist": r[2],
                    "album": r[3],
                    "spotify_id": r[4],
                    "artist_spotify_id": r[5],
                    "album_spotify_id": r[6],
                    "spotify_url": r[7],
                    "preview_url": r[8],
                    "duration_ms": r[9],
                    "track_number": r[10],
                }

            cur.execute('SELECT spotify_id FROM "Song" WHERE spotify_id IS NOT NULL')
            used_spotify_ids: set[str] = {row[0] for row in cur.fetchall() if row[0]}

            new_song_rows = []
            pending_song_feats: list[tuple[str, list]] = []
            for title, artist in sorted(needed_keys):
                key = (title, artist)
                if key in song_map:
                    reused_from_db += 1
                    continue

                searched_spotify += 1
                best = None
                best_score = -1
                strong_hit = False
                for market in markets:
                    for query in build_queries(title, artist)[: max(1, args.queries_per_song)]:
                        res = spotify.search_track(query, market, limit=15)
                        if res is None or res.status_code >= 400:
                            continue
                        items = res.json().get("tracks", {}).get("items", [])
                        for item in items:
                            got_title = item.get("name") or ""
                            got_artist = ", ".join((a.get("name") or "") for a in item.get("artists", []))
                            sc = score_track_match(title, artist, got_title, got_artist)
                            if sc > best_score:
                                album = item.get("album") or {}
                                artists_li = item.get("artists") or []
                                prim: dict = {}
                                for a in artists_li:
                                    if a.get("id"):
                                        prim = a
                                        break
                                pname = ((prim.get("name") if prim else "") or "").strip()
                                pid = prim.get("id") if prim else None
                                best_score = sc
                                best = {
                                    "spotify_id": item.get("id"),
                                    "spotify_url": (item.get("external_urls") or {}).get("spotify"),
                                    "preview_url": item.get("preview_url"),
                                    "duration_ms": item.get("duration_ms"),
                                    "track_number": item.get("track_number"),
                                    "album": album.get("name"),
                                    "primary_artist_spotify_id": pid,
                                    "primary_artist_name": pname,
                                    "album_spotify_id": album.get("id"),
                                    "album_type_raw": album.get("album_type"),
                                    "album_release_raw": album.get("release_date"),
                                    "album_total_tracks": album.get("total_tracks"),
                                    "album_cover_url": pick_best_image_url(album.get("images") or []),
                                    "album_spotify_page_url": (album.get("external_urls") or {}).get("spotify"),
                                    "best_market": market,
                                    "all_artists": list(artists_li),
                                }
                        # Com título + artista praticamente exatos já basta aceitar candidato forte.
                        if best_score >= 148:
                            strong_hit = True
                            break
                    if strong_hit:
                        break

                song_id = uuid.uuid4().hex
                if best and best_score >= 35:
                    sid = best.get("spotify_id")
                    if sid and sid in used_spotify_ids:
                        spotify_id_collisions.append(
                            {
                                "title": title,
                                "artist": artist,
                                "spotify_id": sid,
                                "reason": "spotify_id_já_existe_no_banco_ou_neste_batch",
                            }
                        )
                        strip_spotify_metadata(best)
                    elif sid:
                        upsert_catalog_from_best(cur, best)
                        used_spotify_ids.add(sid)
                        found_on_spotify += 1
                        all_au = best.get("all_artists") or []
                        if len(all_au) > 1:
                            pending_song_feats.append((sid, all_au[1:]))

                    new_song_rows.append(
                        (
                            song_id,
                            title,
                            artist,
                            best.get("album"),
                            best.get("spotify_id"),
                            best.get("primary_artist_spotify_id"),
                            best.get("album_spotify_id"),
                            best.get("spotify_url"),
                            best.get("preview_url"),
                            best.get("duration_ms"),
                            best.get("track_number"),
                        )
                    )
                    song_map[key] = {
                        "id": song_id,
                        "title": title,
                        "artist": artist,
                        "album": best.get("album"),
                        "spotify_id": best.get("spotify_id"),
                        "artist_spotify_id": best.get("primary_artist_spotify_id"),
                        "album_spotify_id": best.get("album_spotify_id"),
                        "spotify_url": best.get("spotify_url"),
                        "preview_url": best.get("preview_url"),
                        "duration_ms": best.get("duration_ms"),
                        "track_number": best.get("track_number"),
                    }
                else:
                    not_found_spotify.append({"title": title, "artist": artist, "best_score": best_score})
                    new_song_rows.append((song_id, title, artist, None, None, None, None, None, None, None, None))
                    song_map[key] = {
                        "id": song_id,
                        "title": title,
                        "artist": artist,
                        "album": None,
                        "spotify_id": None,
                        "artist_spotify_id": None,
                        "album_spotify_id": None,
                        "spotify_url": None,
                        "preview_url": None,
                        "duration_ms": None,
                        "track_number": None,
                    }

            if new_song_rows:
                execute_values(
                    cur,
                    'INSERT INTO "Song" (id, title, artist, album, "spotify_id", "artist_spotify_id", "album_spotify_id", "spotify_url", "preview_url", "duration_ms", "track_number") VALUES %s ON CONFLICT (title, artist) DO NOTHING',
                    new_song_rows,
                    page_size=200,
                )
                created_songs = len(new_song_rows)
                # Recarrega para garantir IDs em caso de conflito.
                cur.execute(
                    'SELECT id, title, artist, album, "spotify_id", "artist_spotify_id", "album_spotify_id", "spotify_url", "preview_url", "duration_ms", "track_number" FROM "Song"'
                )
                rows = cur.fetchall()
                song_map = {}
                for r in rows:
                    song_map[(r[1], r[2])] = {
                        "id": r[0],
                        "title": r[1],
                        "artist": r[2],
                        "album": r[3],
                        "spotify_id": r[4],
                        "artist_spotify_id": r[5],
                        "album_spotify_id": r[6],
                        "spotify_url": r[7],
                        "preview_url": r[8],
                        "duration_ms": r[9],
                        "track_number": r[10],
                    }

                for sid, tail in pending_song_feats:
                    upsert_song_feats_from_spotify_artists(cur, sid, tail)

            for wk in weeks_to_create:
                end = week_sunday(wk["date"])
                start = end - timedelta(days=6)
                date_range = f"de {format_pt_day_month(start)} a {format_pt_day_month(end)}"
                chart_id = uuid.uuid4().hex
                cur.execute(
                    'INSERT INTO "Chart" (id, "userId", "weekIndex", "weekLabel", "dateRange", "publishedAt", likes, comments, reposts, chart_type, is_published, max_items) VALUES (%s, %s, %s, %s, %s, %s, 0, 0, 0, %s, %s, %s)',
                    (chart_id, user_id, wk["week_index"], wk["week_label"], date_range, end, "SONGS", True, 100),
                )

                entry_rows = []
                for e in wk["entries"]:
                    song = song_map[(e["title"], e["artist"])]
                    (pal_a, pal_b), seed = palette_for(e["artist"], e["title"])
                    entry_rows.append(
                        (
                            uuid.uuid4().hex,
                            chart_id,
                            song["id"],
                            e["position"],
                            e["points"],
                            "new",
                            None,
                            None,
                            e["position"],
                            1,
                            pal_a,
                            pal_b,
                            seed,
                            song["spotify_id"],
                            song["album_spotify_id"],
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

        out_path = Path(args.out_missing)
        out_path.write_text(json.dumps(not_found_spotify, ensure_ascii=False, indent=2), encoding="utf-8")

        col_path = Path(args.out_collisions)
        col_path.write_text(json.dumps(spotify_id_collisions, ensure_ascii=False, indent=2), encoding="utf-8")

        print("IMPORT_OK")
        print(f"year={args.year}")
        print(f"weeks_total={len(all_weeks)}")
        print(f"charts_created={created_charts}")
        print(f"charts_skipped_existing={skipped_existing}")
        print(f"songs_insert_attempted={created_songs}")
        print(f"songs_reused_from_db={reused_from_db}")
        print(f"songs_searched_on_spotify={searched_spotify}")
        print(f"songs_found_on_spotify={found_on_spotify}")
        print(f"songs_not_found_on_spotify={len(not_found_spotify)}")
        print(f"spotify_id_collisions={len(spotify_id_collisions)}")
        print(f"missing_output={out_path.resolve()}")
        print(f"collisions_output={col_path.resolve()}")
        print(f"streak={streak}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
