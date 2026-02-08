#!/usr/bin/env python3
"""
Fetch EPL Spreads (Handicaps) for upcoming games.
Saves to data/spreads_<timestamp>.json
"""
import os, json, requests, pathlib, sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("ODDS_API_KEY")

if not API_KEY:
    sys.exit("❌ ODDS_API_KEY not found in environment.")

SPORT = "soccer_epl"
REGION = "uk"
MARKETS = "spreads"
OUT_DIR = pathlib.Path("data")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def fetch_spreads():
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT}/odds"
    params = {
        "apiKey": API_KEY,
        "regions": REGION,
        "markets": MARKETS,
        "bookmakers": "bet365",
    }
    
    print(f"GET {url}")
    try:
        r = requests.get(url, params=params)
        r.raise_for_status()
        data = r.json()
        print(f"Fetched {len(data)} events with spreads.")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_file = OUT_DIR / f"spreads_{timestamp}.json"
        with open(out_file, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Saved to {out_file}")
        
    except Exception as e:
        print(f"Error fetching spreads: {e}")

if __name__ == "__main__":
    fetch_spreads()
