#!/usr/bin/env python3
import os, json, datetime, requests, pathlib, sys, re
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ODDS_API_KEY")
REGION  = "uk"           # EU/UK books usually carry EPL futures
MARKET  = "outrights"    # outright-winner futures
BOOKMAKERS = "betfair_sb_uk,skybet,bet365"  # pick your favourites

if not API_KEY:
    sys.exit("❌ ODDS_API_KEY not found in environment.")

session = requests.Session()

def get(url: str):
    print(f"GET {url}")
    r = session.get(url, timeout=15)
    try:
        r.raise_for_status()
    finally:
        # Log quota headers when present
        xr = r.headers.get("x-requests-remaining")
        xu = r.headers.get("x-requests-used")
        xl = r.headers.get("x-requests-last")
        if xr or xu or xl:
            print(f"Quota → remaining={xr} used={xu} last={xl}")
    return r.json()

today = datetime.date.today()
out_dir = pathlib.Path("data")
out_dir.mkdir(exist_ok=True, parents=True)

# 1) Discover exact EPL outrights sport keys (v4 exposes dedicated keys when including outrights)
# Include all=true to return out-of-season sports, and outrights=true to include futures keys
sports_url = f"https://api.the-odds-api.com/v4/sports?apiKey={API_KEY}&all=true&outrights=true"
sports = get(sports_url)
epl_sports = [s for s in sports if isinstance(s, dict) and str(s.get("key", "")).startswith("soccer_epl")]
epl_keys = [s.get("key") for s in epl_sports]
print(f"Discovered EPL-related sport keys: {epl_keys}")

# 2) Define targets and how to match potential sport keys
targets = {
    # Team league winner
    "pl_winner": {
        "patterns": [re.compile(r"winner|champion", re.I)],
        "candidates": ["soccer_epl_winner"],
    },
    # Player of the Year / Player of the Season
    "pl_poty": {
        "patterns": [re.compile(r"player.*(season|year)|pfa", re.I)],
        "candidates": [
            "soccer_epl_player_of_the_season",
            "soccer_epl_player_of_the_year",
        ],
    },
    # League position markets (best-effort)
    "pl_top4": {
        "patterns": [re.compile(r"top[_\s-]?4|to[-_\s]?finish[-_\s]?top[-_\s]?4", re.I)],
        "candidates": [
            "soccer_epl_top_4_finish",
            "soccer_epl_to_finish_top_4",
        ],
    },
    "pl_top6": {
        "patterns": [re.compile(r"top[_\s-]?6|to[-_\s]?finish[-_\s]?top[-_\s]?6", re.I)],
        "candidates": [
            "soccer_epl_top_6_finish",
            "soccer_epl_to_finish_top_6",
        ],
    },
    "pl_relegation": {
        "patterns": [re.compile(r"relegation", re.I)],
        "candidates": [
            "soccer_epl_relegation",
            "soccer_epl_to_be_relegated",
        ],
    },
}

def find_key(patterns: list[re.Pattern[str]], candidates: list[str]) -> str | None:
    # 1) Prefer explicit candidates if present in discovered keys
    for cand in candidates:
        if cand in epl_keys:
            return cand
    # 2) Try regex match against discovered keys
    for key in epl_keys:
        if any(p.search(key) for p in patterns):
            return key
    # 3) As a last resort, attempt candidates directly (not listed in /sports)
    for cand in candidates:
        probe_url = (
            "https://api.the-odds-api.com/v4/sports/"
            f"{cand}/odds?regions={REGION}&markets={MARKET}&bookmakers={BOOKMAKERS}&apiKey={API_KEY}"
        )
        try:
            _ = get(probe_url)  # will raise if invalid
            print(f"Candidate key accepted by API: {cand}")
            return cand
        except requests.HTTPError as e:
            print(f"Candidate key not valid ({cand}): {e}")
        except Exception as e:
            print(f"Candidate probe error ({cand}): {e}")
    return None

def fetch_outrights_for_sport_key(sport_key: str):
    url = (
        "https://api.the-odds-api.com/v4/sports/"
        f"{sport_key}/odds?regions={REGION}&markets={MARKET}&bookmakers={BOOKMAKERS}&apiKey={API_KEY}"
    )
    try:
        return get(url)
    except requests.HTTPError as e:
        print(f"HTTP error for {sport_key}: {e}")
        return None
    except Exception as e:
        print(f"Error for {sport_key}: {e}")
        return None

results_summary = {}

for label, cfg in targets.items():
    key = find_key(cfg["patterns"], cfg["candidates"])
    if not key:
        pat_desc = "+".join(p.pattern for p in cfg["patterns"]) if cfg.get("patterns") else "(none)"
        print(f"⚠️ No sport key matched for {label} using patterns {pat_desc}")
        continue
    data = fetch_outrights_for_sport_key(key)
    if data is None:
        continue
    out_file = out_dir / f"{label}_odds_{today}.json"
    with open(out_file, "w") as fp:
        json.dump(data, fp, indent=2, sort_keys=True)
    results_summary[label] = str(out_file)
    print(f"Saved odds → {out_file}")

if not results_summary:
    print("No specific EPL outrights keys matched. This may mean the API has no current futures for EPL or naming differs. Try again closer to season start or adjust patterns in `targets`.")
