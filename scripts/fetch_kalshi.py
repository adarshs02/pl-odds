#!/usr/bin/env python3
"""
Fetch EPL prediction market data from Kalshi's public API.

No API key required. Fetches:
  1. EPL Winner futures (series: KXPREMIERLEAGUE)
  2. EPL Top 4 Finish futures (series: KXEPLTOP4)
  3. EPL Match outcomes (series: KXEPLGAME)

Outputs JSON to data/kalshi_epl_YYYY-MM-DD.json
"""
import json
import pathlib
import sys
from collections import defaultdict
from datetime import datetime, timezone

import requests

KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2"
OUT_DIR = pathlib.Path("data")
OUT_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from team_names import normalize_kalshi, EPL_TEAMS


def fetch_markets(series_ticker, status="open", limit=100):
    """Fetch all markets for a series ticker."""
    url = f"{KALSHI_API}/markets"
    params = {"series_ticker": series_ticker, "status": status, "limit": limit}
    print(f"GET {url}?series_ticker={series_ticker}&status={status}")
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    return r.json().get("markets", [])


def fetch_event(event_ticker):
    """Fetch a single event by ticker."""
    url = f"{KALSHI_API}/events/{event_ticker}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.json().get("event", {})


def parse_futures(markets, label):
    """Parse futures markets into a list of {team, probability, volume}."""
    results = []
    for m in markets:
        if m.get("status") != "active":
            continue

        raw_name = m.get("yes_sub_title", "")
        if not raw_name:
            continue

        team = normalize_kalshi(raw_name)
        if team not in EPL_TEAMS:
            print(f"  Warning: Unrecognized team '{raw_name}' -> '{team}' in {label}")
            continue

        # last_price is in cents (72 = 72% probability)
        prob = (m.get("last_price", 0) or 0) / 100.0
        volume = m.get("volume", 0) or 0
        liquidity = m.get("liquidity", 0) or 0

        results.append({
            "team": team,
            "probability": round(prob, 4),
            "volume": round(volume, 2),
            "liquidity": round(abs(liquidity), 2),
        })

    results.sort(key=lambda x: x["probability"], reverse=True)
    return results


def parse_match_outcomes(markets):
    """
    Group match markets by event_ticker and extract home/draw/away probabilities.
    Each match has 3 markets sharing the same event_ticker.
    """
    # Group markets by event
    events = defaultdict(list)
    for m in markets:
        if m.get("status") != "active":
            continue
        events[m["event_ticker"]].append(m)

    results = []
    for event_ticker, event_markets in events.items():
        if len(event_markets) < 3:
            continue

        # Parse event_ticker for date: KXEPLGAME-26FEB22TOTARS
        # The title from the event gives "Home vs Away"
        # But we can also derive from ticker suffix
        tie_market = None
        team_markets = []
        for m in event_markets:
            sub = m.get("yes_sub_title", "")
            if sub == "Tie":
                tie_market = m
            else:
                team_markets.append(m)

        if not tie_market or len(team_markets) != 2:
            continue

        # Determine home/away from event title format "Home vs Away"
        # We need to fetch the event or parse the ticker
        # The ticker suffix has home first: e.g. KXEPLGAME-26FEB22TOTARS
        # Extract the team codes from ticker
        ticker_parts = event_ticker.split("-")
        if len(ticker_parts) < 2:
            continue

        # Get close_time for match timing
        close_time = tie_market.get("close_time", "")

        # The event title tells us home vs away - extract from ticker
        # e.g., "26FEB22TOTARS" -> home=TOT, away=ARS
        date_teams = ticker_parts[-1]  # e.g., "26FEB22TOTARS"

        # Determine which team_market is home/away by checking ticker suffix
        # e.g., KXEPLGAME-26FEB22TOTARS-TOT (home), KXEPLGAME-26FEB22TOTARS-ARS (away)
        home_market = None
        away_market = None

        for m in team_markets:
            m_ticker = m.get("ticker", "")
            suffix = m_ticker.split("-")[-1]  # e.g., "TOT" or "ARS"
            # Home team code appears first in the date_teams string
            # Find position of this suffix in date_teams
            # Strip the date prefix (digits + month + digits)
            import re
            teams_part = re.sub(r'^\d+[A-Z]{3}\d+', '', date_teams)
            # teams_part is like "TOTARS" - first 3 chars = home, last 3 = away
            if len(teams_part) >= 6:
                home_code = teams_part[:3]
                away_code = teams_part[3:]
                if suffix == home_code:
                    home_market = m
                elif suffix == away_code:
                    away_market = m
                else:
                    # Try matching by position
                    if home_market is None:
                        home_market = m
                    else:
                        away_market = m
            else:
                if home_market is None:
                    home_market = m
                else:
                    away_market = m

        if not home_market or not away_market:
            continue

        home_name = normalize_kalshi(home_market.get("yes_sub_title", ""))
        away_name = normalize_kalshi(away_market.get("yes_sub_title", ""))

        if home_name not in EPL_TEAMS:
            print(f"  Warning: Unrecognized home team '{home_market.get('yes_sub_title')}' -> '{home_name}'")
            continue
        if away_name not in EPL_TEAMS:
            print(f"  Warning: Unrecognized away team '{away_market.get('yes_sub_title')}' -> '{away_name}'")
            continue

        home_prob = (home_market.get("last_price", 0) or 0) / 100.0
        draw_prob = (tie_market.get("last_price", 0) or 0) / 100.0
        away_prob = (away_market.get("last_price", 0) or 0) / 100.0

        # Normalize probabilities to sum to 1.0
        total = home_prob + draw_prob + away_prob
        if total > 0:
            home_prob = round(home_prob / total, 4)
            draw_prob = round(draw_prob / total, 4)
            away_prob = round(away_prob / total, 4)

        total_volume = sum(m.get("volume", 0) or 0 for m in event_markets)

        results.append({
            "homeTeam": home_name,
            "awayTeam": away_name,
            "commenceTime": close_time,
            "homeWinProb": home_prob,
            "drawProb": draw_prob,
            "awayWinProb": away_prob,
            "totalVolume": round(total_volume, 2),
        })

    results.sort(key=lambda x: x["commenceTime"])
    return results


