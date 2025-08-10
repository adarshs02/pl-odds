#!/usr/bin/env python3
"""
Fetch Premier League (EPL) league winner outrights if available.

This script discovers dedicated outrights sport keys via /v4/sports?all=true&outrights=true
and then queries /v4/sports/{sport_key}/odds with markets=outrights.

Output: data/pl_winner_odds_<YYYY-MM-DD>.json (if data is available)

Requires ODDS_API_KEY in environment or .env
"""
import os
import json
import pathlib
import re
import sys
from datetime import date
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ODDS_API_KEY")
REGION = os.getenv("ODDS_REGION", "uk")
BOOKMAKERS = os.getenv("ODDS_BOOKMAKERS", "draftkings,skybet,pinnacle")
MARKET = "outrights"

OUT_DIR = pathlib.Path("data")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def get(url: str) -> Dict[str, Any] | List[Any]:
    r = requests.get(url, timeout=25)
    try:
        r.raise_for_status()
    finally:
        # quota logging
        xr = r.headers.get("x-requests-remaining")
        xu = r.headers.get("x-requests-used")
        xl = r.headers.get("x-requests-last")
        if xr or xu or xl:
            print(f"Quota → remaining={xr} used={xu} last={xl}")
    return r.json()


essential_patterns = [
    re.compile(r"soccer_epl.*winner", re.I),
    re.compile(r"epl.*winner", re.I),
    re.compile(r"premier.*winner", re.I),
    re.compile(r"champion", re.I),
]

candidate_keys = [
    "soccer_epl_winner",
    "soccer_epl_champion",
    # try some alternative styles we've seen in other leagues
    "soccer_england_premier_league_winner",
]


def discover_epl_winner_key() -> str | None:
    if not API_KEY:
        print("ODDS_API_KEY not set. Create a .env or export it in your shell.", file=sys.stderr)
        sys.exit(1)

    # Discover sports including outrights keys
    sports_url = f"https://api.the-odds-api.com/v4/sports?apiKey={API_KEY}&all=true&outrights=true"
    print(f"GET {sports_url}")
    sports = get(sports_url)
    if not isinstance(sports, list):
        print("Unexpected /sports response (expected a list)", file=sys.stderr)
        return None

    # Prefer explicit candidates
    keys = [str(s.get("key", "")) for s in sports]
    epl_keys = [k for k in keys if k.startswith("soccer_epl")]
    print(f"Discovered EPL-related keys: {epl_keys}")

    for cand in candidate_keys:
        if cand in epl_keys:
            return cand

    # Regex scan across discovered EPL keys
    for k in epl_keys:
        if any(p.search(k) for p in essential_patterns):
            return k

    # Last resort: probe candidates directly
    for cand in candidate_keys:
        probe = (
            "https://api.the-odds-api.com/v4/sports/"
            f"{cand}/odds?regions={REGION}&markets={MARKET}&bookmakers={BOOKMAKERS}&apiKey={API_KEY}"
        )
        print(f"Probing candidate {cand} …")
        try:
            _ = get(probe)
            print(f"Candidate accepted by API: {cand}")
            return cand
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else 'ERR'
            body = ''
            try:
                if e.response is not None:
                    body = e.response.text.strip()
            except Exception:
                body = ''
            print(f"Candidate invalid: {cand} → HTTP {status} {body}")
        except Exception as e:
            print(f"Candidate error: {cand} → {e}")

    return None


def fetch_and_save_winner(key: str) -> bool:
    url = (
        "https://api.the-odds-api.com/v4/sports/"
        f"{key}/odds?regions={REGION}&markets={MARKET}&bookmakers={BOOKMAKERS}&apiKey={API_KEY}"
    )
    print(f"GET {url}")
    try:
        data = get(url)
    except requests.HTTPError as e:
        print(f"Failed to fetch odds for {key}: HTTP {e.response.status_code if e.response else 'ERR'}", file=sys.stderr)
        return False

    today = date.today().isoformat()
    out_file = OUT_DIR / f"pl_winner_odds_{today}.json"
    with open(out_file, "w") as fp:
        json.dump(data, fp, indent=2, sort_keys=True)
    print(f"Saved EPL winner odds → {out_file}")
    return True


def fetch_and_save_direct_soccer_epl_outrights() -> bool:
    """Directly query soccer_epl with markets=outrights (no bookmakers), per user request."""
    url = (
        "https://api.the-odds-api.com/v4/sports/"
        f"soccer_epl/odds?regions={REGION}&markets={MARKET}&apiKey={API_KEY}"
    )
    print(f"GET {url}")
    try:
        data = get(url)
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 'ERR'
        body = ''
        try:
            if e.response is not None:
                body = e.response.text.strip()
        except Exception:
            body = ''
        print(f"Direct soccer_epl outrights failed → HTTP {status} {body}", file=sys.stderr)
        return False

    today = date.today().isoformat()
    out_file = OUT_DIR / f"pl_winner_odds_{today}.json"
    with open(out_file, "w") as fp:
        json.dump(data, fp, indent=2, sort_keys=True)
    print(f"Saved EPL winner odds (direct soccer_epl outrights) → {out_file}")
    return True


def main() -> None:
    key = discover_epl_winner_key()
    if not key:
        print("No dedicated EPL outrights key found. Trying direct soccer_epl/odds with markets=outrights …")
        if fetch_and_save_direct_soccer_epl_outrights():
            sys.exit(0)
        print(
            "No EPL outrights available via soccer_epl at this time. "
            "Will try again when futures are published.",
            file=sys.stderr,
        )
        sys.exit(0)

    ok = fetch_and_save_winner(key)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
