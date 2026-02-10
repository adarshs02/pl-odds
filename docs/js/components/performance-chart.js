/**
 * Performance Chart Component
 * Scatter plot: Cover Rate (%) vs Avg Net Performance per match
 */

import { Router } from '../router.js';
import { Analyzer } from '../analyzer.js';
import { TeamUtils } from '../team-utils.js';

export class PerformanceChart {
    constructor(containerId, data, sortBy = 'performance', filterBy = 'all', locationBy = 'all', bookmaker = 'consensus') {
        this.containerId = containerId;
        this.container = d3.select(`#${containerId}`);
        this.data = data;
        this.filterBy = filterBy;
        this.locationBy = locationBy;
        this.bookmaker = bookmaker;
        this.tooltip = null;

        this.init();
    }

    getResponsiveDimensions() {
        const containerWidth = this.container.node().clientWidth;
        const vw = window.innerWidth;

        if (vw < 640) {
            return {
                width: containerWidth,
                height: 300,
                margin: { top: 30, right: 20, bottom: 50, left: 55 },
                badgeSize: 16
            };
        } else if (vw < 1024) {
            return {
                width: containerWidth,
                height: 340,
                margin: { top: 35, right: 30, bottom: 55, left: 60 },
                badgeSize: 20
            };
        } else {
            return {
                width: containerWidth,
                height: 400,
                margin: { top: 40, right: 40, bottom: 60, left: 65 },
                badgeSize: 24
            };
        }
    }

    getTeams() {
        const filteredTeams = Analyzer.getFilteredTeams(this.data, this.filterBy, this.locationBy);

        return filteredTeams.map(team => {
            const coverRate = this.bookmaker === 'consensus' || !team.statistics.coverRateByBookmaker
                ? team.statistics.coverRate
                : (team.statistics.coverRateByBookmaker[this.bookmaker] ?? team.statistics.coverRate);

            const totalNetPerf = this.bookmaker === 'consensus' || !team.totalNetPerformanceByBookmaker
                ? team.totalNetPerformance
                : (team.totalNetPerformanceByBookmaker[this.bookmaker] ?? team.totalNetPerformance);

            const matchesPlayed = team.statistics.matchesPlayed;
            const avgNetPerf = matchesPlayed > 0 ? totalNetPerf / matchesPlayed : 0;

            return {
                name: team.name,
                xValue: coverRate * 100,
                yValue: avgNetPerf,
                totalNetPerformance: totalNetPerf,
                matchesPlayed,
                winRate: team.statistics.winRate,
                coverRate: coverRate
            };
        }).filter(t => t.matchesPlayed > 0);
    }

    init() {
        this.container.html('');

        const dims = this.getResponsiveDimensions();
        this.dims = dims;
        this.lastContainerWidth = dims.width;

        const teams = this.getTeams();
        this.updateSectionHeader();

        const plotW = dims.width - dims.margin.left - dims.margin.right;
        const plotH = dims.height - dims.margin.top - dims.margin.bottom;

        this.svg = this.container.append('svg')
            .attr('width', dims.width)
            .attr('height', dims.height)
            .append('g')
            .attr('transform', `translate(${dims.margin.left},${dims.margin.top})`);

        // X scale: Cover Rate (%)
        const xExtent = d3.extent(teams, d => d.xValue);
        const xPad = Math.max((xExtent[1] - xExtent[0]) * 0.12, 5);
        this.xScale = d3.scaleLinear()
            .domain([Math.min(xExtent[0] - xPad, 20), Math.max(xExtent[1] + xPad, 80)])
            .range([0, plotW]);

        // Y scale: Avg Net Performance per match
        const yExtent = d3.extent(teams, d => d.yValue);
        const yPad = Math.max((yExtent[1] - yExtent[0]) * 0.15, 0.3);
        this.yScale = d3.scaleLinear()
            .domain([yExtent[0] - yPad, yExtent[1] + yPad])
            .range([plotH, 0]);

        this.plotW = plotW;
        this.plotH = plotH;

        this.createTooltip();
        this.drawGridAndAxes();
        this.drawQuadrantLines();
        this.drawQuadrantLabels();
        this.drawTeamMarkers(teams);

        // Resize handler
        window.removeEventListener('resize', this.boundHandleResize);
        this.boundHandleResize = () => this.handleResize();
        window.addEventListener('resize', this.boundHandleResize);

        // Theme change handler
        window.removeEventListener('themechange', this.boundUpdateColors);
        this.boundUpdateColors = () => this.updateColors();
        window.addEventListener('themechange', this.boundUpdateColors);
    }

