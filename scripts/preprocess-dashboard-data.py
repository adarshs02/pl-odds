#!/usr/bin/env python3
"""
Preprocesses raw data files into optimized aggregated JSON files for the dashboard.
Generates:
1. team-performance-history.json - All team stats and match histories
2. latest-odds.json - Upcoming matches with merged h2h + spread odds
"""
import os
import json
import pathlib
from datetime import datetime
from collections import defaultdict

DATA_DIR = pathlib.Path("data")
OUTPUT_DIR = pathlib.Path("docs/data/aggregated")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def load_json(path):
    """Load JSON file safely"""
    if not path.exists():
        return []
    with open(path, "r") as f:
        return json.load(f)

def load_all_spreads():
    """
    Loads all spread files and returns a lookup dictionary:
    {(home_team, away_team, commence_time): spread_point}
    """
    lookup = {}
    spread_files = sorted(DATA_DIR.glob("spreads_*.json"))

    print(f"Loading {len(spread_files)} spread files...")

    for p in spread_files:
        try:
            data = load_json(p)
            for event in data:
                home = event["home_team"]
                away = event["away_team"]
                commence = event["commence_time"]

                # Find spread point for home team
                point = None
                try:
                    bks = event.get("bookmakers", [])
                    if not bks:
                        continue

                    # Take first bookmaker with spreads
                    for bk in bks:
                        markets = bk.get("markets", [])
                        for m in markets:
                            if m["key"] == "spreads":
                                outcomes = m["outcomes"]
                                for o in outcomes:
                                    if o["name"] == home:
                                        point = o.get("point")
                                        break
                                if point is not None:
                                    break
                        if point is not None:
                            break
                except:
                    pass

                if point is not None:
                    key = (home, away, commence)
                    # Keep the latest spread value (last file wins)
                    lookup[key] = point
        except Exception as e:
            print(f"Warning: Skipping {p}: {e}")

    print(f"Loaded {len(lookup)} unique spread lines")
    return lookup

def load_all_h2h_odds():
    """
    Loads all h2h odds files and returns latest odds for upcoming matches
    Returns: {game_id: {bookmaker, home_price, draw_price, away_price, last_update}}
    """
    h2h_files = sorted(DATA_DIR.glob("pl_h2h_odds_*.json"))

    print(f"Loading {len(h2h_files)} h2h odds files...")

    # We want the LATEST h2h odds for each game
    latest_odds = {}

    for p in h2h_files:
        try:
            data = load_json(p)
            for event in data:
                game_id = event["id"]
                commence = event["commence_time"]

                # Only keep upcoming matches
                try:
                    commence_dt = datetime.fromisoformat(commence.replace('Z', '+00:00'))
                    if commence_dt < datetime.now(commence_dt.tzinfo):
                        continue  # Skip past matches
                except:
                    pass

                try:
                    bks = event.get("bookmakers", [])
                    if not bks:
                        continue

                    bk = bks[0]  # Take first bookmaker (usually DraftKings)
                    markets = bk.get("markets", [])

                    for m in markets:
                        if m["key"] == "h2h":
                            outcomes = m["outcomes"]
                            odds_data = {
                                "bookmaker": bk["title"],
                                "last_update": bk.get("last_update"),
                                "home_team": event["home_team"],
                                "away_team": event["away_team"],
                                "commence_time": commence
                            }

                            for o in outcomes:
                                name = o["name"]
                                price = o["price"]
                                if name == event["home_team"]:
                                    odds_data["home_price"] = price
                                elif name == event["away_team"]:
                                    odds_data["away_price"] = price
                                elif name == "Draw":
                                    odds_data["draw_price"] = price

                            # Keep latest odds (last file processed wins)
                            latest_odds[game_id] = odds_data
                            break
                except Exception as e:
                    print(f"Warning: Error parsing h2h for game {game_id}: {e}")
        except Exception as e:
            print(f"Warning: Skipping {p}: {e}")

    print(f"Loaded h2h odds for {len(latest_odds)} upcoming matches")
    return latest_odds

def calculate_implied_probability(decimal_odds):
    """Convert decimal odds to implied probability"""
    if not decimal_odds or decimal_odds == 0:
        return 0
    return 1.0 / decimal_odds

