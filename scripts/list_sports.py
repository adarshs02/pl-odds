#!/usr/bin/env python3
"""
List available sports from The Odds API (v4) with optional filters.

Usage examples:
  # Basic list (in-season featured sports)
  python scripts/list_sports.py

  # Include out-of-season and outrights (futures) keys
  python scripts/list_sports.py --all --outrights

  # Find EPL-related keys
  python scripts/list_sports.py --outrights --contains soccer_epl

  # Regex match against key/title
  python scripts/list_sports.py --regex 'epl.*winner'

Requires ODDS_API_KEY in environment or .env file.
"""
import os
import sys
import json
import re
import argparse
from typing import List, Dict, Any

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ODDS_API_KEY")


def die(msg: str, code: int = 1) -> None:
    print(f"Error: {msg}", file=sys.stderr)
    sys.exit(code)


def build_url(api_key: str, include_all: bool, include_outrights: bool) -> str:
    base = "https://api.the-odds-api.com/v4/sports"
    params = [f"apiKey={api_key}"]
    if include_all:
        params.append("all=true")
    if include_outrights:
        params.append("outrights=true")
    return f"{base}?" + "&".join(params)


def get_json(url: str) -> Any:
    print(f"GET {url}")
    r = requests.get(url, timeout=20)
    try:
        r.raise_for_status()
    finally:
        xr = r.headers.get("x-requests-remaining")
        xu = r.headers.get("x-requests-used")
        xl = r.headers.get("x-requests-last")
        if xr or xu or xl:
            print(f"Quota → remaining={xr} used={xu} last={xl}")
    return r.json()


def filter_sports(
    sports: List[Dict[str, Any]],
    contains: str | None,
    regex: str | None,
    group: str | None,
) -> List[Dict[str, Any]]:
    res = sports
    if group:
        res = [s for s in res if str(s.get("group", "")).lower() == group.lower()]
    if contains:
        needle = contains.lower()
        res = [
            s for s in res
            if needle in str(s.get("key", "")).lower() or needle in str(s.get("title", "")).lower()
        ]
    if regex:
        pat = re.compile(regex, re.I)
        res = [s for s in res if pat.search(str(s.get("key", ""))) or pat.search(str(s.get("title", "")))]
    return res


def print_table(sports: List[Dict[str, Any]], limit: int | None) -> None:
    rows = []
    for s in sports[: limit or None]:
        rows.append(
            (
                str(s.get("key", "-")),
                str(s.get("title", s.get("sport_title", "-"))),
                str(s.get("group", "-")),
                str(s.get("active", "-")),
            )
        )
    if not rows:
        print("No sports found with the specified filters.")
        return
    # column widths
    header_row = ("key", "title", "group", "active")
    w_key = max(len(r[0]) for r in rows + [header_row])
    w_title = max(len(r[1]) for r in rows + [header_row])
    w_group = max(len(r[2]) for r in rows + [header_row])
    w_active = max(len(r[3]) for r in rows + [header_row])

    header = f"{ 'key'.ljust(w_key) }  { 'title'.ljust(w_title) }  { 'group'.ljust(w_group) }  { 'active'.ljust(w_active) }"
    print(header)
    print("-" * len(header))
    for r in rows:
        print(f"{ r[0].ljust(w_key) }  { r[1].ljust(w_title) }  { r[2].ljust(w_group) }  { r[3].ljust(w_active) }")


def main() -> None:
    parser = argparse.ArgumentParser(description="List sports from The Odds API v4")
    parser.add_argument("--all", action="store_true", help="Include out-of-season sports")
    parser.add_argument("--outrights", action="store_true", help="Include futures/outrights keys")
    parser.add_argument("--contains", help="Substring to match in key or title")
    parser.add_argument("--regex", help="Regex to match against key or title")
    parser.add_argument("--group", help="Filter by group name (e.g., Soccer)")
    parser.add_argument("--json", dest="as_json", action="store_true", help="Output raw JSON instead of a table")
    parser.add_argument("--limit", type=int, help="Limit number of rows displayed")

    args = parser.parse_args()

    if not API_KEY:
        die("ODDS_API_KEY not found in environment. Create a .env or set environment variable.")

    url = build_url(API_KEY, args.all, args.outrights)
    data = get_json(url)

    if not isinstance(data, list):
        die("Unexpected response for /sports endpoint (expected a list)")

    filtered = filter_sports(data, args.contains, args.regex, args.group)

    if args.as_json:
        print(json.dumps(filtered[: args.limit or None], indent=2, sort_keys=True))
    else:
        print_table(filtered, args.limit)
        print(f"\nTotal shown: {min(len(filtered), args.limit) if args.limit else len(filtered)} / {len(data)} (after filters)")


if __name__ == "__main__":
    main()
