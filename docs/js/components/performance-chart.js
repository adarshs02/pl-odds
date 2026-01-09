/**
 * Performance Chart Component
 * Interactive horizontal bar chart using D3.js
 */

import { Router } from '../router.js';
import { Analyzer } from '../analyzer.js';

export class PerformanceChart {
    constructor(containerId, data, sortBy = 'performance', filterBy = 'all') {
        this.containerId = containerId;
        this.container = d3.select(`#${containerId}`);
        this.data = data;
        this.sortBy = sortBy;
        this.filterBy = filterBy;
        this.margin = { top: 20, right: 80, bottom: 40, left: 140 };
        this.tooltip = null;

        this.init();
    }

    init() {
        // Clear existing content
        this.container.html('');

        // Sort teams
        const teams = this.sortTeams();

        // Update section header if it exists
        this.updateSectionHeader(teams);

        // Calculate dimensions
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth;
        const barHeight = 30;
        const barGap = 10;
        const chartHeight = teams.length * (barHeight + barGap) + this.margin.top + this.margin.bottom;

        this.width = containerWidth - this.margin.left - this.margin.right;
        this.height = chartHeight - this.margin.top - this.margin.bottom;

        // Create SVG
        this.svg = this.container.append('svg')
            .attr('width', containerWidth)
            .attr('height', chartHeight)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // Create scales
        const maxValue = d3.max(teams, d => Math.abs(d.totalNetPerformance));
        this.xScale = d3.scaleLinear()
            .domain([-maxValue * 1.1, maxValue * 1.1])
            .range([0, this.width]);

        this.yScale = d3.scaleBand()
            .domain(teams.map(d => d.name))
            .range([0, this.height])
            .padding(0.3);

        // Create tooltip
        this.createTooltip();

        // Draw chart elements
        this.drawAxes();
        this.drawBars(teams);

        // Setup resize handler
        window.addEventListener('resize', () => this.handleResize());

        // Listen for theme changes to update colors
        window.addEventListener('themechange', () => this.updateColors());
    }

    sortTeams() {
        // First apply filter
        const filteredTeams = Analyzer.getFilteredTeams(this.data, this.filterBy);

        // Create temporary data object with filtered teams
        const tempData = {
            ...this.data,
            performance: {
                ...this.data.performance,
                teams: filteredTeams
            }
        };

        // Then sort
        if (this.sortBy === 'alphabetical') {
            return Analyzer.getTeamsSortedAlphabetically(tempData);
        }
        return Analyzer.getTeamsSortedByPerformance(tempData);
    }

    updateSectionHeader(teams) {
        // Find the chart section and update description
        const chartSection = document.querySelector('#performance-chart').closest('.chart-section');
        if (!chartSection) return;

        const description = chartSection.querySelector('.section-description');
        if (!description) return;

        let filterText = '';
        let matchCount = 0;

        if (teams.length > 0) {
            matchCount = teams[0].statistics.matchesPlayed;
        }

        switch (this.filterBy) {
            case 'last5':
                filterText = ` (Last 5 matches)`;
                break;
            case 'last10':
                filterText = ` (Last 10 matches)`;
                break;
            case 'season':
                filterText = ` (Current season)`;
                break;
            case 'all':
            default:
                filterText = '';
        }

        description.innerHTML = `
            Net Performance = (Actual Goal Difference) - (Spread Line).
            Positive values indicate outperformance against betting expectations${filterText}.
        `;
    }

    drawAxes() {
        // X axis (bottom)
        const xAxis = d3.axisBottom(this.xScale)
            .ticks(6)
            .tickFormat(d => d.toFixed(1));

        this.svg.append('g')
            .attr('class', 'x-axis axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(xAxis);

        // Y axis (left)
        const yAxis = d3.axisLeft(this.yScale);

        this.svg.append('g')
            .attr('class', 'y-axis axis')
            .call(yAxis);

        // Zero line
        this.svg.append('line')
            .attr('class', 'zero-line')
            .attr('x1', this.xScale(0))
            .attr('x2', this.xScale(0))
            .attr('y1', 0)
            .attr('y2', this.height)
            .attr('stroke', Analyzer.getPerformanceColor(0))
            .attr('stroke-width', 2)
            .attr('opacity', 0.5);

        // Grid lines
        this.svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisBottom(this.xScale)
                .ticks(6)
                .tickSize(-this.height)
                .tickFormat('')
            );
    }

