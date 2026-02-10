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

            // Setup scroll listener for header
            this.setupScrollListener();

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

    setupScrollListener() {
        const header = document.getElementById('site-header');
        if (!header) return;

        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    updateStats() {
        document.getElementById('stat-matches').textContent = this.data.performance.totalMatches || 0;
        document.getElementById('stat-teams').textContent = this.data.performance.teamsTracked || 0;
        document.getElementById('stat-correlation').textContent = this.data.performance.correlation?.toFixed(3) || 'N/A';
        document.getElementById('stat-upcoming').textContent = this.data.odds.totalMatches || 0;

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
        const filterSelect = document.getElementById('chart-filter');
        const locationSelect = document.getElementById('chart-location');
        const bookmakerSelect = document.getElementById('chart-bookmaker');

        // Populate bookmaker dropdown
        if (bookmakerSelect) {
            const bookmakers = Analyzer.getAvailableBookmakers(this.data);
            while (bookmakerSelect.options.length > 1) {
                bookmakerSelect.remove(1);
            }
            bookmakers.forEach(bk => {
                const option = document.createElement('option');
                option.value = bk;
                option.textContent = Analyzer.formatBookmakerName(bk);
                bookmakerSelect.appendChild(option);
            });
        }

        const updateChart = () => {
            const filterBy = filterSelect ? filterSelect.value : 'all';
            const locationBy = locationSelect ? locationSelect.value : 'all';
            const bookmaker = bookmakerSelect ? bookmakerSelect.value : 'consensus';
            this.performanceChart.update(null, filterBy, locationBy, bookmaker);
        };

        if (filterSelect) {
            filterSelect.addEventListener('change', updateChart);
        }

        if (locationSelect) {
            locationSelect.addEventListener('change', updateChart);
        }

        if (bookmakerSelect) {
            bookmakerSelect.addEventListener('change', updateChart);
        }

        // Render upcoming matches strip
        this.renderUpcomingStrip();

        // Render historical trends (top 5 teams)
        this.renderHistoricalTrends();
    }

    renderUpcomingStrip() {
        const container = document.getElementById('upcoming-matches-strip');
        if (!container) return;

        container.innerHTML = '';

        const matches = DataLoader.getUpcomingMatches(this.data);

        if (matches.length === 0) {
            container.innerHTML = '<span class="upcoming-empty">No upcoming matches</span>';
            return;
        }

        matches.forEach(match => {
            const capsule = document.createElement('div');
            capsule.className = 'upcoming-capsule';

            const date = document.createElement('span');
            date.className = 'upcoming-date';
            date.textContent = Analyzer.formatDateShort(match.commenceTime);

            const matchEl = document.createElement('span');
            matchEl.className = 'upcoming-match';

            const homeTeam = document.createElement('span');
            homeTeam.className = 'team-name';
            homeTeam.innerHTML = TeamUtils.inlineLogo(match.homeTeam, 14) + match.homeTeam;
            homeTeam.dataset.team = match.homeTeam;

            const vs = document.createElement('span');
            vs.className = 'vs-text';
            vs.textContent = 'v';

            const awayTeam = document.createElement('span');
            awayTeam.className = 'team-name';
            awayTeam.innerHTML = TeamUtils.inlineLogo(match.awayTeam, 14) + match.awayTeam;
            awayTeam.dataset.team = match.awayTeam;

            matchEl.appendChild(homeTeam);
            matchEl.appendChild(vs);
            matchEl.appendChild(awayTeam);

            capsule.appendChild(date);
            capsule.appendChild(matchEl);
            container.appendChild(capsule);
        });

        // Add click handlers for team names
        container.querySelectorAll('.team-name').forEach(el => {
            el.addEventListener('click', () => {
                Router.navigateToTeam(el.dataset.team);
            });
        });
    }

    renderHistoricalTrends() {
        const allTeams = Analyzer.getTeamsSortedByPerformance(this.data, true);

        if (this._historicalTrendTooltip) {
            this._historicalTrendTooltip.remove();
            this._historicalTrendTooltip = null;
        }

        const container = d3.select('#historical-trends');
        container.html('');

        if (allTeams.length === 0) {
            container.append('p')
                .style('text-align', 'center')
                .style('padding', '2rem')
                .text('No data available');
            return;
        }

        // Dimensions
        const containerNode = container.node();
        const containerWidth = containerNode.clientWidth;
        const isMobile = window.innerWidth < 640;
        const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
        const containerHeight = isMobile ? 280 : (isTablet ? 320 : 360);
        const badgeSize = isMobile ? 14 : (isTablet ? 16 : 18);
        // Right margin holds badges outside the plot box
        const margin = { top: 15, right: badgeSize + 12, bottom: 30, left: 40 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        // Create SVG
        const svg = container.append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight)
            .style('overflow', 'visible')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Build line data with gameweek index
        const linesData = allTeams.map(team => ({
            name: team.name,
            color: TeamUtils.getColor(team.name),
            values: team.matchHistory.map((m, i) => ({
                gw: i + 1,
                value: m.cumulativeNetPerformance
            }))
        })).filter(d => d.values.length > 0);

        // Scales
        const maxGW = d3.max(linesData, d => d.values.length);
        const allValues = linesData.flatMap(d => d.values.map(v => v.value));

        const xScale = d3.scaleLinear()
            .domain([1, maxGW])
            .range([0, width]);

        const yMin = d3.min(allValues);
        const yMax = d3.max(allValues);
        const yPad = Math.max((yMax - yMin) * 0.25, 3);
        const yScale = d3.scaleLinear()
            .domain([yMin - yPad, yMax + yPad])
            .range([height, 0])
            .nice();

        const style = getComputedStyle(document.documentElement);
        const gridColor = style.getPropertyValue('--chart-grid').trim();
        const borderColor = style.getPropertyValue('--border-color').trim();
        const textColor = style.getPropertyValue('--chart-text').trim();

        // Plot area border (closed box)
        svg.append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', width).attr('height', height)
            .attr('fill', 'none')
            .attr('stroke', borderColor)
            .attr('stroke-width', 1);

        // Y grid lines
        svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(''))
            .selectAll('line')
            .attr('stroke', gridColor)
            .attr('stroke-opacity', 0.15);

        // Y-axis ticks
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).ticks(5));

        // X-axis: gameweek numbers at bottom
        const gwTicks = Math.min(maxGW, isMobile ? 6 : (isTablet ? 10 : 15));
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale)
                .ticks(gwTicks)
                .tickFormat(d => `GW${Math.round(d)}`)
            )
            .selectAll('text')
            .style('font-size', isMobile ? '9px' : '10px');

        // Zero line
        const y0 = yScale(0);
        if (y0 > 0 && y0 < height) {
            const gold = style.getPropertyValue('--accent-primary').trim();
            svg.append('line')
                .attr('x1', 0).attr('x2', width)
                .attr('y1', y0).attr('y2', y0)
                .attr('stroke', gold)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '6,4')
                .attr('opacity', 0.4)
                .style('pointer-events', 'none');
        }

        // Line generator (gameweek on X)
        const line = d3.line()
            .x(d => xScale(d.gw))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        // Team groups (lines clipped, badges outside box in right margin)
        const teamGroups = svg.selectAll('.trend-team')
            .data(linesData)
            .enter()
            .append('g')
            .attr('class', 'trend-team')
            .style('cursor', 'pointer');

        // Lines (clipped to box via clipPath on a sub-group)
        const linesGroup = svg.append('g')
            .attr('clip-path', 'url(#trend-clip-lines)');

        svg.append('defs').append('clipPath')
            .attr('id', 'trend-clip-lines')
            .append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', width).attr('height', height);

        // Re-select team groups into the clipped lines area
        const lineTeamGroups = linesGroup.selectAll('.trend-line-group')
            .data(linesData)
            .enter()
            .append('g')
            .attr('class', 'trend-line-group');

        lineTeamGroups.append('path')
            .attr('class', 'trend-line')
            .attr('fill', 'none')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1.2)
            .attr('stroke-opacity', 0.45)
            .attr('d', d => line(d.values));

        // Badges outside the box in the right margin
        const halfBadge = badgeSize / 2;
        teamGroups.each(function(d) {
            const lastPoint = d.values[d.values.length - 1];
            if (!lastPoint) return;

            const g = d3.select(this);
            const bx = width + 4;
            const by = yScale(lastPoint.value);
            const logoUrl = TeamUtils.getLogoUrl(d.name);

            if (logoUrl) {
                g.append('foreignObject')
                    .attr('class', 'trend-badge')
                    .attr('x', bx)
                    .attr('y', by - halfBadge)
                    .attr('width', badgeSize)
                    .attr('height', badgeSize)
                    .style('overflow', 'visible')
                    .append('xhtml:img')
                    .attr('src', logoUrl)
                    .style('width', badgeSize + 'px')
                    .style('height', badgeSize + 'px')
                    .style('object-fit', 'contain')
                    .style('display', 'block');
            }

            // Transparent hit area covers line + badge
            g.append('rect')
                .attr('x', 0).attr('y', by - halfBadge - 2)
                .attr('width', bx + badgeSize)
                .attr('height', badgeSize + 4)
                .attr('fill', 'transparent');
        });

        // Create tooltip for this chart
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip historical-trend-tooltip')
            .style('position', 'absolute')
            .style('opacity', 0);

        // Hover: highlight one team, dim others (across both badge + line groups)
        teamGroups
            .on('mouseover', function(event, d) {
                teamGroups.transition().duration(150)
                    .style('opacity', g => g.name === d.name ? 1 : 0.1);
                lineTeamGroups.transition().duration(150)
                    .style('opacity', g => g.name === d.name ? 1 : 0.1);
                lineTeamGroups.filter(g => g.name === d.name).select('.trend-line')
                    .attr('stroke-width', 2.5)
                    .attr('stroke-opacity', 1);

                const lastPoint = d.values[d.values.length - 1];
                tooltip.style('opacity', 1)
                    .html(`
                        <div class="tooltip-title">${TeamUtils.inlineLogo(d.name, 18)} ${d.name}</div>
                        <div class="tooltip-content">
                            <strong>Cumulative Net Perf:</strong> ${Analyzer.formatNetPerf(lastPoint.value)}<br>
                            <strong>Matches:</strong> ${d.values.length}
                        </div>
                    `)
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mousemove', function(event) {
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mouseout', function() {
                teamGroups.transition().duration(150)
                    .style('opacity', 1);
                lineTeamGroups.transition().duration(150)
                    .style('opacity', 1);
                lineTeamGroups.selectAll('.trend-line')
                    .attr('stroke-width', 1.2)
                    .attr('stroke-opacity', 0.45);

                tooltip.style('opacity', 0);
            })
            .on('click', function(event, d) {
                event.preventDefault();
                Router.navigateToTeam(d.name);
            });

        // Store tooltip ref for cleanup
        this._historicalTrendTooltip = tooltip;
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

        const coversByBk = teamData.statistics.coversByBookmaker || {};
        const coverRateByBk = teamData.statistics.coverRateByBookmaker || {};
        const totalPerfByBk = teamData.totalNetPerformanceByBookmaker || {};

        const bookmakers = Object.keys(coversByBk);

        if (bookmakers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1rem;">No per-bookmaker data available yet</td></tr>';
            return;
        }

        bookmakers.sort((a, b) => (totalPerfByBk[b] || 0) - (totalPerfByBk[a] || 0));

        bookmakers.forEach(bk => {
            const netPerf = totalPerfByBk[bk] || 0;
            const coverRate = coverRateByBk[bk] || 0;
            const covers = coversByBk[bk] || 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight: 500;">${Analyzer.formatBookmakerName(bk)}</td>
                <td class="${Analyzer.getNetPerfClass(netPerf)}" style="font-variant-numeric: tabular-nums;">
                    ${Analyzer.formatNetPerf(netPerf)}
                </td>
                <td style="font-variant-numeric: tabular-nums;">${(coverRate * 100).toFixed(1)}%</td>
                <td style="text-align: center;">${covers} covers</td>
            `;
            tbody.appendChild(row);
        });
    }

    renderHomeAwayBreakdown(teamData) {
        const homeMatches = teamData.matchHistory.filter(m => m.homeAway === 'home');
        const awayMatches = teamData.matchHistory.filter(m => m.homeAway === 'away');

        const homeNetPerf = homeMatches.reduce((sum, m) => sum + m.netPerformance, 0);
        const homeWins = homeMatches.filter(m => m.result === 'W').length;
        const homeCovers = homeMatches.filter(m => m.netPerformance > 0).length;

        const awayNetPerf = awayMatches.reduce((sum, m) => sum + m.netPerformance, 0);
        const awayWins = awayMatches.filter(m => m.result === 'W').length;
        const awayCovers = awayMatches.filter(m => m.netPerformance > 0).length;

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
        const resultsPieChart = new PieChart('results-pie-chart', {
            wins: teamData.statistics.wins,
            draws: teamData.statistics.draws,
            losses: teamData.statistics.losses
        }, 'results');

        const coversPieChart = new PieChart('covers-pie-chart', {
            covers: teamData.statistics.covers,
            matchesPlayed: teamData.statistics.matchesPlayed
        }, 'covers');
    }

    renderTeamTrendChart(teamData) {
        const container = d3.select('#team-trend-chart');
        container.html('');

        const containerNode = container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = 300;
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const data = teamData.matchHistory.map(m => ({
            date: new Date(m.date),
            value: m.cumulativeNetPerformance
        }));

        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => d.date))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(data, d => d.value) * 1.1, d3.max(data, d => d.value) * 1.1])
            .range([height, 0]);

        // Minimal y-axis only (4 ticks)
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).ticks(4));

        // Area fill — very subtle
        const area = d3.area()
            .x(d => xScale(d.date))
            .y0(height)
            .y1(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(data)
            .attr('fill', Analyzer.getPerformanceColor(teamData.totalNetPerformance))
            .attr('opacity', 0.08)
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
            .attr('stroke-width', 1.5)
            .attr('d', line);

        // Dot markers
        svg.selectAll('.trend-dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'trend-dot')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.value))
            .attr('r', 2.5)
            .attr('fill', Analyzer.getPerformanceColor(teamData.totalNetPerformance));

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

        const matches = [...teamData.matchHistory].reverse();

        matches.forEach(match => {
            const row = document.createElement('tr');

            const [teamScore, oppScore] = match.score.split('-').map(s => parseInt(s.trim()));
            const actualMargin = teamScore - oppScore;
            const expectedMargin = -match.spread;
            const beatSpread = match.netPerformance > 0;

            row.innerHTML = `
                <td style="white-space: nowrap;">${Analyzer.formatDateShort(match.date)}</td>
                <td class="team-name" data-team="${match.opponent}" style="cursor: pointer; white-space: nowrap;">
                    ${TeamUtils.inlineLogo(match.opponent)} ${match.opponent}
                </td>
                <td style="text-align: center; text-transform: uppercase; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.04em; color: var(--text-secondary);">
                    ${match.homeAway === 'home' ? 'H' : 'A'}
                </td>
                <td style="font-weight: 500; font-variant-numeric: tabular-nums;">${match.score}</td>
                <td class="${Analyzer.getResultClass(match.result)}">
                    ${match.result === 'W' ? 'Win' : match.result === 'L' ? 'Loss' : 'Draw'}
                </td>
                <td style="font-variant-numeric: tabular-nums;">
                    ${Analyzer.formatNetPerf(expectedMargin)}
                    <span style="color: var(--text-tertiary); font-size: 0.8125rem;"> (${Analyzer.formatNetPerf(match.spread)})</span>
                </td>
                <td style="font-weight: 500; font-variant-numeric: tabular-nums;">
                    ${Analyzer.formatNetPerf(actualMargin)}
                </td>
                <td class="${Analyzer.getNetPerfClass(match.netPerformance)}" style="font-variant-numeric: tabular-nums;">
                    ${Analyzer.formatNetPerf(match.netPerformance)}
                </td>
                <td style="text-align: center; font-size: 0.8125rem; font-weight: 500; color: ${beatSpread ? 'var(--accent-positive)' : 'var(--accent-negative)'};">
                    ${beatSpread ? 'YES' : 'NO'}
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