def main():
    print("=" * 60)
    print("Fetching Kalshi EPL Data")
    print("=" * 60)

    output = {
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "winnerFutures": [],
        "top4Futures": [],
        "matchOutcomes": [],
    }

    # 1. EPL Winner futures
    try:
        print("\n--- EPL Winner ---")
        markets = fetch_markets("KXPREMIERLEAGUE")
        output["winnerFutures"] = parse_futures(markets, "EPL Winner")
        print(f"  Found {len(output['winnerFutures'])} teams")
        for f in output["winnerFutures"][:5]:
            print(f"    {f['team']}: {f['probability']:.1%}")
    except Exception as e:
        print(f"  Error fetching winner futures: {e}")

    # 2. EPL Top 4 Finish futures
    try:
        print("\n--- EPL Top 4 Finish ---")
        markets = fetch_markets("KXEPLTOP4")
        output["top4Futures"] = parse_futures(markets, "EPL Top 4")
        print(f"  Found {len(output['top4Futures'])} teams")
        for f in output["top4Futures"][:5]:
            print(f"    {f['team']}: {f['probability']:.1%}")
    except Exception as e:
        print(f"  Error fetching top-4 futures: {e}")

    # 3. EPL Match outcomes
    try:
        print("\n--- EPL Match Outcomes ---")
        markets = fetch_markets("KXEPLGAME")
        output["matchOutcomes"] = parse_match_outcomes(markets)
        print(f"  Found {len(output['matchOutcomes'])} matches")
        for m in output["matchOutcomes"][:5]:
            print(f"    {m['homeTeam']} vs {m['awayTeam']}: "
                  f"{m['homeWinProb']:.0%}/{m['drawProb']:.0%}/{m['awayWinProb']:.0%}")
    except Exception as e:
        print(f"  Error fetching match outcomes: {e}")

    # Save output
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_file = OUT_DIR / f"kalshi_epl_{today}.json"
    with open(out_file, "w") as fp:
        json.dump(output, fp, indent=2)

    print(f"\nSaved -> {out_file}")
    total = (len(output["winnerFutures"]) + len(output["top4Futures"])
             + len(output["matchOutcomes"]))
    print(f"Total entries: {total}")


if __name__ == "__main__":
    main()
