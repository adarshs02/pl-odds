/**
 * Team Utilities
 * Handles team logos, colors, and metadata
 */

export class TeamUtils {
    // Verified team badge URLs from Wikipedia/Wikimedia (high quality SVG)
    static teamLogos = {
        'Arsenal': 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
        'Aston Villa': null, // Will use fallback
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
        // Aliases
        'Man City': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
        'Man United': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
        'Newcastle': 'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg',
        'Leeds': 'https://upload.wikimedia.org/wikipedia/en/5/54/Leeds_United_F.C._logo.svg',
        'Spurs': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
        'Nott\'m Forest': 'https://upload.wikimedia.org/wikipedia/en/e/e5/Nottingham_Forest_F.C._logo.svg',
        'West Ham': 'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg',
        'Wolves': 'https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg'
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
     * Get team logo URL from Wikipedia/Wikimedia Commons
     */
    static getLogoUrl(teamName) {
        return this.teamLogos[teamName] || null;
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
