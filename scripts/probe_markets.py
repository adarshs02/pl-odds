#!/usr/bin/env python3
"""
Probe which markets are available for a given sport key via /v4/sports/{sport}/odds.

Examples:
  python scripts/probe_markets.py soccer_epl
  python scripts/probe_markets.py soccer_epl --regions uk --bookmakers betfair,bet365

Requires ODDS_API_KEY in environment or .env
"""
import os
import sys
import json
import argparse
from typing import List, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("ODDS_API_KEY")

# A starter set of common soccer market keys to probe.
DEFAULT_MARKETS = [
    # popular match markets
    "h2h",
    "spreads",
    "totals",
    "draw_no_bet",
    "both_teams_to_score",
    "team_totals",
    # futures (often NOT supported via {sport}/odds for soccer)
    "outrights",
]


def get(url: str) -> requests.Response:
    r = requests.get(url, timeout=25)
    r.raise_for_status()
    return r


def probe(sport: str, regions: str, bookmakers: str, markets: List[str]) -> List[Tuple[str, str]]:
    results: List[Tuple[str, str]] = []
    for m in markets:
        url = (
            "https://api.the-odds-api.com/v4/sports/"
            f"{sport}/odds?regions={regions}&markets={m}&bookmakers={bookmakers}&apiKey={API_KEY}"
        )
        try:
            r = get(url)
            data = r.json()
            status = f"OK ({len(data)} items)"
        except requests.HTTPError as e:
            status = f"HTTP {e.response.status_code}: {e.response.text.strip() if e.response is not None else e}"
        except Exception as e:
            status = f"ERROR: {e}"
        results.append((m, status))
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe available markets for a sport key")
    parser.add_argument("sport", help="Sport key, e.g., soccer_epl")
    parser.add_argument("--regions", default="uk", help="Comma-separated regions (default: uk)")
    parser.add_argument(
        "--bookmakers",
        default="betfair,bet365,pinnacle",
        help="Comma-separated bookmakers (default: betfair,bet365,pinnacle)",
    )
    parser.add_argument(
        "--markets",
        help="Comma-separated market keys to probe (default: a common set)",
    )
    args = parser.parse_args()

    if not API_KEY:
        print("ODDS_API_KEY not set. Create a .env or export it in your shell.", file=sys.stderr)
        sys.exit(1)

    markets = [m.strip() for m in (args.markets.split(",") if args.markets else DEFAULT_MARKETS) if m.strip()]
    results = probe(args.sport, args.regions, args.bookmakers, markets)

    print(json.dumps({"sport": args.sport, "regions": args.regions, "bookmakers": args.bookmakers, "results": results}, indent=2))


if __name__ == "__main__":
    main()