    updateSectionHeader() {
        const chartSection = document.querySelector('#performance-chart').closest('.chart-section');
        if (!chartSection) return;

        const description = chartSection.querySelector('.section-description');
        if (!description) return;

        let filterText = '';
        let locationText = '';

        switch (this.filterBy) {
            case 'last5': filterText = ' (Last 5 matches)'; break;
            case 'last10': filterText = ' (Last 10 matches)'; break;
            case 'season': filterText = ' (Current season)'; break;
        }

        switch (this.locationBy) {
            case 'home': locationText = ' - Home matches only'; break;
            case 'away': locationText = ' - Away matches only'; break;
        }

        description.innerHTML = `
            X-axis: Spread Cover Rate. Y-axis: Avg Net Performance per match.
            Top-right = consistent outperformers${filterText}${locationText}.
        `;
    }

    drawGridAndAxes() {
        const style = getComputedStyle(document.documentElement);
        const gridColor = style.getPropertyValue('--chart-grid').trim();
        const textColor = style.getPropertyValue('--chart-text').trim();

        // X grid lines
        this.svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${this.plotH})`)
            .call(d3.axisBottom(this.xScale)
                .ticks(6)
                .tickSize(-this.plotH)
                .tickFormat('')
            )
            .selectAll('line')
            .attr('stroke', gridColor)
            .attr('stroke-opacity', 0.2);

        // Y grid lines
        this.svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(this.yScale)
                .ticks(6)
                .tickSize(-this.plotW)
                .tickFormat('')
            )
            .selectAll('line')
            .attr('stroke', gridColor)
            .attr('stroke-opacity', 0.2);

        // X axis
        this.svg.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${this.plotH})`)
            .call(d3.axisBottom(this.xScale).ticks(6).tickFormat(d => d + '%'))
            .selectAll('text')
            .style('font-family', 'Barlow, sans-serif')
            .style('font-size', '11px')
            .attr('fill', textColor);

        // Y axis
        this.svg.append('g')
            .attr('class', 'axis y-axis')
            .call(d3.axisLeft(this.yScale).ticks(6).tickFormat(d => d > 0 ? '+' + d3.format('.1f')(d) : d3.format('.1f')(d)))
            .selectAll('text')
            .style('font-family', 'Barlow, sans-serif')
            .style('font-size', '11px')
            .attr('fill', textColor);

        // X axis label
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', this.plotW / 2)
            .attr('y', this.plotH + 42)
            .attr('text-anchor', 'middle')
            .attr('fill', textColor)
            .style('font-family', 'Barlow, sans-serif')
            .style('font-size', '12px')
            .style('font-weight', '600')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.06em')
            .text('Cover Rate (%)');

        // Y axis label
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.plotH / 2)
            .attr('y', -48)
            .attr('text-anchor', 'middle')
            .attr('fill', textColor)
            .style('font-family', 'Barlow, sans-serif')
            .style('font-size', '12px')
            .style('font-weight', '600')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.06em')
            .text('Avg Net Perf / Match');
    }

    drawQuadrantLines() {
        const style = getComputedStyle(document.documentElement);
        const gold = style.getPropertyValue('--accent-primary').trim();

        // Vertical line at 50% cover rate
        const x50 = this.xScale(50);
        if (x50 >= 0 && x50 <= this.plotW) {
            this.svg.append('line')
                .attr('class', 'quadrant-line')
                .attr('x1', x50).attr('x2', x50)
                .attr('y1', 0).attr('y2', this.plotH)
                .attr('stroke', gold)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '6,4')
                .attr('opacity', 0.5);
        }

        // Horizontal line at 0 avg net perf
        const y0 = this.yScale(0);
        if (y0 >= 0 && y0 <= this.plotH) {
            this.svg.append('line')
                .attr('class', 'quadrant-line')
                .attr('x1', 0).attr('x2', this.plotW)
                .attr('y1', y0).attr('y2', y0)
                .attr('stroke', gold)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '6,4')
                .attr('opacity', 0.5);
        }
    }

    drawQuadrantLabels() {
        const style = getComputedStyle(document.documentElement);
        const textColor = style.getPropertyValue('--text-tertiary').trim();
        const isMobile = window.innerWidth < 640;
        const fontSize = isMobile ? '9px' : '11px';

        const x50 = this.xScale(50);
        const y0 = this.yScale(0);
        const pad = 8;

        const labels = [
            { text: 'Overperformers', x: Math.min(x50 + pad, this.plotW - 90), y: Math.max(y0 - this.plotH * 0.02 + pad, pad + 12), anchor: 'start' },
            { text: 'Underperformers', x: Math.max(x50 - pad, 90), y: Math.min(y0 + pad + 14, this.plotH - pad), anchor: 'end' },
            { text: 'Boom or Bust', x: Math.max(x50 - pad, 80), y: Math.max(y0 - this.plotH * 0.02 + pad, pad + 12), anchor: 'end' },
            { text: 'Lucky Covers', x: Math.min(x50 + pad, this.plotW - 80), y: Math.min(y0 + pad + 14, this.plotH - pad), anchor: 'start' }
        ];

        labels.forEach((label, i) => {
            this.svg.append('text')
                .attr('class', 'quadrant-label')
                .attr('x', label.x)
                .attr('y', label.y)
                .attr('text-anchor', label.anchor)
                .attr('fill', textColor)
                .style('font-family', 'Barlow, sans-serif')
                .style('font-size', fontSize)
                .style('font-style', 'italic')
                .style('font-weight', '500')
                .attr('opacity', 0)
                .transition()
                .delay(800 + i * 100)
                .duration(400)
                .attr('opacity', 0.6);
        });
    }

    drawTeamMarkers(teams) {
        const badgeSize = this.dims.badgeSize;
        const half = badgeSize / 2;

        const markers = this.svg.selectAll('.team-marker')
            .data(teams)
            .enter()
            .append('g')
            .attr('class', 'team-marker')
            .attr('transform', d => `translate(${this.xScale(d.xValue)},${this.yScale(d.yValue)})`)
            .style('cursor', 'pointer')
            .attr('opacity', 0);

        // Badge image via foreignObject
        markers.append('foreignObject')
            .attr('x', -half)
            .attr('y', -half)
            .attr('width', badgeSize)
            .attr('height', badgeSize)
            .style('overflow', 'visible')
            .append('xhtml:img')
            .attr('src', d => TeamUtils.getLogoUrl(d.name))
            .style('width', badgeSize + 'px')
            .style('height', badgeSize + 'px')
            .style('object-fit', 'contain')
            .style('display', 'block');

        // Transparent hit area circle (larger than badge for easier hover)
        markers.append('circle')
            .attr('r', half + 4)
            .attr('fill', 'transparent')
            .attr('stroke', 'none');

        // Hover & click
        markers
            .on('mouseover', (event, d) => this.handleMouseOver(event, d))
            .on('mousemove', (event) => {
                this.tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mouseout', () => this.handleMouseOut())
            .on('click', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                Router.navigateToTeam(d.name);
            });

        // Staggered fade-in
        markers.transition()
            .duration(400)
            .delay((d, i) => 100 + i * 30)
            .ease(d3.easeCubicOut)
            .attr('opacity', 1);
    }

    createTooltip() {
        this.tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('opacity', 0);
    }

    handleMouseOver(event, d) {
        // Dim all other markers
        this.svg.selectAll('.team-marker')
            .transition().duration(150)
            .attr('opacity', m => m.name === d.name ? 1 : 0.3);

        this.tooltip
            .style('opacity', 1)
            .html(`
                <div class="tooltip-title">${TeamUtils.inlineLogo(d.name, 18)} ${d.name}</div>
                <div class="tooltip-content">
                    <strong>Cover Rate:</strong> ${d.xValue.toFixed(1)}%<br>
                    <strong>Avg Net Perf:</strong> ${d.yValue > 0 ? '+' : ''}${d.yValue.toFixed(2)} / match<br>
                    <strong>Total Net Perf:</strong> ${Analyzer.formatNetPerf(d.totalNetPerformance)}<br>
                    <strong>Matches:</strong> ${d.matchesPlayed}<br>
                    <strong>Win Rate:</strong> ${(d.winRate * 100).toFixed(1)}%<br>
                    <em style="color: var(--text-tertiary);">Click to view details</em>
                </div>
            `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px');
    }

    handleMouseOut() {
        // Restore all markers
        this.svg.selectAll('.team-marker')
            .transition().duration(150)
            .attr('opacity', 1);

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

    update(sortBy, filterBy, locationBy, bookmaker = 'consensus') {
        this.filterBy = filterBy;
        this.locationBy = locationBy;
        this.bookmaker = bookmaker;
        this.init();
    }

    updateColors() {
        this.init();
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
