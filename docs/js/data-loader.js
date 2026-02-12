/**
 * Data Loader
 * Handles fetching and caching of data files
 */

export class DataLoader {
    static CACHE_KEY = 'pl-odds-cache';
    static CACHE_DURATION = 3600000; // 1 hour in milliseconds

    static async loadAll() {
        console.log('Loading data...');

        // Check cache first
        const cached = this.getCached();
        if (cached) {
            console.log('Using cached data');
            return cached;
        }

        // Load fresh data
        try {
            const [performanceData, oddsData, kalshiData] = await Promise.all([
                this.fetchJSON('data/aggregated/team-performance-history.json'),
                this.fetchJSON('data/aggregated/latest-odds.json'),
                this.fetchJSON('data/aggregated/kalshi-odds.json').catch(() => null)
            ]);

            const data = {
                performance: performanceData,
                odds: oddsData,
                kalshi: kalshiData,
                timestamp: Date.now()
            };

            this.setCache(data);
            console.log('Data loaded successfully');
            return data;

        } catch (error) {
            console.error('Error loading data:', error);
            throw new Error('Failed to load dashboard data. Please refresh the page.');
        }
    }

    static async fetchJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        return await response.json();
    }

    static getCached() {
        try {
            const cachedStr = localStorage.getItem(this.CACHE_KEY);
            if (!cachedStr) return null;

            const cached = JSON.parse(cachedStr);
            const age = Date.now() - cached.timestamp;

            if (age < this.CACHE_DURATION) {
                console.log(`Cache age: ${Math.round(age / 1000)}s`);
                return cached;
            } else {
                console.log('Cache expired');
                localStorage.removeItem(this.CACHE_KEY);
                return null;
            }
        } catch (error) {
            console.error('Error reading cache:', error);
            localStorage.removeItem(this.CACHE_KEY);
            return null;
        }
    }

    static setCache(data) {
        try {
            const cacheStr = JSON.stringify(data);
            localStorage.setItem(this.CACHE_KEY, cacheStr);
            console.log('Data cached successfully');
        } catch (error) {
            console.error('Error caching data:', error);
            // If localStorage is full, clear it and try again
            if (error.name === 'QuotaExceededError') {
                localStorage.clear();
                try {
                    localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
                } catch (e) {
                    console.warn('Could not cache data:', e);
                }
            }
        }
    }

    static clearCache() {
        localStorage.removeItem(this.CACHE_KEY);
        console.log('Cache cleared');
    }

    static getTeamData(data, teamName) {
        return data.performance.teams.find(t => t.name === teamName);
    }

    static getUpcomingMatches(data) {
        return data.odds.upcomingMatches || [];
    }

    static getAllTeams(data) {
        return data.performance.teams || [];
    }

    static getKalshiData(data) {
        return data.kalshi || null;
    }
}
