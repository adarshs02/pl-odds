/**
 * Main Application
 * Orchestrates all components and manages application state
 */

import { ThemeManager } from './theme-manager.js';
import { DataLoader } from './data-loader.js';
import { Router } from './router.js';
import { Analyzer } from './analyzer.js';
import { PerformanceChart } from './components/performance-chart.js';
import { PieChart } from './components/pie-chart.js';
import { TeamUtils } from './team-utils.js';

class Dashboard {
    constructor() {
        this.data = null;
        this.performanceChart = null;
    }

    async init() {
        try {
            console.log('Initializing dashboard...');

            // Initialize theme manager
            ThemeManager.init();

            // Load data
            this.data = await DataLoader.loadAll();

            // Update stats
            this.updateStats();

            // Initialize router
            Router.init({
                onDashboard: () => this.renderDashboard(),
                onTeamDetail: (teamName) => this.renderTeamDetail(teamName)
            });

            // Hide loading overlay
            this.hideLoading();

            console.log('Dashboard initialized successfully');
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError(error.message);
        }
    }

    updateStats() {
        // Update stats summary cards
        document.getElementById('stat-matches').textContent = this.data.performance.totalMatches || 0;
        document.getElementById('stat-teams').textContent = this.data.performance.teamsTracked || 0;
        document.getElementById('stat-correlation').textContent = this.data.performance.correlation?.toFixed(3) || 'N/A';
        document.getElementById('stat-upcoming').textContent = this.data.odds.totalMatches || 0;

        // Update last updated timestamp
        const lastUpdated = new Date(this.data.performance.lastUpdated);
        document.getElementById('last-updated').textContent = lastUpdated.toLocaleString();
    }

    renderDashboard() {
        console.log('Rendering dashboard view');

        // Render performance chart
        if (this.performanceChart) {
            this.performanceChart.destroy();
        }
        this.performanceChart = new PerformanceChart('performance-chart', this.data);

        // Setup chart controls
        const sortSelect = document.getElementById('chart-sort');
        const filterSelect = document.getElementById('chart-filter');
        const locationSelect = document.getElementById('chart-location');
        const bookmakerSelect = document.getElementById('chart-bookmaker');

        // Populate bookmaker dropdown
        if (bookmakerSelect) {
            const bookmakers = Analyzer.getAvailableBookmakers(this.data);
            // Clear existing options except first (consensus)
            while (bookmakerSelect.options.length > 1) {
                bookmakerSelect.remove(1);
            }
            // Add bookmaker options
            bookmakers.forEach(bk => {
                const option = document.createElement('option');
                option.value = bk;
                option.textContent = Analyzer.formatBookmakerName(bk);
                bookmakerSelect.appendChild(option);
            });
        }

        const updateChart = () => {
            const sortBy = sortSelect ? sortSelect.value : 'performance';
            const filterBy = filterSelect ? filterSelect.value : 'all';
            const locationBy = locationSelect ? locationSelect.value : 'all';
            const bookmaker = bookmakerSelect ? bookmakerSelect.value : 'consensus';
            this.performanceChart.update(sortBy, filterBy, locationBy, bookmaker);
        };

        if (sortSelect) {
            sortSelect.addEventListener('change', updateChart);
        }

        if (filterSelect) {
            filterSelect.addEventListener('change', updateChart);
        }

        if (locationSelect) {
            locationSelect.addEventListener('change', updateChart);
        }

        if (bookmakerSelect) {
            bookmakerSelect.addEventListener('change', updateChart);
        }

        // Render odds table
        this.renderOddsTable();

        // Setup sidebar toggle
        this.setupSidebarToggle();

        // Render historical trends (top 5 teams)
        this.renderHistoricalTrends();
    }