    drawBars(teams) {
        const bars = this.svg.selectAll('.bar')
            .data(teams)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => d.totalNetPerformance >= 0 ? this.xScale(0) : this.xScale(d.totalNetPerformance))
            .attr('y', d => this.yScale(d.name))
            .attr('width', 0)
            .attr('height', this.yScale.bandwidth())
            .attr('fill', d => Analyzer.getPerformanceColor(d.totalNetPerformance))
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => this.handleMouseOver(event, d))
            .on('mouseout', () => this.handleMouseOut())
            .on('click', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                Router.navigateToTeam(d.name);
            });

        // Animate bars
        bars.transition()
            .duration(800)
            .ease(d3.easeElastic)
            .attr('width', d => Math.abs(this.xScale(d.totalNetPerformance) - this.xScale(0)));

        // Add value labels
        this.svg.selectAll('.label')
            .data(teams)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('x', d => {
                const barEnd = d.totalNetPerformance >= 0
                    ? this.xScale(d.totalNetPerformance)
                    : this.xScale(d.totalNetPerformance);
                const barWidth = Math.abs(this.xScale(d.totalNetPerformance) - this.xScale(0));

                // If bar is too small, put label outside
                if (barWidth < 40) {
                    return barEnd + (d.totalNetPerformance >= 0 ? 8 : -8);
                }
                // Otherwise, put label inside the bar
                return barEnd - (d.totalNetPerformance >= 0 ? 5 : -5);
            })
            .attr('y', d => this.yScale(d.name) + this.yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => {
                const barWidth = Math.abs(this.xScale(d.totalNetPerformance) - this.xScale(0));
                if (barWidth < 40) {
                    return d.totalNetPerformance >= 0 ? 'start' : 'end';
                }
                return d.totalNetPerformance >= 0 ? 'end' : 'start';
            })
            .attr('fill', d => {
                const barWidth = Math.abs(this.xScale(d.totalNetPerformance) - this.xScale(0));
                return barWidth < 40 ? 'var(--text-secondary)' : 'var(--bg-primary)';
            })
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .attr('opacity', 0)
            .text(d => Analyzer.formatNetPerf(d.totalNetPerformance))
            .transition()
            .delay(800)
            .duration(300)
            .attr('opacity', 1);
    }

    createTooltip() {
        this.tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('opacity', 0);
    }

    handleMouseOver(event, d) {
        this.tooltip
            .style('opacity', 1)
            .html(`
                <div class="tooltip-title">${d.name}</div>
                <div class="tooltip-content">
                    <strong>Net Performance:</strong> ${Analyzer.formatNetPerf(d.totalNetPerformance)}<br>
                    <strong>Matches:</strong> ${d.statistics.matchesPlayed}<br>
                    <strong>Win Rate:</strong> ${(d.statistics.winRate * 100).toFixed(1)}%<br>
                    <strong>Cover Rate:</strong> ${(d.statistics.coverRate * 100).toFixed(1)}%<br>
                    <em>Click to view details</em>
                </div>
            `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px');
    }

    handleMouseOut() {
        this.tooltip.style('opacity', 0);
    }

    handleResize() {
        // Simple approach: rebuild the chart
        // For production, you'd optimize this
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.init();
        }, 250);
    }

    updateSort(sortBy) {
        this.sortBy = sortBy;
        this.init();
    }

    updateFilter(filterBy) {
        this.filterBy = filterBy;
        this.init();
    }

    update(sortBy, filterBy) {
        this.sortBy = sortBy;
        this.filterBy = filterBy;
        this.init();
    }

    updateColors() {
        // Update bar colors when theme changes
        d3.selectAll('.bar')
            .attr('fill', d => Analyzer.getPerformanceColor(d.totalNetPerformance));
    }

    destroy() {
        if (this.tooltip) {
            this.tooltip.remove();
        }
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('themechange', this.updateColors);
    }
}