def calculate_net_performance(actual_diff, spread):
    """
    Calculate net performance: (Actual Goal Diff) + (Spread)

    Example: Team has spread -1.0 (favored to win by 1), wins by 1
    - actual_diff = +1
    - spread = -1.0
    - net_performance = 1 + (-1.0) = 0 (performed exactly as expected)
    """
    return actual_diff + spread

def preprocess_team_performance():
    """
    Generate team-performance-history.json with all team stats and match history
    """
    print("\n=== Preprocessing Team Performance ===")

    # Load data
    scores = load_json(DATA_DIR / "scores_latest.json")
    spread_lookup = load_all_spreads()

    if not scores:
        print("Warning: No scores data found")
        return

    # Track team performance
    team_data = defaultdict(lambda: {
        "name": None,
        "matchHistory": [],
        "totalNetPerformance": 0.0,
        "statistics": {
            "matchesPlayed": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "covers": 0,  # Times beat the spread
            "avgNetPerformance": 0.0,
            "winRate": 0.0,
            "coverRate": 0.0
        }
    })

    # For correlation calculation
    expected_margins = []
    actual_margins = []

    # Process each completed game
    completed_games = [g for g in scores if g.get("completed")]
    print(f"Processing {len(completed_games)} completed games...")

    for game in completed_games:
        home = game["home_team"]
        away = game["away_team"]
        commence = game.get("commence_time")

        # Get scores
        try:
            h_score = 0
            a_score = 0
            for s in game.get("scores", []):
                if s["name"] == home:
                    h_score = int(s["score"])
                elif s["name"] == away:
                    a_score = int(s["score"])
        except:
            continue

        # Get spread
        spread_key = (home, away, commence)
        home_spread = spread_lookup.get(spread_key)

        if home_spread is None:
            # Try fallback - look for any spread for this matchup
            for key, spread in spread_lookup.items():
                if key[0] == home and key[1] == away:
                    home_spread = spread
                    break

        if home_spread is None:
            continue  # Skip if no spread available

        # Calculate performance
        actual_diff = h_score - a_score
        h_net_perf = calculate_net_performance(actual_diff, home_spread)
        a_net_perf = calculate_net_performance(-actual_diff, -home_spread)

        # Determine winner
        if actual_diff > 0:
            home_result = "W"
            away_result = "L"
        elif actual_diff < 0:
            home_result = "L"
            away_result = "W"
        else:
            home_result = "D"
            away_result = "D"

        # Update home team
        if team_data[home]["name"] is None:
            team_data[home]["name"] = home

        team_data[home]["matchHistory"].append({
            "date": commence[:10] if commence else "Unknown",
            "opponent": away,
            "homeAway": "home",
            "score": f"{h_score}-{a_score}",
            "result": home_result,
            "spread": home_spread,
            "netPerformance": round(h_net_perf, 2),
            "cumulativeNetPerformance": 0  # Will be calculated below
        })
        team_data[home]["totalNetPerformance"] += h_net_perf
        team_data[home]["statistics"]["matchesPlayed"] += 1
        if home_result == "W":
            team_data[home]["statistics"]["wins"] += 1
        elif home_result == "L":
            team_data[home]["statistics"]["losses"] += 1
        else:
            team_data[home]["statistics"]["draws"] += 1
        if h_net_perf > 0:
            team_data[home]["statistics"]["covers"] += 1

        # Update away team
        if team_data[away]["name"] is None:
            team_data[away]["name"] = away

        team_data[away]["matchHistory"].append({
            "date": commence[:10] if commence else "Unknown",
            "opponent": home,
            "homeAway": "away",
            "score": f"{a_score}-{h_score}",
            "result": away_result,
            "spread": -home_spread,
            "netPerformance": round(a_net_perf, 2),
            "cumulativeNetPerformance": 0  # Will be calculated below
        })
        team_data[away]["totalNetPerformance"] += a_net_perf
        team_data[away]["statistics"]["matchesPlayed"] += 1
        if away_result == "W":
            team_data[away]["statistics"]["wins"] += 1
        elif away_result == "L":
            team_data[away]["statistics"]["losses"] += 1
        else:
            team_data[away]["statistics"]["draws"] += 1
        if a_net_perf > 0:
            team_data[away]["statistics"]["covers"] += 1

        # Track for correlation (home team perspective only)
        expected_margins.append(-home_spread)
        actual_margins.append(actual_diff)

    # Calculate cumulative performance for each team's history
    for team_name, data in team_data.items():
        # Sort by date
        data["matchHistory"].sort(key=lambda x: x["date"])

        cumulative = 0.0
        for match in data["matchHistory"]:
            cumulative += match["netPerformance"]
            match["cumulativeNetPerformance"] = round(cumulative, 2)

        # Calculate final statistics
        matches = data["statistics"]["matchesPlayed"]
        if matches > 0:
            data["statistics"]["avgNetPerformance"] = round(data["totalNetPerformance"] / matches, 2)
            data["statistics"]["winRate"] = round(data["statistics"]["wins"] / matches, 3)
            data["statistics"]["coverRate"] = round(data["statistics"]["covers"] / matches, 3)

        data["totalNetPerformance"] = round(data["totalNetPerformance"], 2)

    # Calculate correlation
    correlation = 0.0
    if len(expected_margins) > 1:
        import numpy as np
        corr_matrix = np.corrcoef(expected_margins, actual_margins)
        correlation = float(corr_matrix[0, 1])

    # Sort teams by total net performance
    teams_list = sorted(team_data.values(), key=lambda x: x["totalNetPerformance"], reverse=True)

    # Write output
    output = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "teams": teams_list,
        "correlation": round(correlation, 3),
        "totalMatches": len(completed_games),
        "teamsTracked": len(teams_list)
    }

    output_path = OUTPUT_DIR / "team-performance-history.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"✓ Generated {output_path}")
    print(f"  - {len(teams_list)} teams tracked")
    print(f"  - {len(completed_games)} matches analyzed")
    print(f"  - Correlation: {correlation:.3f}")

