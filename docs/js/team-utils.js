/**
 * Team Utilities
 * Handles team logos, colors, and metadata
 * NOTE: Keep aliases in sync with scripts/team_names.py (source of truth)
 */

export class TeamUtils {
    // Local team badge SVGs (sourced from Wikipedia/Wikimedia)
    static LOGO_PATH = 'img/logos/';
    static teamLogos = {
        'Arsenal': 'arsenal.svg',
        'Aston Villa': 'aston-villa.svg',
        'Bournemouth': 'bournemouth.svg',
        'Brentford': 'brentford.svg',
        'Brighton': 'brighton.svg',
        'Burnley': 'burnley.svg',
        'Chelsea': 'chelsea.svg',
        'Crystal Palace': 'crystal-palace.svg',
        'Everton': 'everton.svg',
        'Fulham': 'fulham.svg',
        'Leeds': 'leeds.svg',
        'Liverpool': 'liverpool.svg',
        'Man City': 'man-city.svg',
        'Man United': 'man-united.svg',
        'Newcastle': 'newcastle.svg',
        "Nott'm Forest": 'nottm-forest.svg',
        'Sunderland': 'sunderland.svg',
        'Tottenham': 'tottenham.svg',
        'West Ham': 'west-ham.svg',
        'Wolves': 'wolves.svg',
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
        'Wolverhampton': '#FDB913',
        // Aliases for normalized names
        'Man City': '#6CABDD',
        'Man United': '#DA291C',
        'Newcastle': '#241F20',
        'Leeds': '#FFCD00',
        'Nott\'m Forest': '#DD0000',
        'West Ham': '#7A263A',
        'Wolves': '#FDB913'
    };

    /**
     * Get team logo URL (local SVG files)
     */
    static getLogoUrl(teamName) {
        const filename = this.teamLogos[teamName];
        return filename ? this.LOGO_PATH + filename : null;
    }

    /**
     * Get team initials for fallback
     */
    static getInitials(teamName) {
        // Handle special cases
        if (teamName === 'Manchester City' || teamName === 'Man City') return 'MC';
        if (teamName === 'Manchester United' || teamName === 'Man United') return 'MU';
        if (teamName === 'Newcastle United' || teamName === 'Newcastle') return 'NEW';
        if (teamName === 'West Ham United' || teamName === 'West Ham') return 'WHU';
        if (teamName === 'Nottingham Forest' || teamName === "Nott'm Forest") return 'NF';
        if (teamName === 'Leeds United' || teamName === 'Leeds') return 'LEE';
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
