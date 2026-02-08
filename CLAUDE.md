# Project Guidelines

## Memory Updates

After completing every task, update the auto memory files in `~/.claude/projects/-Users-adarsh-myProjects-pl-odds-pl-odds/memory/` with key learnings, patterns, and insights from the work done. Keep MEMORY.md concise and link to topic-specific files for details.

---

## Project Overview

**EPL Betting Odds & Performance Tracker** — tracks English Premier League betting odds (spreads, h2h, outrights) and analyzes team performance against betting expectations. Includes a static dashboard hosted via GitHub Pages.

- **GitHub**: `adarshs02/pl-odds`
- **API**: [The Odds API](https://api.the-odds-api.com) v4 — key stored in `.env` as `ODDS_API_KEY`
- **Language**: Python 3 (scripts), vanilla JS + D3.js (dashboard)
- **Dependencies**: `requests`, `python-dotenv`, `matplotlib`, `pandas`, `numpy` (see `requirements.txt`)

---

## Repo Structure

```
├── .env                          # ODDS_API_KEY (gitignored)
├── .github/workflows/            # CI/CD (GitHub Actions)
│   ├── daily_update.yml          # Daily at 08:00 UTC: run_pipeline → preprocess → commit
│   ├── fetch-epl-h2h.yml         # Mon+Thu: fetch h2h odds (DraftKings) → commit
│   └── fetch-odds.yml            # Weekly Mon: fetch outrights (winner/POTY/positions) → commit
├── data/                         # All raw JSON data (committed to repo)
│   ├── scores_latest.json        # Accumulated completed match scores (merged, deduped by game ID)
│   ├── spreads_YYYYMMDD_HHMMSS.json  # Timestamped spread snapshots
│   ├── spreads_backfill.json     # Historical spreads from football-data.co.uk CSV
│   ├── pl_h2h_odds_*.json        # H2H moneyline odds snapshots
│   └── pl_winner_odds_*.json     # Outright winner odds (if available)
├── scripts/                      # Python data pipeline
│   ├── run_pipeline.py           # Master runner: fetch_scores → fetch_spreads → analyze_and_plot
│   ├── fetch_scores.py           # Fetch completed EPL scores, merge into scores_latest.json
│   ├── fetch_spreads.py          # Fetch upcoming spread lines, save timestamped JSON
│   ├── fetch_epl_h2h.py          # Fetch h2h (moneyline) odds, save timestamped JSON
│   ├── fetch_odds.py             # Fetch outrights (winner, POTY, top4, relegation)
│   ├── fetch_epl_winner.py       # Dedicated EPL winner outrights fetcher
│   ├── analyze_and_plot.py       # Analyze net performance, generate bar chart + correlation
│   ├── preprocess-dashboard-data.py  # Aggregate raw data → docs/data/aggregated/ for dashboard
│   ├── backfill_from_csv.py      # Backfill scores+spreads from football-data.co.uk CSV (season 25/26)
│   ├── fetch_team_badges.py      # Fetch team badge URLs → docs/data/team-badges.json
│   ├── list_sports.py            # Utility: list available sports from the API
│   ├── probe_markets.py          # Utility: probe available markets for a sport
│   └── probe_spreads.py          # Utility: probe spread availability
├── images/
│   └── performance_graph.png     # Generated bar chart (matplotlib)
├── docs/                         # GitHub Pages dashboard (static site)
│   ├── index.html                # Main dashboard page
│   ├── api.html                  # API info page
│   ├── css/main.css              # Styles
│   ├── favicon.svg
│   ├── data/
│   │   ├── team-badges.json      # Team badge image URLs
│   │   └── aggregated/
│   │       ├── team-performance-history.json  # Preprocessed team stats + match history
│   │       └── latest-odds.json               # Preprocessed upcoming match odds
│   └── js/
│       ├── app.js                # Main app entry (ES module)
│       ├── analyzer.js           # Analysis/calculation logic
│       ├── data-loader.js        # Fetch aggregated JSON data
│       ├── router.js             # Client-side routing (dashboard ↔ team detail)
│       ├── team-utils.js         # Team name normalization, badge lookup
│       ├── theme-manager.js      # Dark/light theme toggle
│       └── components/
│           ├── performance-chart.js  # D3.js horizontal bar chart
│           └── pie-chart.js          # D3.js pie charts (results, covers)
└── README.md                     # Auto-updated with correlation score
```

---

## Key Concepts

- **Net Performance** = `(Actual Goal Difference) + (Spread Line)`. Positive = outperformed expectations.
- **Spread** = Asian handicap line for the home team (e.g., -1.5 means favored by 1.5 goals).
- **Consensus Spread** = average of all bookmakers' spread lines for a match.
- **Cover** = when a team beats the spread (net performance > 0).
- **Correlation Score** = Pearson correlation between expected margin (`-spread`) and actual goal difference. Updated in `README.md` automatically.

---

## Data Pipeline

### Daily Pipeline (`run_pipeline.py` / `daily_update.yml`)
1. `fetch_scores.py` — GET `/v4/sports/soccer_epl/scores?daysFrom=3` → merge into `data/scores_latest.json`
2. `fetch_spreads.py` — GET `/v4/sports/soccer_epl/odds?markets=spreads&regions=uk&bookmakers=bet365` → save timestamped file
3. `analyze_and_plot.py` — load all scores + all spread files → compute net performance → generate `images/performance_graph.png` + update README correlation

### Dashboard Preprocessing (`preprocess-dashboard-data.py`)
- Runs after the pipeline (in `daily_update.yml`)
- Reads `scores_latest.json` + all `spreads_*.json` + all `pl_h2h_odds_*.json`
- Outputs:
  - `docs/data/aggregated/team-performance-history.json` — per-team stats, match history, per-bookmaker breakdowns
  - `docs/data/aggregated/latest-odds.json` — upcoming matches with merged h2h + spread odds

### Other Fetchers (separate workflows)
- `fetch_epl_h2h.py` — h2h moneyline odds (Mon+Thu via `fetch-epl-h2h.yml`)
- `fetch_odds.py` / `fetch_epl_winner.py` — outrights/futures (weekly via `fetch-odds.yml`)

---

## Dashboard (GitHub Pages)

- Served from `docs/` directory
- Vanilla JS with ES modules, D3.js v7 for charts
- Dark/light theme support
- Two views:
  - **Dashboard**: stats strip, upcoming matches, performance bar chart (sortable, filterable by matches/location/bookmaker), historical trends line chart
  - **Team Detail**: team stats, home/away breakdown, bookmaker comparison table, W/L/D pie chart, spread cover pie chart, performance trend line, full match history table
- Data loaded from `docs/data/aggregated/*.json` (no backend)

---

## Team Name Normalization

Source of truth: `scripts/team_names.py`. Both Python scripts import from it; `docs/js/team-utils.js` must be kept in sync manually. The canonical mapping:

| API Name                    | Normalized     |
|-----------------------------|----------------|
| Brighton and Hove Albion    | Brighton       |
| Manchester City             | Man City       |
| Manchester United           | Man United     |
| Newcastle United            | Newcastle      |
| Nottingham Forest           | Nott'm Forest  |
| Tottenham Hotspur           | Tottenham      |
| West Ham United             | West Ham       |
| Wolverhampton Wanderers     | Wolves         |
| Leeds United                | Leeds          |

All other team names pass through unchanged.

---

## GitHub Actions Secrets

- `ODDS_API_KEY` — required in repo settings → Secrets

## Common Commands

```bash
# Run full pipeline locally
python3 scripts/run_pipeline.py

# Preprocess data for dashboard
python3 scripts/preprocess-dashboard-data.py

# Backfill historical data from football-data.co.uk
python3 scripts/backfill_from_csv.py

# Fetch h2h odds
python3 scripts/fetch_epl_h2h.py --regions uk,eu,us --bookmakers draftkings

# Fetch outright winner odds
python3 scripts/fetch_epl_winner.py
```
