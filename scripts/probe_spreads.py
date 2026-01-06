#!/usr/bin/env python3
import os, json, requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("ODDS_API_KEY")
REGION = "uk"
MARKETS = "spreads"
SPORT = "soccer_epl"

def get(url):
    print(f"GET {url}")
    try:
        r = requests.get(url, params={"apiKey": API_KEY})
        r.raise_for_status()
        print(f"Status: {r.status_code}")
        return r.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

# 1. Check Spreads
print("--- Check Spreads ---")
odds_url = f"https://api.the-odds-api.com/v4/sports/{SPORT}/odds"
odds_params = f"?regions={REGION}&markets={MARKETS}&apiKey={API_KEY}"
data = get(odds_url + odds_params)
if data:
    print(f"Got {len(data)} events with spreads.")
    if len(data) > 0:
        print("Sample Spread:", json.dumps(data[0]['bookmakers'][0]['markets'][0], indent=2))

# 2. Check Scores
print("\n--- Check Scores ---")
scores_url = f"https://api.the-odds-api.com/v4/sports/{SPORT}/scores"
scores_params = f"?daysFrom=3&apiKey={API_KEY}" # Check last 3 days
scores = get(scores_url + scores_params)
if scores:
    print(f"Got {len(scores)} score listings.")
    if len(scores) > 0:
        print("Sample Score:", json.dumps(scores[0], indent=2))

