#!/usr/bin/env python3
"""
Fetch EPL scores (completed games) for the last 30 days (or specified days).
Saves to data/scores_latest.json
"""
import os, json, requests, pathlib, sys, argparse
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("ODDS_API_KEY")

if not API_KEY:
    sys.exit("❌ ODDS_API_KEY not found in environment.")

SPORT = "soccer_epl"
OUT_DIR = pathlib.Path("data")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def fetch_scores(days_from=30):
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT}/scores"
    params = {
        "apiKey": API_KEY,
        "daysFrom": days_from, # Limit is usually 3 days for free tier? Actually free key usually gives 3 days history.
        # But docs say "daysFrom" parameter. If no plan, might be limited to 3 days.
        # If user has paid plan, could be more. We'll try 30, API will truncate if needed.
    }
    
    print(f"GET {url} daysFrom={days_from}")
    try:
        r = requests.get(url, params=params)
        r.raise_for_status()
        data = r.json()
        print(f"Fetched {len(data)} completed games.")
        
        # Filter for completed only just in case
        completed = [g for g in data if g.get("completed")]
        
        out_file = OUT_DIR / "scores_latest.json"
        with open(out_file, "w") as f:
            json.dump(completed, f, indent=2)
        print(f"Saved to {out_file}")
        
    except Exception as e:
        print(f"Error fetching scores: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=3, help="Days of history to fetch")
    args = parser.parse_args()
    fetch_scores(args.days)
