"""
Canonical team name normalization — single source of truth.
Used by all Python scripts. Keep docs/js/team-utils.js in sync.
"""

NORMALIZATION_MAP = {
    "Brighton and Hove Albion": "Brighton",
    "Leeds United": "Leeds",
    "Manchester City": "Man City",
    "Manchester United": "Man United",
    "Newcastle United": "Newcastle",
    "Nottingham Forest": "Nott'm Forest",
    "Tottenham Hotspur": "Tottenham",
    "West Ham United": "West Ham",
    "Wolverhampton Wanderers": "Wolves",
}

# All 20 EPL teams (2025-26 season) in their normalized form
EPL_TEAMS = [
    "Arsenal",
    "Aston Villa",
    "Bournemouth",
    "Brentford",
    "Brighton",
    "Burnley",
    "Chelsea",
    "Crystal Palace",
    "Everton",
    "Fulham",
    "Ipswich Town",
    "Leeds",
    "Leicester City",
    "Liverpool",
    "Man City",
    "Man United",
    "Newcastle",
    "Nott'm Forest",
    "Southampton",
    "Sunderland",
    "Tottenham",
    "West Ham",
    "Wolves",
]


def normalize(name):
    """Normalize a team name to its canonical form."""
    return NORMALIZATION_MAP.get(name, name)


def snap_spread(spread):
    """Snap Asian handicap quarter lines to half-goal lines.
    0.25 → 0.5, 0.75 → 0.5, 1.25 → 1.5, 1.75 → 1.5, etc.
    """
    frac = abs(spread) % 1
    if frac == 0.25:
        return spread + 0.25 if spread > 0 else spread - 0.25
    elif frac == 0.75:
        return spread - 0.25 if spread > 0 else spread + 0.25
    return spread
