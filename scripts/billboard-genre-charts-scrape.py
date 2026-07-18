"""
Raspa charts de genero da Billboard (nao o Hot 100) semana a semana, desde
~1990 ate hoje, e salva um JSON por chart em scripts/data/billboard-genre-charts/.

Formato de saida (por chart), lista de semanas:
  [{"date": "2024-06-15", "data": [{"rank": 1, "song": "...", "artist": "...",
     "peakPos": 1, "weeksOnChart": 9, "isNew": false}, ...]}, ...]

Resumavel: se o arquivo do chart ja existe, continua da ultima data salva + 7 dias.
Rate limit conservador (1.2-2.2s entre requests, por chart) para evitar bloqueio.
Se levar varios 403/erros seguidos, para e preserva o progresso salvo ate ali.

Uso:
  python scripts/billboard-genre-charts-scrape.py
  python scripts/billboard-genre-charts-scrape.py --chart hot-mainstream-rock-tracks
  python scripts/billboard-genre-charts-scrape.py --start 1990-01-01
"""

import argparse
import json
import random
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

CHARTS = [
    ("hot-mainstream-rock-tracks", "Mainstream Rock Airplay"),
    ("alternative-airplay", "Alternative Airplay"),
    ("hot-rock-songs", "Hot Rock & Alternative Songs"),
    ("hot-hard-rock-songs", "Hot Hard Rock Songs"),
    ("rock-airplay", "Rock Airplay"),
    ("country-airplay", "Country Airplay"),
    ("r-b-hip-hop-songs", "Hot R&B/Hip-Hop Songs"),
    ("rap-song", "Hot Rap Songs"),
    ("latin-songs", "Hot Latin Songs"),
    ("dance-electronic-songs", "Hot Dance/Electronic Songs"),
    ("pop-songs", "Pop Airplay"),
    ("adult-contemporary", "Adult Contemporary"),
    ("triple-a", "Triple A (Adult Album Alternative) Airplay"),
    ("rhythmic-40", "Rhythmic Airplay"),
]

DEFAULT_START = "1990-01-01"
DATA_DIR = Path(__file__).parent / "data" / "billboard-genre-charts"
MAX_CONSECUTIVE_ERRORS = 5
DELAY_RANGE = (1.2, 2.2)


def fetch_week(session: requests.Session, slug: str, req_date: str):
    url = f"https://www.billboard.com/charts/{slug}/{req_date}"
    resp = session.get(url, timeout=20)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    date_el = soup.select_one("#chart-date-picker")
    actual_date = date_el.get("data-date") if date_el else None
    if not actual_date:
        return None

    rows = soup.select("ul.o-chart-results-list-row")
    entries = []
    for row in rows:
        rank_el = row.select_one("li span.c-label")
        title_el = row.select_one("#title-of-a-story")
        artist_el = row.select_one("#title-of-a-story + span")
        if not title_el or not rank_el:
            continue
        try:
            rank = int(rank_el.get_text(strip=True))
        except ValueError:
            continue
        song = title_el.get_text(strip=True)
        artist = artist_el.get_text(strip=True) if artist_el else ""

        meta_lis = row.select("ul.lrv-a-unstyle-list li")
        peak_pos = weeks_on_chart = None
        if len(meta_lis) >= 3:
            texts = [li.get_text(strip=True) for li in meta_lis]
            digits = [t for t in texts if t.isdigit()]
            if len(digits) >= 2:
                peak_pos, weeks_on_chart = int(digits[-2]), int(digits[-1])

        entries.append(
            {
                "rank": rank,
                "song": song,
                "artist": artist,
                "peakPos": peak_pos,
                "weeksOnChart": weeks_on_chart,
            }
        )

    return {"date": actual_date, "data": entries}


def load_existing(path: Path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save(path: Path, weeks: list):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(weeks, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


def scrape_chart(slug: str, label: str, start: str, end: str):
    path = DATA_DIR / f"{slug}.json"
    weeks = load_existing(path)
    seen_dates = {w["date"] for w in weeks}

    cursor = weeks[-1]["date"] if weeks else start
    if weeks:
        cursor = (date.fromisoformat(weeks[-1]["date"]) + timedelta(days=7)).isoformat()

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    print(f"\n=== {label} ({slug}) === resumindo em {cursor}, {len(weeks)} semanas ja salvas")

    consecutive_errors = 0
    new_weeks = 0
    while cursor <= end:
        try:
            week = fetch_week(session, slug, cursor)
            consecutive_errors = 0
        except requests.exceptions.RequestException as exc:
            consecutive_errors += 1
            print(f"  erro em {cursor}: {exc} (tentativa {consecutive_errors})")
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                print(f"  {MAX_CONSECUTIVE_ERRORS} erros seguidos, parando este chart (progresso salvo).")
                break
            time.sleep(5 * consecutive_errors)
            continue

        if week is None:
            print(f"  sem dado em {cursor}, encerrando chart (fim do historico ou chart inexistente)")
            break

        if week["date"] > end:
            break

        if week["date"] not in seen_dates:
            weeks.append(week)
            seen_dates.add(week["date"])
            new_weeks += 1
            if new_weeks % 20 == 0:
                save(path, weeks)
                print(f"  ... {new_weeks} semanas novas ate {week['date']} (salvo)")

        cursor = (date.fromisoformat(week["date"]) + timedelta(days=7)).isoformat()
        time.sleep(random.uniform(*DELAY_RANGE))

    save(path, weeks)
    print(f"  concluido: {new_weeks} semanas novas, {len(weeks)} semanas totais salvas em {path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chart", help="raspar apenas este slug de chart")
    parser.add_argument("--start", default=DEFAULT_START)
    parser.add_argument("--end", default=date.today().isoformat())
    args = parser.parse_args()

    charts = CHARTS
    if args.chart:
        charts = [c for c in CHARTS if c[0] == args.chart]
        if not charts:
            print(f"chart desconhecido: {args.chart}")
            sys.exit(1)

    for slug, label in charts:
        scrape_chart(slug, label, args.start, args.end)


if __name__ == "__main__":
    main()