    renderOddsTable() {
        const tbody = document.getElementById('odds-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        const matches = DataLoader.getUpcomingMatches(this.data);

        if (matches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">No upcoming matches</td></tr>';
            return;
        }

        matches.forEach(match => {
            const row = document.createElement('tr');

            // Column 1: Date
            const dateCell = document.createElement('td');
            dateCell.textContent = Analyzer.formatDateShort(match.commenceTime);
            row.appendChild(dateCell);

            // Column 2: Match (Team vs Team)
            const matchCell = document.createElement('td');
            const homeTeam = document.createElement('span');
            homeTeam.textContent = match.homeTeam;
            homeTeam.className = 'team-name';
            homeTeam.dataset.team = match.homeTeam;
            homeTeam.style.cursor = 'pointer';
            homeTeam.style.color = 'var(--accent-primary)';
            homeTeam.style.fontWeight = '600';

            const vs = document.createTextNode(' vs ');

            const awayTeam = document.createElement('span');
            awayTeam.textContent = match.awayTeam;
            awayTeam.className = 'team-name';
            awayTeam.dataset.team = match.awayTeam;
            awayTeam.style.cursor = 'pointer';
            awayTeam.style.color = 'var(--accent-primary)';
            awayTeam.style.fontWeight = '600';

            matchCell.appendChild(homeTeam);
            matchCell.appendChild(vs);
            matchCell.appendChild(awayTeam);
            row.appendChild(matchCell);

            // Column 3: Favorite
            const favoriteCell = document.createElement('td');
            const favorite = Analyzer.getFavorite(match);
            let spread = 'N/A';
            if (match.spread && match.spread.homePoint) {
                spread = Analyzer.formatNetPerf(match.spread.homePoint);
            }
            favoriteCell.innerHTML = `<span class="favorite-badge">${favorite}<br><small>(${spread})</small></span>`;
            row.appendChild(favoriteCell);

            tbody.appendChild(row);
        });

        // Add click handlers for team names
        tbody.querySelectorAll('.team-name').forEach(el => {
            el.addEventListener('click', () => {
                Router.navigateToTeam(el.dataset.team);
            });
        });
    }

    setupSidebarToggle() {
        const toggle = document.getElementById('sidebar-toggle');
        const content = document.querySelector('.sidebar-content');

        if (!toggle || !content) return;

        // Remove existing listeners by cloning
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);

        newToggle.addEventListener('click', () => {
            content.classList.toggle('collapsed');
            const icon = newToggle.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = content.classList.contains('collapsed') ? '▼' : '▲';
            }
        });

