#!/usr/bin/env python3
"""
Fetch EPL team badges from Wikipedia/Wikimedia Commons
Generates a mapping of team names to high-quality badge URLs
"""
import json
import requests

# EPL teams for 2024/25 season
EPL_TEAMS = {
    'Arsenal': 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
    'Aston Villa': 'https://upload.wikimedia.org/wikipedia/en/f/f9/Aston_Villa_logo.svg',
    'Bournemouth': 'https://upload.wikimedia.org/wikipedia/en/e/e5/AFC_Bournemouth_%282013%29.svg',
    'Brentford': 'https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg',
    'Brighton': 'https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg',
    'Chelsea': 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
    'Crystal Palace': 'https://upload.wikimedia.org/wikipedia/en/a/a2/Crystal_Palace_FC_logo_%282022%29.svg',
    'Everton': 'https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg',
    'Fulham': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Fulham_FC_%28shield%29.svg',
    'Ipswich Town': 'https://upload.wikimedia.org/wikipedia/en/4/43/Ipswich_Town.svg',
    'Leicester City': 'https://upload.wikimedia.org/wikipedia/en/2/2d/Leicester_City_crest.svg',
    'Liverpool': 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
    'Manchester City': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
    'Manchester United': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
    'Newcastle United': 'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg',
    'Nottingham Forest': 'https://upload.wikimedia.org/wikipedia/en/e/e5/Nottingham_Forest_F.C._logo.svg',
    'Southampton': 'https://upload.wikimedia.org/wikipedia/en/c/c9/FC_Southampton.svg',
    'Tottenham': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
    'West Ham United': 'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg',
    'Wolverhampton': 'https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg',
}

def verify_badge_url(url):
    """Check if a badge URL is accessible"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10, stream=True)
        # Just read a bit to verify it's an image
        response.raw.read(100)
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}", end=" ")
        return False

def main():
    print("=" * 60)
    print("EPL Team Badge Verification")
    print("=" * 60)

    verified_badges = {}
    failed_badges = []

    for team, url in EPL_TEAMS.items():
        print(f"Checking {team}...", end=" ")
        if verify_badge_url(url):
            verified_badges[team] = url
            print("✓")
        else:
            failed_badges.append(team)
            print("✗ FAILED")

    print("\n" + "=" * 60)
    print(f"Results: {len(verified_badges)}/{len(EPL_TEAMS)} badges verified")
    print("=" * 60)

    if failed_badges:
        print(f"\nFailed badges: {', '.join(failed_badges)}")

    # Output JavaScript object format
    print("\n// Copy this to team-utils.js:")
    print("static teamLogos = {")
    for team, url in sorted(verified_badges.items()):
        print(f"    '{team}': '{url}',")
    print("};")

    # Also save as JSON for reference
    output_file = "docs/data/team-badges.json"
    with open(output_file, "w") as f:
        json.dump(verified_badges, f, indent=2)
    print(f"\n✓ Saved to {output_file}")

if __name__ == "__main__":
    main()