def preprocess_latest_odds():
    """
    Generate latest-odds.json with upcoming matches and merged odds
    """
    print("\n=== Preprocessing Latest Odds ===")

    # Load data
    h2h_odds = load_all_h2h_odds()
    spread_lookup = load_all_spreads()

    if not h2h_odds:
        print("Warning: No h2h odds data found")
        return

    # Build upcoming matches list
    upcoming_matches = []

    for game_id, h2h_data in h2h_odds.items():
        home = h2h_data["home_team"]
        away = h2h_data["away_team"]
        commence = h2h_data["commence_time"]

        # Find matching spread
        spread_key = (home, away, commence)
        home_spread_point = spread_lookup.get(spread_key)

        # If not found, try to find any spread for this matchup
        if home_spread_point is None:
            for key, spread in spread_lookup.items():
                if key[0] == home and key[1] == away:
                    home_spread_point = spread
                    break

        # Calculate implied probabilities
        home_implied = calculate_implied_probability(h2h_data.get("home_price"))
        draw_implied = calculate_implied_probability(h2h_data.get("draw_price"))
        away_implied = calculate_implied_probability(h2h_data.get("away_price"))

        match_data = {
            "id": game_id,
            "commenceTime": commence,
            "homeTeam": home,
            "awayTeam": away,
            "h2hOdds": {
                "bookmaker": h2h_data.get("bookmaker"),
                "home": h2h_data.get("home_price"),
                "draw": h2h_data.get("draw_price"),
                "away": h2h_data.get("away_price"),
                "impliedProbHome": round(home_implied, 3),
                "impliedProbDraw": round(draw_implied, 3),
                "impliedProbAway": round(away_implied, 3)
            }
        }

        # Add spread if available
        if home_spread_point is not None:
            match_data["spread"] = {
                "homePoint": home_spread_point,
                "awayPoint": -home_spread_point
            }

        upcoming_matches.append(match_data)

    # Sort by commence time
    upcoming_matches.sort(key=lambda x: x["commenceTime"])

    # Write output
    output = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "upcomingMatches": upcoming_matches,
        "totalMatches": len(upcoming_matches)
    }

    output_path = OUTPUT_DIR / "latest-odds.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"✓ Generated {output_path}")
    print(f"  - {len(upcoming_matches)} upcoming matches")

def main():
    print("=" * 60)
    print("Dashboard Data Preprocessing")
    print("=" * 60)

    try:
        preprocess_team_performance()
        preprocess_latest_odds()

        print("\n" + "=" * 60)
        print("✓ Preprocessing complete!")
        print("=" * 60)
    except Exception as e:
        print(f"\n✗ Error during preprocessing: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
