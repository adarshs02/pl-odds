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

def normalize_team_name(name):
    """
    Normalize team names to handle API inconsistencies
    """
    normalization_map = {
        "Brighton and Hove Albion": "Brighton",
        "Manchester City": "Man City",
        "Manchester United": "Man United",
        "Nottingham Forest": "Nott'm Forest",
        "Tottenham Hotspur": "Tottenham",
        "West Ham United": "West Ham",
        "Wolverhampton Wanderers": "Wolves"
    }
    return normalization_map.get(name, name)

def load_json(path):
    """Load JSON file safely"""
    if not path.exists():
        return []
    with open(path, "r") as f:
        return json.load(f)

def load_all_spreads():
    """
    Loads all spread files and returns a lookup dictionary with ALL bookmakers:
    {(home_team, away_team, commence_time): {bookmaker_key: spread_point, ...}}
    """
    lookup = {}
    spread_files = sorted(DATA_DIR.glob("spreads_*.json"))

    print(f"Loading {len(spread_files)} spread files...")
    all_bookmakers = set()

    for p in spread_files:
        try:
            data = load_json(p)
            for event in data:
                home = normalize_team_name(event["home_team"])
                away = normalize_team_name(event["away_team"])
                commence = event["commence_time"]
                key = (home, away, commence)

                bks = event.get("bookmakers", [])
                if not bks:
                    continue

                # Initialize lookup entry if not exists
                if key not in lookup:
                    lookup[key] = {}

                # Extract spreads from ALL bookmakers
                for bk in bks:
                    bookmaker_key = bk.get("key", "unknown")
                    all_bookmakers.add(bookmaker_key)
                    markets = bk.get("markets", [])
                    
                    for m in markets:
                        if m.get("key") == "spreads":
                            outcomes = m.get("outcomes", [])
                            for o in outcomes:
                                outcome_name = normalize_team_name(o.get("name", ""))
                                if outcome_name == home:
                                    point = o.get("point")
                                    if point is not None:
                                        # Keep latest spread per bookmaker (last file wins)
                                        lookup[key][bookmaker_key] = point
                                    break
                            break
        except Exception as e:
            print(f"Warning: Skipping {p}: {e}")

    print(f"Loaded {len(lookup)} unique spread lines from {len(all_bookmakers)} bookmakers: {sorted(all_bookmakers)}")
    return lookup, sorted(all_bookmakers)

