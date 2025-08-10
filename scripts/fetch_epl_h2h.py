#!/usr/bin/env python3
"""
Fetch current EPL head-to-head (moneyline) odds.

Calls:
  GET /v4/sports/soccer_epl/odds?regions=<regions>&markets=h2h[&bookmakers=...]

Examples:
  python scripts/fetch_epl_h2h.py --regions uk,eu,us
  python scripts/fetch_epl_h2h.py --regions uk --bookmakers betfair,bet365

Outputs JSON to data/pl_h2h_odds_<YYYY-MM-DD>.json
Requires ODDS_API_KEY in environment or .env
"""
import os
import sys
import json
import argparse
import pathlib
from datetime import date
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ODDS_API_KEY")
DEFAULT_REGIONS = "uk,eu,us"
MARKET = "h2h"

OUT_DIR = pathlib.Path("data")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def get(url: str) -> requests.Response:
    r = requests.get(url, timeout=30)
    try:
        r.raise_for_status()
    finally:
        xr = r.headers.get("x-requests-remaining")
        xu = r.headers.get("x-requests-used")
        xl = r.headers.get("x-requests-last")
        if xr or xu or xl:
            print(f"Quota → remaining={xr} used={xu} last={xl}")
    return r


def fetch_h2h(regions: str, bookmakers: str | None) -> List[Dict[str, Any]]:
    base = "https://api.the-odds-api.com/v4/sports/soccer_epl/odds"
    params = [f"regions={regions}", f"markets={MARKET}", f"apiKey={API_KEY}"]
    if bookmakers:
        params.append(f"bookmakers={bookmakers}")
    url = f"{base}?" + "&".join(params)
    print(f"GET {url}")
    r = get(url)
    return r.json()


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch EPL h2h odds (soccer_epl)")
    parser.add_argument("--regions", default=DEFAULT_REGIONS, help="Comma-separated regions (default: uk,eu,us)")
    parser.add_argument(
        "--bookmakers",
        default="draftkings",
        help="Comma-separated bookmakers (default: draftkings)",
    )
    parser.add_argument("--out", help="Output filename (optional)")
    args = parser.parse_args()

    if not API_KEY:
        print("ODDS_API_KEY not set. Create a .env or export it.", file=sys.stderr)
        sys.exit(1)

    try:
        data = fetch_h2h(args.regions, args.bookmakers)
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 'ERR'
        body = e.response.text.strip() if e.response is not None else ''
        print(f"Failed to fetch h2h: HTTP {status} {body}", file=sys.stderr)
        sys.exit(1)

    out_file = pathlib.Path(args.out) if args.out else OUT_DIR / f"pl_h2h_odds_{date.today().isoformat()}.json"
    with open(out_file, "w") as fp:
        json.dump(data, fp, indent=2, sort_keys=True)
    print(f"Saved EPL h2h odds → {out_file}")
    # Light summary
    print(f"Items: {len(data)}")
    if isinstance(data, list) and data:
        sample = data[0]
        home = sample.get("home_team")
        away = sample.get("away_team")
        print(f"Sample event: {away} at {home}")


if __name__ == "__main__":
    main()
