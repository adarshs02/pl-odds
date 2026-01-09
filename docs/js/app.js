/**
 * Main Application
 * Orchestrates all components and manages application state
 */

import { ThemeManager } from './theme-manager.js';
import { DataLoader } from './data-loader.js';
import { Router } from './router.js';
import { Analyzer } from './analyzer.js';
import { PerformanceChart } from './components/performance-chart.js';

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
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.performanceChart.updateSort(e.target.value);
            });
        }

        // Render odds table
        this.renderOddsTable();

        // Render historical trends (top 5 teams)
        this.renderHistoricalTrends();
    }

    renderOddsTable() {
        const tbody = document.getElementById('odds-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        const matches = DataLoader.getUpcomingMatches(this.data);

        if (matches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No upcoming matches</td></tr>';
            return;
        }

        matches.forEach(match => {
            const row = document.createElement('tr');

            // Date
            const dateCell = document.createElement('td');
            dateCell.textContent = Analyzer.formatDate(match.commenceTime);
            row.appendChild(dateCell);

            // Match
            const matchCell = document.createElement('td');
            matchCell.innerHTML = `
                <span class="team-name" data-team="${match.homeTeam}">${match.homeTeam}</span>
                <br>vs<br>
                <span class="team-name" data-team="${match.awayTeam}">${match.awayTeam}</span>
            `;
            row.appendChild(matchCell);

            // Home Odds
            const homeOddsCell = document.createElement('td');
            homeOddsCell.className = 'odds-value';
            homeOddsCell.textContent = match.h2hOdds?.home?.toFixed(2) || 'N/A';
            row.appendChild(homeOddsCell);

            // Draw Odds
            const drawOddsCell = document.createElement('td');
            drawOddsCell.className = 'odds-value';
            drawOddsCell.textContent = match.h2hOdds?.draw?.toFixed(2) || 'N/A';
            row.appendChild(drawOddsCell);

            // Away Odds
            const awayOddsCell = document.createElement('td');
            awayOddsCell.className = 'odds-value';
            awayOddsCell.textContent = match.h2hOdds?.away?.toFixed(2) || 'N/A';
            row.appendChild(awayOddsCell);

            // Spread
            const spreadCell = document.createElement('td');
            if (match.spread) {
                spreadCell.textContent = `${match.homeTeam} ${Analyzer.formatNetPerf(match.spread.homePoint)}`;
            } else {
                spreadCell.textContent = 'N/A';
            }
            row.appendChild(spreadCell);

            // Favorite
            const favoriteCell = document.createElement('td');
            const favorite = Analyzer.getFavorite(match);
            favoriteCell.innerHTML = `<span class="favorite-badge">${favorite}</span>`;
            row.appendChild(favoriteCell);

            tbody.appendChild(row);
        });

        // Add click handlers for team names
        tbody.querySelectorAll('.team-name').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                Router.navigateToTeam(el.dataset.team);
            });
        });
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

        // Update team header
        document.getElementById('team-name').textContent = teamData.name;
        document.getElementById('team-net-perf').textContent = Analyzer.formatNetPerf(teamData.totalNetPerformance);
        document.getElementById('team-net-perf').className = `value ${Analyzer.getNetPerfClass(teamData.totalNetPerformance)}`;
        document.getElementById('team-matches').textContent = teamData.statistics.matchesPlayed;
        document.getElementById('team-win-rate').textContent = `${(teamData.statistics.winRate * 100).toFixed(1)}%`;
        document.getElementById('team-cover-rate').textContent = `${(teamData.statistics.coverRate * 100).toFixed(1)}%`;

        // Render team trend chart
        this.renderTeamTrendChart(teamData);

        // Render match history table
        this.renderMatchHistoryTable(teamData);
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

            row.innerHTML = `
                <td>${Analyzer.formatDateShort(match.date)}</td>
                <td class="team-name" data-team="${match.opponent}" style="cursor: pointer;">${match.opponent}</td>
                <td>${match.homeAway === 'home' ? 'H' : 'A'}</td>
                <td>${match.score}</td>
                <td class="${Analyzer.getResultClass(match.result)}">${match.result}</td>
                <td>${Analyzer.formatNetPerf(match.spread)}</td>
                <td class="${Analyzer.getNetPerfClass(match.netPerformance)}">${Analyzer.formatNetPerf(match.netPerformance)}</td>
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
