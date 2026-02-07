/**
 * Performance Chart Component
 * Interactive horizontal bar chart using D3.js
 */

import { Router } from '../router.js';
import { Analyzer } from '../analyzer.js';

export class PerformanceChart {
    constructor(containerId, data, sortBy = 'performance', filterBy = 'all', locationBy = 'all', bookmaker = 'consensus') {
        this.containerId = containerId;
        this.container = d3.select(`#${containerId}`);
        this.data = data;
        this.sortBy = sortBy;
        this.filterBy = filterBy;
        this.locationBy = locationBy;
        this.bookmaker = bookmaker;
        this.tooltip = null;

        this.init();
    }

    getResponsiveMargins() {
        const width = window.innerWidth;
        if (width < 640) {
            return { top: 10, right: 10, bottom: 10, left: 100 };
        } else if (width < 1024) {
            return { top: 10, right: 40, bottom: 10, left: 140 };
        } else {
            return { top: 10, right: 80, bottom: 10, left: 220 };
        }
    }

    init() {
        // Clear existing content
        this.container.html('');

        // Get responsive margins
        this.margin = this.getResponsiveMargins();

        // Sort teams
        const teams = this.sortTeams();

        // Update section header if it exists
        this.updateSectionHeader(teams);

        // Calculate dimensions
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth;
        const barHeight = 24;
        const barGap = 8;
        const chartHeight = teams.length * (barHeight + barGap) + this.margin.top + this.margin.bottom;

        // Store the current container width for resize comparison
        this.lastContainerWidth = containerWidth;

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

        // Setup resize handler (remove existing first to avoid duplicates)
        window.removeEventListener('resize', this.boundHandleResize);
        this.boundHandleResize = () => this.handleResize();
        window.addEventListener('resize', this.boundHandleResize);

        // Listen for theme changes to update colors
        window.removeEventListener('themechange', this.boundUpdateColors);
        this.boundUpdateColors = () => this.updateColors();
        window.addEventListener('themechange', this.boundUpdateColors);
    }

    sortTeams() {
        // First apply filter (with location filter)
        const filteredTeams = Analyzer.getFilteredTeams(this.data, this.filterBy, this.locationBy);

        // Apply bookmaker-specific performance values if not consensus
        const teamsWithBookmaker = filteredTeams.map(team => {
            if (this.bookmaker === 'consensus' || !team.totalNetPerformanceByBookmaker) {
                return team;
            }
            const bkPerf = team.totalNetPerformanceByBookmaker[this.bookmaker];
            if (bkPerf !== undefined) {
                return {
                    ...team,
                    totalNetPerformance: bkPerf
                };
            }
            return team;
        });

        // Create temporary data object with modified teams
        const tempData = {
            ...this.data,
            performance: {
                ...this.data.performance,
                teams: teamsWithBookmaker
            }
        };

        // Then sort
        if (this.sortBy === 'alphabetical') {
            return Analyzer.getTeamsSortedAlphabetically(tempData);
        }
        return Analyzer.getTeamsSortedByPerformance(tempData);
    }

    updateSectionHeader(teams) {
        const chartSection = document.querySelector('#performance-chart').closest('.chart-section');
        if (!chartSection) return;

        const description = chartSection.querySelector('.section-description');
        if (!description) return;

        let filterText = '';
        let locationText = '';

        switch (this.filterBy) {
            case 'last5':
                filterText = ' (Last 5 matches)';
                break;
            case 'last10':
                filterText = ' (Last 10 matches)';
                break;
            case 'season':
                filterText = ' (Current season)';
                break;
        }

        switch (this.locationBy) {
            case 'home':
                locationText = ' - Home matches only';
                break;
            case 'away':
                locationText = ' - Away matches only';
                break;
        }

        description.innerHTML = `
            Net Performance = (Actual Goal Difference) + (Spread).
            Positive values indicate outperformance against betting expectations${filterText}${locationText}.
        `;
    }

    drawAxes() {
        const isMobile = window.innerWidth < 640;
        const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;

        // Y axis (left) — team names only
        const yAxis = d3.axisLeft(this.yScale);

        this.svg.append('g')
            .attr('class', 'y-axis axis')
            .call(yAxis)
            .selectAll('text')
            .style('font-size', isMobile ? '10px' : (isTablet ? '11px' : '12px'))
            .style('font-family', 'DM Sans, sans-serif');

        // Zero line — subtle
        this.svg.append('line')
            .attr('class', 'zero-line')
            .attr('x1', this.xScale(0))
            .attr('x2', this.xScale(0))
            .attr('y1', 0)
            .attr('y2', this.height)
            .attr('stroke', 'var(--chart-grid)')
            .attr('stroke-width', 1)
            .attr('opacity', 0.3);
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
            .attr('rx', 2)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => this.handleMouseOver(event, d))
            .on('mouseout', () => this.handleMouseOut())
            .on('click', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                Router.navigateToTeam(d.name);
            });

        // Animate bars with stagger
        bars.transition()
            .duration(600)
            .delay((d, i) => i * 30)
            .ease(d3.easeCubicOut)
            .attr('width', d => Math.abs(this.xScale(d.totalNetPerformance) - this.xScale(0)));

        // Add value labels — always outside bar
        this.svg.selectAll('.label')
            .data(teams)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('x', d => {
                if (d.totalNetPerformance >= 0) {
                    return this.xScale(d.totalNetPerformance) + 8;
                } else {
                    return this.xScale(d.totalNetPerformance) - 8;
                }
            })
            .attr('y', d => this.yScale(d.name) + this.yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => d.totalNetPerformance >= 0 ? 'start' : 'end')
            .attr('fill', 'var(--text-secondary)')
            .attr('font-family', 'DM Sans, sans-serif')
            .attr('font-size', '0.75rem')
            .attr('font-weight', '500')
            .attr('opacity', 0)
            .text(d => Analyzer.formatNetPerf(d.totalNetPerformance))
            .transition()
            .delay((d, i) => 600 + i * 30)
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
                    <em style="color: var(--text-tertiary);">Click to view details</em>
                </div>
            `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px');
    }

    handleMouseOut() {
        this.tooltip.style('opacity', 0);
    }

    handleResize() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            const containerNode = this.container.node();
            if (!containerNode) return;

            const currentWidth = containerNode.clientWidth;
            if (Math.abs(currentWidth - (this.lastContainerWidth || 0)) > 10) {
                this.init();
            }
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

    updateLocation(locationBy) {
        this.locationBy = locationBy;
        this.init();
    }

    update(sortBy, filterBy, locationBy, bookmaker = 'consensus') {
        this.sortBy = sortBy;
        this.filterBy = filterBy;
        this.locationBy = locationBy;
        this.bookmaker = bookmaker;
        this.init();
    }

    updateBookmaker(bookmaker) {
        this.bookmaker = bookmaker;
        this.init();
    }

    updateColors() {
        d3.selectAll('.bar')
            .attr('fill', d => Analyzer.getPerformanceColor(d.totalNetPerformance));
    }

    destroy() {
        if (this.tooltip) {
            this.tooltip.remove();
        }
        if (this.boundHandleResize) {
            window.removeEventListener('resize', this.boundHandleResize);
        }
        if (this.boundUpdateColors) {
            window.removeEventListener('themechange', this.boundUpdateColors);
        }
        clearTimeout(this.resizeTimer);
    }
}
