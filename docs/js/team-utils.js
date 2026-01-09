/**
 * Team Utilities
 * Handles team logos, colors, and metadata
 */

export class TeamUtils {
    // Team name to logo slug mapping
    static teamLogos = {
        'Arsenal': 'arsenal',
        'Aston Villa': 'aston-villa',
        'Bournemouth': 'bournemouth',
        'Brentford': 'brentford',
        'Brighton': 'brighton-hove-albion',
        'Chelsea': 'chelsea',
        'Crystal Palace': 'crystal-palace',
        'Everton': 'everton',
        'Fulham': 'fulham',
        'Ipswich Town': 'ipswich-town',
        'Leicester City': 'leicester-city',
        'Liverpool': 'liverpool',
        'Manchester City': 'manchester-city',
        'Manchester United': 'manchester-united',
        'Newcastle United': 'newcastle-united',
        'Nottingham Forest': 'nottingham-forest',
        'Southampton': 'southampton',
        'Tottenham': 'tottenham-hotspur',
        'West Ham United': 'west-ham-united',
        'Wolverhampton': 'wolverhampton-wanderers',
        'Man City': 'manchester-city',
        'Man United': 'manchester-united',
        'Spurs': 'tottenham-hotspur'
    };

    // Team colors for fallback backgrounds
    static teamColors = {
        'Arsenal': '#EF0107',
        'Aston Villa': '#95BFE5',
        'Bournemouth': '#DA291C',
        'Brentford': '#E30613',
        'Brighton': '#0057B8',
        'Chelsea': '#034694',
        'Crystal Palace': '#1B458F',
        'Everton': '#003399',
        'Fulham': '#FFFFFF',
        'Ipswich Town': '#0000FF',
        'Leicester City': '#0053A0',
        'Liverpool': '#C8102E',
        'Manchester City': '#6CABDD',
        'Manchester United': '#DA291C',
        'Newcastle United': '#241F20',
        'Nottingham Forest': '#DD0000',
        'Southampton': '#D71920',
        'Tottenham': '#132257',
        'West Ham United': '#7A263A',
        'Wolverhampton': '#FDB913'
    };

    /**
     * Get team logo URL
     */
    static getLogoUrl(teamName) {
        const slug = this.teamLogos[teamName];
        if (!slug) {
            return null;
        }
        // Using GitHub's awesome EPL logos repository
        return `https://resources.premierleague.com/premierleague/badges/rb/t${this.getTeamId(teamName)}.svg`;
    }

    /**
     * Get Premier League team ID for logo
     */
    static getTeamId(teamName) {
        const ids = {
            'Arsenal': '3',
            'Aston Villa': '7',
            'Bournemouth': '91',
            'Brentford': '94',
            'Brighton': '131',
            'Chelsea': '8',
            'Crystal Palace': '31',
            'Everton': '11',
            'Fulham': '54',
            'Ipswich Town': '40',
            'Leicester City': '13',
            'Liverpool': '14',
            'Manchester City': '43',
            'Manchester United': '1',
            'Newcastle United': '4',
            'Nottingham Forest': '17',
            'Southampton': '20',
            'Tottenham': '6',
            'West Ham United': '21',
            'Wolverhampton': '39'
        };
        return ids[teamName] || '1';
    }

    /**
     * Get team initials for fallback
     */
    static getInitials(teamName) {
        // Handle special cases
        if (teamName === 'Manchester City' || teamName === 'Man City') return 'MC';
        if (teamName === 'Manchester United' || teamName === 'Man United') return 'MU';
        if (teamName === 'Newcastle United') return 'NEW';
        if (teamName === 'West Ham United') return 'WHU';
        if (teamName === 'Nottingham Forest') return 'NF';
        if (teamName === 'Aston Villa') return 'AV';
        if (teamName === 'Crystal Palace') return 'CP';
        if (teamName === 'Brighton') return 'BHA';
        if (teamName === 'Ipswich Town') return 'IPS';
        if (teamName === 'Leicester City') return 'LEI';

        // Default: take first letter of each word
        return teamName
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 3);
    }

    /**
     * Get team color
     */
    static getColor(teamName) {
        return this.teamColors[teamName] || '#6c757d';
    }

    /**
     * Create logo HTML element
     */
    static createLogoElement(teamName, size = 'medium') {
        const sizes = {
            small: 32,
            medium: 64,
            large: 96
        };
        const px = sizes[size] || sizes.medium;

        const logoUrl = this.getLogoUrl(teamName);
        const initials = this.getInitials(teamName);
        const color = this.getColor(teamName);

        if (logoUrl) {
            return `
                <div class="team-logo team-logo-${size}" style="width: ${px}px; height: ${px}px;">
                    <img
                        src="${logoUrl}"
                        alt="${teamName}"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        style="width: 100%; height: 100%; object-fit: contain;"
                    />
                    <div class="team-logo-fallback" style="display: none; width: 100%; height: 100%; background: ${color}; color: white; align-items: center; justify-content: center; border-radius: 8px; font-weight: 700; font-size: ${px * 0.4}px;">
                        ${initials}
                    </div>
                </div>
            `;
        }

        // Fallback to initials
        return `
            <div class="team-logo team-logo-${size}" style="width: ${px}px; height: ${px}px; background: ${color}; color: white; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: 700; font-size: ${px * 0.4}px;">
                ${initials}
            </div>
        `;
    }

    /**
     * Format team name for display
     */
    static formatTeamName(teamName) {
        // Normalize team names
        const normalized = {
            'Man City': 'Manchester City',
            'Man United': 'Manchester United',
            'Spurs': 'Tottenham'
        };
        return normalized[teamName] || teamName;
    }
}