        // Start collapsed on mobile/tablet, expanded on desktop
        if (window.innerWidth < 1024) {
            content.classList.add('collapsed');
            const icon = newToggle.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = '▼';
            }
        }

        // Update on window resize
        const resizeHandler = () => {
            if (window.innerWidth >= 1024 && content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                const icon = newToggle.querySelector('.toggle-icon');
                if (icon) {
                    icon.textContent = '▲';
                }
            }
        };

        window.addEventListener('resize', resizeHandler);
    }

    renderHistoricalTrends() {
        // Get top 5 teams
        const topTeams = Analyzer.getTopTeams(this.data, 5);

        const container = d3.select('#historical-trends');
        container.html('');

        if (topTeams.length === 0) {
            container.append('p')
                .style('text-align', 'center')
                .style('padding', '2rem')
                .text('No data available');
            return;
        }

        // Dimensions
        const containerNode = container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = 400;
        const margin = { top: 20, right: 120, bottom: 40, left: 50 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        // Create SVG
        const svg = container.append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Prepare data
        const teamColors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
        const linesData = topTeams.map((team, i) => ({
            name: team.name,
            color: teamColors[i],
            values: team.matchHistory.map(m => ({
                date: new Date(m.date),
                value: m.cumulativeNetPerformance
            }))
        }));

        // Scales
        const allDates = linesData.flatMap(d => d.values.map(v => v.date));
        const allValues = linesData.flatMap(d => d.values.map(v => v.value));

        const xScale = d3.scaleTime()
            .domain(d3.extent(allDates))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(allValues) * 1.1, d3.max(allValues) * 1.1])
            .range([height, 0]);

        // Axes
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(6));

        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).ticks(6));

        // Grid
        svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .ticks(6)
                .tickSize(-width)
                .tickFormat('')
            );

        // Line generator
        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        // Draw lines
        linesData.forEach(teamData => {
            svg.append('path')
                .datum(teamData.values)
                .attr('class', 'trend-line')
                .attr('fill', 'none')
                .attr('stroke', teamData.color)
                .attr('stroke-width', 2)
                .attr('d', line);
        });

        // Legend
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + 10}, 0)`);

        linesData.forEach((teamData, i) => {
            const legendRow = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            legendRow.append('line')
                .attr('x1', 0)
                .attr('x2', 20)
                .attr('y1', 9)
                .attr('y2', 9)
                .attr('stroke', teamData.color)
                .attr('stroke-width', 2);

            legendRow.append('text')
                .attr('x', 25)
                .attr('y', 9)
                .attr('dy', '0.35em')
                .attr('fill', 'var(--text-secondary)')
                .attr('font-size', '12px')
                .text(teamData.name);
        });
    }

    renderTeamDetail(teamName) {
        console.log('Rendering team detail for:', teamName);

        const teamData = DataLoader.getTeamData(this.data, teamName);

        if (!teamData) {
            this.showError(`Team "${teamName}" not found`);
            Router.navigateToDashboard();
            return;
        }

        // Update team header with logo
        const teamNameElement = document.getElementById('team-name');
        teamNameElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1.5rem;">
                ${TeamUtils.createLogoElement(teamData.name, 'large')}
                <span>${teamData.name}</span>
            </div>
        `;
        document.getElementById('team-net-perf').textContent = Analyzer.formatNetPerf(teamData.totalNetPerformance);
        document.getElementById('team-net-perf').className = `value ${Analyzer.getNetPerfClass(teamData.totalNetPerformance)}`;
        document.getElementById('team-matches').textContent = teamData.statistics.matchesPlayed;
        document.getElementById('team-win-rate').textContent = `${(teamData.statistics.winRate * 100).toFixed(1)}%`;
        document.getElementById('team-cover-rate').textContent = `${(teamData.statistics.coverRate * 100).toFixed(1)}%`;

        // Calculate and display home/away breakdown
        this.renderHomeAwayBreakdown(teamData);

        // Render pie charts
        this.renderPieCharts(teamData);

        // Render team trend chart
        this.renderTeamTrendChart(teamData);

        // Render match history table
        this.renderMatchHistoryTable(teamData);

        // Render bookmaker comparison table
        this.renderBookmakerComparison(teamData);
    }

    renderBookmakerComparison(teamData) {
        const tbody = document.getElementById('bookmaker-comparison-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Get bookmakers from team data
        const coversByBk = teamData.statistics.coversByBookmaker || {};
        const coverRateByBk = teamData.statistics.coverRateByBookmaker || {};
        const totalPerfByBk = teamData.totalNetPerformanceByBookmaker || {};

        // Get unique bookmakers
        const bookmakers = Object.keys(coversByBk);

        if (bookmakers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1rem;">No per-bookmaker data available yet</td></tr>';
            return;
        }

        // Sort by net performance descending
        bookmakers.sort((a, b) => (totalPerfByBk[b] || 0) - (totalPerfByBk[a] || 0));

        bookmakers.forEach(bk => {
            const netPerf = totalPerfByBk[bk] || 0;
            const coverRate = coverRateByBk[bk] || 0;
            const covers = coversByBk[bk] || 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight: 600;">${Analyzer.formatBookmakerName(bk)}</td>
                <td class="${Analyzer.getNetPerfClass(netPerf)}" style="font-weight: 700; font-variant-numeric: tabular-nums;">
                    ${Analyzer.formatNetPerf(netPerf)}
                </td>
                <td style="font-variant-numeric: tabular-nums;">${(coverRate * 100).toFixed(1)}%</td>
                <td style="text-align: center;">${covers} covers</td>
            `;
            tbody.appendChild(row);
        });
    }

    renderHomeAwayBreakdown(teamData) {
        // Filter matches by location
        const homeMatches = teamData.matchHistory.filter(m => m.homeAway === 'home');
        const awayMatches = teamData.matchHistory.filter(m => m.homeAway === 'away');

        // Calculate home stats
        const homeNetPerf = homeMatches.reduce((sum, m) => sum + m.netPerformance, 0);
        const homeWins = homeMatches.filter(m => m.result === 'W').length;
        const homeCovers = homeMatches.filter(m => m.netPerformance > 0).length;

        // Calculate away stats
        const awayNetPerf = awayMatches.reduce((sum, m) => sum + m.netPerformance, 0);
        const awayWins = awayMatches.filter(m => m.result === 'W').length;
        const awayCovers = awayMatches.filter(m => m.netPerformance > 0).length;

        // Update home stats
        const homeNetPerfEl = document.getElementById('home-net-perf');
        homeNetPerfEl.textContent = Analyzer.formatNetPerf(homeNetPerf);
        homeNetPerfEl.className = Analyzer.getNetPerfClass(homeNetPerf);
        document.getElementById('home-matches').textContent = homeMatches.length;
        document.getElementById('home-win-rate').textContent = homeMatches.length > 0
            ? `${((homeWins / homeMatches.length) * 100).toFixed(1)}%`
            : 'N/A';
        document.getElementById('home-cover-rate').textContent = homeMatches.length > 0
            ? `${((homeCovers / homeMatches.length) * 100).toFixed(1)}%`
            : 'N/A';

        // Update away stats
        const awayNetPerfEl = document.getElementById('away-net-perf');
        awayNetPerfEl.textContent = Analyzer.formatNetPerf(awayNetPerf);
        awayNetPerfEl.className = Analyzer.getNetPerfClass(awayNetPerf);
        document.getElementById('away-matches').textContent = awayMatches.length;
        document.getElementById('away-win-rate').textContent = awayMatches.length > 0
            ? `${((awayWins / awayMatches.length) * 100).toFixed(1)}%`
            : 'N/A';
        document.getElementById('away-cover-rate').textContent = awayMatches.length > 0
            ? `${((awayCovers / awayMatches.length) * 100).toFixed(1)}%`
            : 'N/A';
    }

    renderPieCharts(teamData) {
        // Create results pie chart (wins/draws/losses)
        const resultsPieChart = new PieChart('results-pie-chart', {
            wins: teamData.statistics.wins,
            draws: teamData.statistics.draws,
            losses: teamData.statistics.losses
        }, 'results');

        // Create covers pie chart
        const coversPieChart = new PieChart('covers-pie-chart', {
            covers: teamData.statistics.covers,
            matchesPlayed: teamData.statistics.matchesPlayed
        }, 'covers');
    }

    renderTeamTrendChart(teamData) {
        const container = d3.select('#team-trend-chart');
        container.html('');

        // Dimensions
        const containerNode = container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = 300;
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        // Create SVG
        const svg = container.append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const data = teamData.matchHistory.map(m => ({
            date: new Date(m.date),
            value: m.cumulativeNetPerformance
        }));

        // Scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => d.date))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(data, d => d.value) * 1.1, d3.max(data, d => d.value) * 1.1])
            .range([height, 0]);

        // Axes
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(6));

        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).ticks(6));

        // Area
        const area = d3.area()
            .x(d => xScale(d.date))
            .y0(height)
            .y1(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(data)
            .attr('fill', Analyzer.getPerformanceColor(teamData.totalNetPerformance))
            .attr('opacity', 0.3)
            .attr('d', area);

        // Line
        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', Analyzer.getPerformanceColor(teamData.totalNetPerformance))
            .attr('stroke-width', 2)
            .attr('d', line);

        // Zero line
        svg.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', yScale(0))
            .attr('y2', yScale(0))
            .attr('stroke', 'var(--chart-grid)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4');
    }

    renderMatchHistoryTable(teamData) {
        const tbody = document.getElementById('match-history-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Reverse to show most recent first
        const matches = [...teamData.matchHistory].reverse();

        matches.forEach(match => {
            const row = document.createElement('tr');

            // Calculate actual margin from score
            const [teamScore, oppScore] = match.score.split('-').map(s => parseInt(s.trim()));
            const actualMargin = teamScore - oppScore;

            // Calculate expected margin from spread (spread is from team's perspective)
            const expectedMargin = -match.spread;

            // Check if beat the spread
            const beatSpread = match.netPerformance > 0;

            row.innerHTML = `
                <td style="white-space: nowrap;">${Analyzer.formatDateShort(match.date)}</td>
                <td class="team-name" data-team="${match.opponent}" style="cursor: pointer; font-weight: 600;">
                    ${match.opponent}
                </td>
                <td style="text-align: center;">
                    <span style="display: inline-block; padding: 2px 8px; background: ${match.homeAway === 'home' ? 'var(--accent-primary)' : 'var(--accent-neutral)'}; color: white; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                        ${match.homeAway === 'home' ? 'HOME' : 'AWAY'}
                    </span>
                </td>
                <td style="font-weight: 600; font-variant-numeric: tabular-nums;">${match.score}</td>
                <td class="${Analyzer.getResultClass(match.result)}" style="font-weight: 700;">
                    ${match.result === 'W' ? 'Win' : match.result === 'L' ? 'Loss' : 'Draw'}
                </td>
                <td style="font-variant-numeric: tabular-nums;">
                    ${Analyzer.formatNetPerf(expectedMargin)}
                    <span style="color: var(--text-tertiary); font-size: 0.85rem;"> (line: ${Analyzer.formatNetPerf(match.spread)})</span>
                </td>
                <td style="font-weight: 600; font-variant-numeric: tabular-nums;">
                    ${Analyzer.formatNetPerf(actualMargin)}
                </td>
                <td class="${Analyzer.getNetPerfClass(match.netPerformance)}" style="font-weight: 700; font-variant-numeric: tabular-nums;">
                    ${Analyzer.formatNetPerf(match.netPerformance)}
                </td>
                <td style="text-align: center;">
                    <span style="font-size: 1.5rem;" title="${beatSpread ? 'Beat the spread' : 'Did not beat the spread'}">
                        ${beatSpread ? '✅' : '❌'}
                    </span>
                </td>
            `;

            tbody.appendChild(row);
        });

        // Add click handlers for opponent names
        tbody.querySelectorAll('.team-name').forEach(el => {
            el.addEventListener('click', () => {
                Router.navigateToTeam(el.dataset.team);
            });
        });
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    showError(message) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <p style="color: var(--accent-negative); font-size: 1.2rem;">
                    Error: ${message}
                </p>
                <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">
                    Reload Page
                </button>
            `;
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new Dashboard();
        app.init();
    });
} else {
    const app = new Dashboard();
    app.init();
}
