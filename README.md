# EPL Betting Odds & Performance Tracker

This project tracks **English Premier League (EPL)** betting odds and analyzes team performance against betting expectations.

## 📊 Team Performance vs Spreads

The graph below shows the cumulative "Net Performance" for each team.
**Net Performance** is calculated as: `(Actual Goal Difference) - (Spread Line)`.
- **Positive (Green)**: The team outperformed betting expectations (e.g., won by more than expected).
- **Negative (Red)**: The team underperformed against the spread.

![Net Performance Graph](images/performance_graph.png)

*(Note: If no recent game data is available from the free API tier, the graph above may be generated using simulated data for demonstration purposes.)*

## 🚀 Usage

### 1. Setup
Install requirements:
```bash
pip install -r requirements.txt
```
Ensure you have your `ODDS_API_KEY` set in `.env` or environment variables.

### 2. Run Pipeline
To fetch latest scores, upcoming spreads, and update the graph:
```bash
python3 scripts/run_pipeline.py
```

### Scripts
- `scripts/fetch_scores.py`: Fetches completed game results.
- `scripts/fetch_spreads.py`: Fetches current betting lines.
- `scripts/analyze_and_plot.py`: Analyzes performance and generates `images/performance_graph.png`.
