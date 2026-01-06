#!/usr/bin/env python3
"""
Backfill script to populate data/ from football-data.co.uk CSVs.
"""
import requests
import csv
import io
import json
import pathlib
from datetime import datetime

DATA_DIR = pathlib.Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)

# URL for 2024/2025 season (Assuming current season is 24/25 based on date Jan 2026? 
# Wait, Jan 2026 means we are in 25/26 season!
# Pattern: 2526
CSV_URL = "https://www.football-data.co.uk/mmz4281/2526/E0.csv"

def fetch_csv():
    print(f"Downloading {CSV_URL}...")
    r = requests.get(CSV_URL)
    r.raise_for_status()
    # Decode with latin-1 which is common for these CSVs if utf-8 fails, 
    # but requests .text might handle it.
    return r.text

def parse_and_save(csv_text):
    f = io.StringIO(csv_text)
    reader = csv.DictReader(f)
    
    scores = []
    spread_events = []
    
    # Mapping for Team Names to match API standardized names if possible
    # We might need a fuzzy match or manual map later. 
    # For now, we trust names are close enough or we normalize.
    
    count = 0
    for row in reader:
        # Check if row is empty
        if not row.get("Date"): continue
        
        try:
            # Parse Date: DD/MM/YYYY
            d_str = row["Date"]
            dt = datetime.strptime(d_str, "%d/%m/%Y")
            iso_date = dt.strftime("%Y-%m-%dT%H:%M:%SZ") # Approx commence time
            
            home = row["HomeTeam"]
            away = row["AwayTeam"]
            fthg = row["FTHG"]
            ftag = row["FTAG"]
            
            # --- 1. SCORES ---
            # Create a score record
            score_record = {
                "id": f"backfill_{count}", # Dummy ID
                "sport_key": "soccer_epl",
                "sport_title": "EPL",
                "commence_time": iso_date,
                "completed": True,
                "home_team": home,
                "away_team": away,
                "scores": [
                    {"name": home, "score": fthg},
                    {"name": away, "score": ftag}
                ],
                "last_update": iso_date
            }
            scores.append(score_record)
            
            # --- 2. SPREADS ---
            # Look for Asian Handicap columns
            # Common headers: B365AH (Handicap size), B365AHH (Home Odds), B365AHA (Away Odds)
            # Or AvgAH...
            # We want the 'line' (Handicap size).
            # The 'line' is usually relative to Home Team.
            # Header check: 'AHh' (Handicap size), 'AHCh' (Closing Handicap size)
            handicap = row.get("AHCh") or row.get("AHh")
            if handicap:
                matches_spread = {
                    "id": f"backfill_spread_{count}",
                    "sport_key": "soccer_epl",
                    "commence_time": iso_date,
                    "home_team": home,
                    "away_team": away,
                    "bookmakers": [{
                        "key": "backfill",
                        "title": "Backfill",
                        "markets": [{
                            "key": "spreads",
                            "outcomes": [
                                {"name": home, "point": float(handicap)},
                                # We don't strictly need away point for our current logic, but good to have
                                {"name": away, "point": -float(handicap)}
                            ]
                        }]
                    }]
                }
                spread_events.append(matches_spread)
                
            count += 1
            
        except Exception as e:
            print(f"Error parsing row {count}: {e}")
            continue

    print(f"Parsed {len(scores)} matches.")
    
    # Save Scores
    # We append to scores_latest.json? Or just overwrite for the 'backfill' purpose?
    # To be safe: Load existing, merge.
    
    score_path = DATA_DIR / "scores_latest.json"
    existing_scores = []
    if score_path.exists():
        try:
            with open(score_path, "r") as f:
                existing_scores = json.load(f)
        except: pass
        
    # Merge based on (Home, Away, Date) or simply trust our new backfill is better/older?
    # Let's just add them if not present.
    # Simple dedupe key: f"{home}_{away}_{dt.date()}"
    
    existing_keys = set()
    for s in existing_scores:
        t = s.get("commence_time", "")[:10]
        k = f"{s['home_team']}_{s['away_team']}_{t}"
        existing_keys.add(k)
        
    added = 0
    for s in scores:
        t = s["commence_time"][:10]
        k = f"{s['home_team']}_{s['away_team']}_{t}"
        if k not in existing_keys:
            existing_scores.append(s)
            added += 1
            
    with open(score_path, "w") as f:
        json.dump(existing_scores, f, indent=2)
    print(f"Updated scores_latest.json with {added} historical matches.")
    
    # Save Spreads
    # We save as a special backfill file
    spread_path = DATA_DIR / "spreads_backfill.json"
    with open(spread_path, "w") as f:
        json.dump(spread_events, f, indent=2)
    print(f"Saved {len(spread_events)} historical spreads to {spread_path}")

if __name__ == "__main__":
    try:
        csv_text = fetch_csv()
        parse_and_save(csv_text)
    except Exception as e:
        print(f"Backfill failed: {e}")
