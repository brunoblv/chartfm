from __future__ import annotations

import argparse
import base64
import json
import re
import time
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import openpyxl
import requests
from dateutil import parser as date_parser
from dotenv import load_dotenv
import os


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


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


def extract_unique_songs(xlsx_path: Path, year: int) -> list[tuple[str, str]]:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb[str(year)]

    songs: list[tuple[str, str]] = []
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


def get_spotify_token(client_id: str, client_secret: str) -> str:
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
    res = requests.post(
        "https://accounts.spotify.com/api/token",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
        timeout=30,
    )
    res.raise_for_status()
    return res.json()["access_token"]


def spotify_search_with_retry(
    headers: dict,
    query: str,
    market: str,
    *,
    max_attempts: int = 6,
) -> requests.Response | None:
    for attempt in range(1, max_attempts + 1):
        res = requests.get(
            "https://api.spotify.com/v1/search",
            headers=headers,
            params={"q": query, "type": "track", "limit": 15, "market": market},
            timeout=30,
        )
        if res.status_code != 429:
            return res
        retry_after = res.headers.get("Retry-After")
        try:
            wait_s = max(0.5, float(retry_after)) if retry_after is not None else 1.0
        except ValueError:
            wait_s = 1.0
        wait_s = min(10.0, wait_s + (attempt - 1) * 0.25)
        time.sleep(wait_s)
    return None


def main() -> None:
    ap = argparse.ArgumentParser(description="Valida correspondência Spotify para aba anual BANG20 sem gravar no banco.")
    ap.add_argument("--xlsx", required=True, help="Caminho para BANG20oficial.xlsx")
    ap.add_argument("--year", type=int, default=2010, help="Ano da aba")
    ap.add_argument("--out", default="scripts/_unmatched_2010.json", help="Arquivo JSON de saída")
    ap.add_argument("--markets", default="US,JP,KR,BR,GB", help="Mercados separados por vírgula")
    ap.add_argument("--queries-per-song", type=int, default=2, help="Máximo de queries por música")
    ap.add_argument("--print-every", type=int, default=25, help="Frequência de progresso")
    ap.add_argument("--dump-sample", type=int, default=0, help="Mostra N músicas extraídas e sai")
    ap.add_argument("--debug-first", action="store_true", help="Debuga apenas a primeira música e sai")
    args = ap.parse_args()

    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise SystemExit("SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET ausentes no ambiente.")

    uniq_songs = extract_unique_songs(Path(args.xlsx), args.year)
    if args.dump_sample > 0:
        print(f"unique_songs={len(uniq_songs)}")
        for idx, (title, artist) in enumerate(uniq_songs[: args.dump_sample], start=1):
            print(f"{idx:03d}. {artist} - {title}")
        return
    token = get_spotify_token(client_id, client_secret)

    headers = {"Authorization": f"Bearer {token}"}
    markets = [m.strip() for m in args.markets.split(",") if m.strip()]

    unmatched: list[dict] = []
    matched = 0

    for i, (title, artist) in enumerate(uniq_songs, start=1):
        best = None
        best_score = -1

        for market in markets:
            for query in build_queries(title, artist)[: max(1, args.queries_per_song)]:
                res = spotify_search_with_retry(headers, query, market)
                if res is None:
                    if args.debug_first:
                        print(f"DEBUG query={query!r} market={market} status=429(retries_exceeded)", flush=True)
                    continue
                if args.debug_first:
                    print(f"DEBUG query={query!r} market={market} status={res.status_code}", flush=True)
                if res.status_code >= 400:
                    continue

                items = res.json().get("tracks", {}).get("items", [])
                if args.debug_first:
                    print(f"DEBUG items={len(items)}", flush=True)
                for item in items:
                    got_title = item.get("name") or ""
                    got_artist = ", ".join((a.get("name") or "") for a in item.get("artists", []))
                    sc = score_track_match(title, artist, got_title, got_artist)
                    if sc > best_score:
                        best_score = sc
                        best = {
                            "spotify_id": item.get("id"),
                            "title": got_title,
                            "artist": got_artist,
                            "market": market,
                            "score": sc,
                        }
                    if args.debug_first:
                        print(
                            f"DEBUG cand={got_artist} - {got_title} score={sc}",
                            flush=True,
                        )
                time.sleep(0.15)

        if best and best_score >= 35:
            matched += 1
        else:
            unmatched.append(
                {
                    "title": title,
                    "artist": artist,
                    "best_score": best_score,
                    "best_candidate": best,
                }
            )
        if i == 1 or i % max(1, args.print_every) == 0 or i == len(uniq_songs):
            print(f"[{i}/{len(uniq_songs)}] matched={matched} unmatched={len(unmatched)}", flush=True)
        if args.debug_first:
            print(f"DEBUG best_score={best_score} best={best}", flush=True)
            break

    out_path = Path(args.out)
    out_path.write_text(json.dumps(unmatched, ensure_ascii=False, indent=2), encoding="utf-8")

    print("CHECK_DONE")
    print(f"unique_songs={len(uniq_songs)}")
    print(f"matched={matched}")
    print(f"unmatched={len(unmatched)}")
    print(f"output={out_path.resolve()}")


if __name__ == "__main__":
    main()
