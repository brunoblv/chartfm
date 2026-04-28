from __future__ import annotations

import argparse
import base64
import json
import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def get_token() -> str:
    client_id = (os.environ.get("SPOTIFY_CLIENT_ID") or "").strip()
    client_secret = (os.environ.get("SPOTIFY_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        raise SystemExit("SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET ausentes.")
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


def parse_track_id(url_or_id: str) -> str:
    s = url_or_id.strip()
    m = re.search(r"/track/([A-Za-z0-9]+)", s)
    if m:
        return m.group(1)
    return s


def fetch_track(track_id: str, token: str, market: str):
    res = requests.get(
        f"https://api.spotify.com/v1/tracks/{track_id}",
        headers={"Authorization": f"Bearer {token}"},
        params={"market": market},
        timeout=30,
    )
    return res


def main() -> None:
    ap = argparse.ArgumentParser(description="Checa existência de faixas do Spotify por mercado.")
    ap.add_argument("--in-json", required=True, help="Arquivo JSON com [{name,url}]")
    ap.add_argument("--markets", default="BR,US,JP,GB", help="Mercados separados por vírgula")
    ap.add_argument("--out", default="scripts/_spotify_link_check_result.json")
    args = ap.parse_args()

    data = json.loads(Path(args.in_json).read_text(encoding="utf-8"))
    markets = [m.strip().upper() for m in args.markets.split(",") if m.strip()]
    token = get_token()

    out = []
    for item in data:
        name = item["name"]
        track_id = parse_track_id(item["url"])
        row = {"name": name, "track_id": track_id, "markets": {}, "canonical": None}
        for market in markets:
            res = fetch_track(track_id, token, market)
            row["markets"][market] = res.status_code
            if res.status_code == 200 and row["canonical"] is None:
                j = res.json()
                row["canonical"] = {
                    "title": j.get("name"),
                    "artist": ", ".join(a.get("name", "") for a in j.get("artists", [])),
                    "album": (j.get("album") or {}).get("name"),
                    "external_url": (j.get("external_urls") or {}).get("spotify"),
                }
        out.append(row)

    out_path = Path(args.out)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK checked={len(out)} output={out_path.resolve()}")


if __name__ == "__main__":
    main()
