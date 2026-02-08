/**
 * Donut Chart Component
 * Visualizes win/loss/draw or cover/no-cover distributions as donut charts
 */

export class PieChart {
    constructor(containerId, data, type = 'results') {
        this.containerId = containerId;
        this.container = d3.select(`#${containerId}`);
        this.data = data;
        this.type = type; // 'results' or 'covers'
        this.margin = { top: 20, right: 20, bottom: 60, left: 20 };

        this.init();
    }

    init() {
        // Clear existing content
        this.container.html('');

        // Calculate dimensions
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = 280;

        const width = containerWidth - this.margin.left - this.margin.right;
        const height = containerHeight - this.margin.top - this.margin.bottom;
        const radius = Math.min(width, height) / 2;
        const innerRadius = radius * 0.6;

        // Create SVG
        const svg = this.container.append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight);

        const g = svg.append('g')
            .attr('transform', `translate(${containerWidth / 2},${(containerHeight - this.margin.bottom + this.margin.top) / 2})`);

        // Prepare data based on type
        let pieData;
        let totalCount;
        if (this.type === 'results') {
            pieData = [
                { label: 'Wins', value: this.data.wins, color: '--accent-positive' },
                { label: 'Draws', value: this.data.draws, color: '--accent-neutral' },
                { label: 'Losses', value: this.data.losses, color: '--accent-negative' }
            ];
            totalCount = this.data.wins + this.data.draws + this.data.losses;
        } else if (this.type === 'covers') {
            const covers = this.data.covers;
            const nonCovers = this.data.matchesPlayed - covers;
            pieData = [
                { label: 'Covers', value: covers, color: '--accent-positive' },
                { label: 'No Cover', value: nonCovers, color: '--accent-negative' }
            ];
            totalCount = this.data.matchesPlayed;
        }

        // Filter out zero values
        pieData = pieData.filter(d => d.value > 0);

        // Create pie layout
        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        // Create arc generator — donut with innerRadius
        const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(radius - 10);

        // Get computed colors
        const getColor = (color) => {
            const style = getComputedStyle(document.documentElement);
            return style.getPropertyValue(color).trim();
        };

        // Draw donut slices with opacity fade animation
        const slices = g.selectAll('.arc')
            .data(pie(pieData))
            .enter()
            .append('g')
            .attr('class', 'arc');

        slices.append('path')
            .attr('d', arc)
            .attr('fill', d => getColor(d.data.color))
            .attr('stroke', 'var(--bg-primary)')
            .attr('stroke-width', 2)
            .style('opacity', 0)
            .transition()
            .duration(400)
            .style('opacity', 1);

        // Center text — total count
        g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '-0.1em')
            .attr('fill', getColor('--text-primary'))
            .attr('font-family', 'Big Shoulders Display, sans-serif')
            .attr('font-size', '2.5rem')
            .attr('font-weight', '800')
            .attr('letter-spacing', '0.02em')
            .text(totalCount);

        // Center label — "matches"
        g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '1.5em')
            .attr('fill', getColor('--text-tertiary'))
            .attr('font-family', 'Barlow, sans-serif')
            .attr('font-size', '0.6875rem')
            .attr('font-weight', '700')
            .attr('text-transform', 'uppercase')
            .attr('letter-spacing', '0.1em')
            .text('MATCHES');

        // Horizontal legend below donut
        const legendY = (containerHeight - this.margin.bottom + this.margin.top) / 2 + radius + 16;
        const legend = svg.append('g')
            .attr('class', 'legend');

        // Calculate total width of legend items to center them
        const legendItems = pieData.map(d => {
            const text = `${d.label}: ${d.value}`;
            return { ...d, text };
        });

        const itemSpacing = 20;
        const circleRadius = 4;
        const textOffset = circleRadius * 2 + 6;

        // Create a temp text to measure
        const tempText = svg.append('text')
            .attr('font-family', 'Barlow, sans-serif')
            .attr('font-size', '12px')
            .style('visibility', 'hidden');

        let totalLegendWidth = 0;
        const itemWidths = legendItems.map(item => {
            tempText.text(item.text);
            const w = tempText.node().getComputedTextLength() + textOffset;
            totalLegendWidth += w;
            return w;
        });
        totalLegendWidth += (legendItems.length - 1) * itemSpacing;
        tempText.remove();

        let currentX = containerWidth / 2 - totalLegendWidth / 2;

        legendItems.forEach((item, i) => {
            const itemG = legend.append('g')
                .attr('transform', `translate(${currentX}, ${legendY})`);

            itemG.append('circle')
                .attr('cx', circleRadius)
                .attr('cy', 0)
                .attr('r', circleRadius)
                .attr('fill', getColor(item.color));

            itemG.append('text')
                .attr('x', textOffset)
                .attr('y', 0)
                .attr('dy', '0.35em')
                .attr('fill', getColor('--text-secondary'))
                .attr('font-family', 'Barlow, sans-serif')
                .attr('font-size', '12px')
                .text(item.text);

            currentX += itemWidths[i] + itemSpacing;
        });

        // Setup resize handler (remove existing first to avoid duplicates)
        if (this.boundHandleResize) {
            window.removeEventListener('resize', this.boundHandleResize);
        }
        this.boundHandleResize = () => this.handleResize();
        window.addEventListener('resize', this.boundHandleResize);

        // Listen for theme changes
        if (this.boundUpdateColors) {
            window.removeEventListener('themechange', this.boundUpdateColors);
        }
        this.boundUpdateColors = () => this.updateColors();
        window.addEventListener('themechange', this.boundUpdateColors);
    }

    handleResize() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.init();
        }, 250);
    }

    updateColors() {
        this.init();
    }

    destroy() {
        if (this.boundHandleResize) {
            window.removeEventListener('resize', this.boundHandleResize);
        }
        if (this.boundUpdateColors) {
            window.removeEventListener('themechange', this.boundUpdateColors);
        }
        clearTimeout(this.resizeTimer);
    }
}