def get_spread_value(spread_dict):
    """Get consensus (average) spread from a dict of bookmaker spreads."""
    if not spread_dict:
        return None
    values = list(spread_dict.values())
    return sum(values) / len(values)

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
                            home_team = normalize_team_name(event["home_team"])
                            away_team = normalize_team_name(event["away_team"])

                            odds_data = {
                                "bookmaker": bk["title"],
                                "last_update": bk.get("last_update"),
                                "home_team": home_team,
                                "away_team": away_team,
                                "commence_time": commence
                            }

                            for o in outcomes:
                                name = normalize_team_name(o["name"])
                                price = o["price"]
                                if name == home_team:
                                    odds_data["home_price"] = price
                                elif name == away_team:
                                    odds_data["away_price"] = price
                                elif o["name"] == "Draw":
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
    Includes per-bookmaker spread analysis
    """
    print("\n=== Preprocessing Team Performance ===")

    # Load data
    scores = load_json(DATA_DIR / "scores_latest.json")
    spread_lookup, all_bookmakers = load_all_spreads()

    if not scores:
        print("Warning: No scores data found")
        return

    print(f"Available bookmakers: {all_bookmakers}")

    # Track team performance
    team_data = defaultdict(lambda: {
        "name": None,
        "matchHistory": [],
        "totalNetPerformance": 0.0,  # Consensus-based
        "totalNetPerformanceByBookmaker": {},
        "statistics": {
            "matchesPlayed": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "covers": 0,  # Times beat the consensus spread
            "coversByBookmaker": {},
            "avgNetPerformance": 0.0,
            "winRate": 0.0,
            "coverRate": 0.0,
            "coverRateByBookmaker": {}
        }
    })

    # For correlation calculation
    expected_margins = []
    actual_margins = []

    # Process each completed game
    completed_games = [g for g in scores if g.get("completed")]
    print(f"Processing {len(completed_games)} completed games...")

    for game in completed_games:
        home = normalize_team_name(game["home_team"])
        away = normalize_team_name(game["away_team"])
        commence = game.get("commence_time")

        # Get scores
        try:
            h_score = 0
            a_score = 0
            for s in game.get("scores", []):
                score_team = normalize_team_name(s["name"])
                if score_team == home:
                    h_score = int(s["score"])
                elif score_team == away:
                    a_score = int(s["score"])
        except:
            continue

        # Get spreads (now a dict of bookmaker -> spread_point)
        spread_key = (home, away, commence)
        home_spreads_dict = spread_lookup.get(spread_key)

        if home_spreads_dict is None:
            # Try fallback - look for any spread for this matchup
            for key, spreads in spread_lookup.items():
                if key[0] == home and key[1] == away:
                    home_spreads_dict = spreads
                    break

        if not home_spreads_dict:
            continue  # Skip if no spread available

        # Calculate consensus spread
        consensus_spread = get_spread_value(home_spreads_dict)
        
        # Calculate performance
        actual_diff = h_score - a_score
        consensus_h_perf = calculate_net_performance(actual_diff, consensus_spread)
        consensus_a_perf = calculate_net_performance(-actual_diff, -consensus_spread)
        
        # Calculate per-bookmaker net performance
        h_perf_by_bk = {}
        a_perf_by_bk = {}
        for bk, spread in home_spreads_dict.items():
            h_perf_by_bk[bk] = round(calculate_net_performance(actual_diff, spread), 2)
            a_perf_by_bk[bk] = round(calculate_net_performance(-actual_diff, -spread), 2)

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

        # Prepare spread dicts for away team (negate spreads)
        away_spreads_dict = {bk: -spread for bk, spread in home_spreads_dict.items()}

        # Update home team
        if team_data[home]["name"] is None:
            team_data[home]["name"] = home

        team_data[home]["matchHistory"].append({
            "date": commence[:10] if commence else "Unknown",
            "opponent": away,
            "homeAway": "home",
            "score": f"{h_score}-{a_score}",
            "result": home_result,
            "spreadsByBookmaker": home_spreads_dict,
            "netPerformanceByBookmaker": h_perf_by_bk,
            "spread": round(consensus_spread, 2),  # Backward compat: consensus
            "netPerformance": round(consensus_h_perf, 2),
            "cumulativeNetPerformance": 0  # Will be calculated below
        })
        team_data[home]["totalNetPerformance"] += consensus_h_perf
        team_data[home]["statistics"]["matchesPlayed"] += 1
        if home_result == "W":
            team_data[home]["statistics"]["wins"] += 1
        elif home_result == "L":
            team_data[home]["statistics"]["losses"] += 1
        else:
            team_data[home]["statistics"]["draws"] += 1
        if consensus_h_perf > 0:
            team_data[home]["statistics"]["covers"] += 1
        
        # Track per-bookmaker covers and totals for home
        for bk, perf in h_perf_by_bk.items():
            if bk not in team_data[home]["statistics"]["coversByBookmaker"]:
                team_data[home]["statistics"]["coversByBookmaker"][bk] = 0
            if bk not in team_data[home]["totalNetPerformanceByBookmaker"]:
                team_data[home]["totalNetPerformanceByBookmaker"][bk] = 0.0
            if perf > 0:
                team_data[home]["statistics"]["coversByBookmaker"][bk] += 1
            team_data[home]["totalNetPerformanceByBookmaker"][bk] += perf

        # Update away team
        if team_data[away]["name"] is None:
            team_data[away]["name"] = away

        team_data[away]["matchHistory"].append({
            "date": commence[:10] if commence else "Unknown",
            "opponent": home,
            "homeAway": "away",
            "score": f"{a_score}-{h_score}",
            "result": away_result,
            "spreadsByBookmaker": away_spreads_dict,
            "netPerformanceByBookmaker": a_perf_by_bk,
            "spread": round(-consensus_spread, 2),  # Backward compat: consensus
            "netPerformance": round(consensus_a_perf, 2),
            "cumulativeNetPerformance": 0  # Will be calculated below
        })
        team_data[away]["totalNetPerformance"] += consensus_a_perf
        team_data[away]["statistics"]["matchesPlayed"] += 1
        if away_result == "W":
            team_data[away]["statistics"]["wins"] += 1
        elif away_result == "L":
            team_data[away]["statistics"]["losses"] += 1
        else:
            team_data[away]["statistics"]["draws"] += 1
        if consensus_a_perf > 0:
            team_data[away]["statistics"]["covers"] += 1
            
        # Track per-bookmaker covers and totals for away
        for bk, perf in a_perf_by_bk.items():
            if bk not in team_data[away]["statistics"]["coversByBookmaker"]:
                team_data[away]["statistics"]["coversByBookmaker"][bk] = 0
            if bk not in team_data[away]["totalNetPerformanceByBookmaker"]:
                team_data[away]["totalNetPerformanceByBookmaker"][bk] = 0.0
            if perf > 0:
                team_data[away]["statistics"]["coversByBookmaker"][bk] += 1
            team_data[away]["totalNetPerformanceByBookmaker"][bk] += perf

        # Track for correlation (home team perspective only, using consensus)
        expected_margins.append(-consensus_spread)
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
            
            # Calculate per-bookmaker cover rates
            for bk, covers in data["statistics"]["coversByBookmaker"].items():
                data["statistics"]["coverRateByBookmaker"][bk] = round(covers / matches, 3)

        data["totalNetPerformance"] = round(data["totalNetPerformance"], 2)
        
        # Round per-bookmaker totals
        for bk in data["totalNetPerformanceByBookmaker"]:
            data["totalNetPerformanceByBookmaker"][bk] = round(data["totalNetPerformanceByBookmaker"][bk], 2)

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
        "bookmakers": all_bookmakers,
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
    print(f"  - {len(all_bookmakers)} bookmakers: {all_bookmakers}")
    print(f"  - Correlation: {correlation:.3f}")

def preprocess_latest_odds():
    """
    Generate latest-odds.json with upcoming matches and merged odds
    Includes per-bookmaker spread data
    """
    print("\n=== Preprocessing Latest Odds ===")

    # Load data
    h2h_odds = load_all_h2h_odds()
    spread_lookup, all_bookmakers = load_all_spreads()

    if not h2h_odds:
        print("Warning: No h2h odds data found")
        return

    # Build upcoming matches list
    upcoming_matches = []

    for game_id, h2h_data in h2h_odds.items():
        home = h2h_data["home_team"]
        away = h2h_data["away_team"]
        commence = h2h_data["commence_time"]

        # Find matching spreads (now a dict of bookmaker -> spread)
        spread_key = (home, away, commence)
        home_spreads_dict = spread_lookup.get(spread_key)

        # If not found, try to find any spread for this matchup
        if home_spreads_dict is None:
            for key, spreads in spread_lookup.items():
                if key[0] == home and key[1] == away:
                    home_spreads_dict = spreads
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

        # Add spreads if available
        if home_spreads_dict:
            consensus_spread = get_spread_value(home_spreads_dict)
            match_data["spread"] = {
                "homePoint": round(consensus_spread, 2),  # Consensus
                "awayPoint": round(-consensus_spread, 2),
                "byBookmaker": home_spreads_dict  # Per-bookmaker spreads
            }

        upcoming_matches.append(match_data)

    # Sort by commence time
    upcoming_matches.sort(key=lambda x: x["commenceTime"])

    # Write output
    output = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "upcomingMatches": upcoming_matches,
        "bookmakers": all_bookmakers,
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
