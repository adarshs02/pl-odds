/**
 * Analyzer
 * Core analysis logic ported from Python
 */

export class Analyzer {
    /**
     * Calculate net performance: (Actual Goal Diff) - (Spread Line)
     */
    static calculateNetPerformance(actualDiff, spread) {
        return actualDiff - spread;
    }

    /**
     * Calculate Pearson correlation coefficient
     */
    static calculateCorrelation(xValues, yValues) {
        const n = xValues.length;
        if (n !== yValues.length || n === 0) {
            return 0;
        }

        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((acc, x, i) => acc + x * yValues[i], 0);
        const sumX2 = xValues.reduce((acc, x) => acc + x * x, 0);
        const sumY2 = yValues.reduce((acc, y) => acc + y * y, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        if (denominator === 0) {
            return 0;
        }

        return numerator / denominator;
    }

    /**
     * Get team statistics from data
     */
    static getTeamStats(teamName, data) {
        const team = data.performance.teams.find(t => t.name === teamName);
        if (!team) return null;

        return {
            name: team.name,
            totalNetPerformance: team.totalNetPerformance,
            matchHistory: team.matchHistory,
            statistics: team.statistics
        };
    }

    /**
     * Get sorted teams by performance
     */
    static getTeamsSortedByPerformance(data, descending = true) {
        const teams = [...data.performance.teams];
        teams.sort((a, b) => {
            return descending
                ? b.totalNetPerformance - a.totalNetPerformance
                : a.totalNetPerformance - b.totalNetPerformance;
        });
        return teams;
    }

    /**
     * Get teams with performance calculated for last N matches only
     */
    static getTeamsForLastNMatches(data, n) {
        return data.performance.teams.map(team => {
            // Get last N matches
            const recentMatches = team.matchHistory.slice(-n);

            // Calculate total net performance for recent matches
            const recentNetPerformance = recentMatches.reduce(
                (sum, match) => sum + match.netPerformance,
                0
            );

            // Calculate statistics for recent matches
            const wins = recentMatches.filter(m => m.result === 'W').length;
            const losses = recentMatches.filter(m => m.result === 'L').length;
            const draws = recentMatches.filter(m => m.result === 'D').length;
            const covers = recentMatches.filter(m => m.netPerformance > 0).length;
            const matchesPlayed = recentMatches.length;

            return {
                ...team,
                totalNetPerformance: recentNetPerformance,
                statistics: {
                    matchesPlayed,
                    wins,
                    losses,
                    draws,
                    covers,
                    avgNetPerformance: matchesPlayed > 0 ? recentNetPerformance / matchesPlayed : 0,
                    winRate: matchesPlayed > 0 ? wins / matchesPlayed : 0,
                    coverRate: matchesPlayed > 0 ? covers / matchesPlayed : 0
                }
            };
        });
    }

    /**
     * Get teams filtered by date range or match count
     */
    static getFilteredTeams(data, filterType) {
        switch (filterType) {
            case 'last5':
                return this.getTeamsForLastNMatches(data, 5);
            case 'last10':
                return this.getTeamsForLastNMatches(data, 10);
            case 'season':
                // Filter by matches from August onwards (current season)
                const currentYear = new Date().getFullYear();
                const seasonStart = new Date(currentYear, 7, 1); // August 1st
                return data.performance.teams.map(team => {
                    const seasonMatches = team.matchHistory.filter(m =>
                        new Date(m.date) >= seasonStart
                    );

                    const seasonNetPerformance = seasonMatches.reduce(
                        (sum, match) => sum + match.netPerformance,
                        0
                    );

                    const wins = seasonMatches.filter(m => m.result === 'W').length;
                    const losses = seasonMatches.filter(m => m.result === 'L').length;
                    const draws = seasonMatches.filter(m => m.result === 'D').length;
                    const covers = seasonMatches.filter(m => m.netPerformance > 0).length;
                    const matchesPlayed = seasonMatches.length;

                    return {
                        ...team,
                        totalNetPerformance: seasonNetPerformance,
                        statistics: {
                            matchesPlayed,
                            wins,
                            losses,
                            draws,
                            covers,
                            avgNetPerformance: matchesPlayed > 0 ? seasonNetPerformance / matchesPlayed : 0,
                            winRate: matchesPlayed > 0 ? wins / matchesPlayed : 0,
                            coverRate: matchesPlayed > 0 ? covers / matchesPlayed : 0
                        }
                    };
                });
            case 'all':
            default:
                return data.performance.teams;
        }
    }

    /**
     * Get sorted teams alphabetically
     */
    static getTeamsSortedAlphabetically(data) {
        const teams = [...data.performance.teams];
        teams.sort((a, b) => a.name.localeCompare(b.name));
        return teams;
    }

    /**
     * Get top N performing teams
     */
    static getTopTeams(data, n = 5) {
        return this.getTeamsSortedByPerformance(data, true).slice(0, n);
    }

    /**
     * Get bottom N performing teams
     */
    static getBottomTeams(data, n = 5) {
        return this.getTeamsSortedByPerformance(data, false).slice(0, n);
    }

    /**
     * Get historical trend data for a team
     */
    static getHistoricalTrend(teamName, data) {
        const team = data.performance.teams.find(t => t.name === teamName);
        if (!team) return [];

        return team.matchHistory.map(match => ({
            date: new Date(match.date),
            value: match.cumulativeNetPerformance,
            opponent: match.opponent,
            result: match.result,
            score: match.score
        }));
    }

    /**
     * Get favorite team from a match (based on h2h odds)
     */
    static getFavorite(match) {
        const homeOdds = match.h2hOdds?.home;
        const awayOdds = match.h2hOdds?.away;

        if (!homeOdds || !awayOdds) return 'Unknown';

        return homeOdds < awayOdds ? match.homeTeam : match.awayTeam;
    }

    /**
     * Calculate implied probability from decimal odds
     */
    static impliedProbability(decimalOdds) {
        if (!decimalOdds || decimalOdds === 0) return 0;
        return 1.0 / decimalOdds;
    }

    /**
     * Format date for display
     */
    static formatDate(dateStr) {
        const date = new Date(dateStr);
        const options = {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        return date.toLocaleString('en-US', options);
    }

    /**
     * Format date (short version - just date)
     */
    static formatDateShort(dateStr) {
        const date = new Date(dateStr);
        const options = {
            month: 'short',
            day: 'numeric'
        };
        return date.toLocaleString('en-US', options);
    }

    /**
     * Get CSS class for result
     */
    static getResultClass(result) {
        return `result-${result}`;
    }

    /**
     * Get CSS class for net performance
     */
    static getNetPerfClass(value) {
        return value >= 0 ? 'net-perf-positive' : 'net-perf-negative';
    }

    /**
     * Get color for performance value
     */
    static getPerformanceColor(value) {
        const style = getComputedStyle(document.documentElement);
        return value >= 0
            ? style.getPropertyValue('--accent-positive').trim()
            : style.getPropertyValue('--accent-negative').trim();
    }

    /**
     * Format number with + sign for positive values
     */
    static formatNetPerf(value) {
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}`;
    }

    /**
     * Get match result from score
     */
    static getMatchResult(homeScore, awayScore) {
        const home = parseInt(homeScore);
        const away = parseInt(awayScore);

        if (home > away) return 'Home Win';
        if (away > home) return 'Away Win';
        return 'Draw';
    }
}
