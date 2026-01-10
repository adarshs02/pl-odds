/**
 * Pie Chart Component
 * Visualizes win/loss/draw or cover/no-cover distributions
 */

export class PieChart {
    constructor(containerId, data, type = 'results') {
        this.containerId = containerId;
        this.container = d3.select(`#${containerId}`);
        this.data = data;
        this.type = type; // 'results' or 'covers'
        this.margin = { top: 20, right: 20, bottom: 20, left: 20 };

        this.init();
    }

    init() {
        // Clear existing content
        this.container.html('');

        // Calculate dimensions
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = 300;

        const width = containerWidth - this.margin.left - this.margin.right;
        const height = containerHeight - this.margin.top - this.margin.bottom;
        const radius = Math.min(width, height) / 2;

        // Create SVG
        const svg = this.container.append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight);

        const g = svg.append('g')
            .attr('transform', `translate(${containerWidth / 2},${containerHeight / 2})`);

        // Prepare data based on type
        let pieData;
        if (this.type === 'results') {
            pieData = [
                { label: 'Wins', value: this.data.wins, color: '--accent-positive' },
                { label: 'Draws', value: this.data.draws, color: '--accent-neutral' },
                { label: 'Losses', value: this.data.losses, color: '--accent-negative' }
            ];
        } else if (this.type === 'covers') {
            const covers = this.data.covers;
            const nonCovers = this.data.matchesPlayed - covers;
            pieData = [
                { label: 'Covers', value: covers, color: '--accent-positive' },
                { label: 'No Cover', value: nonCovers, color: '--accent-negative' }
            ];
        }

        // Filter out zero values
        pieData = pieData.filter(d => d.value > 0);

        // Create pie layout
        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        // Create arc generator
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius - 10);

        const labelArc = d3.arc()
            .innerRadius(radius - 40)
            .outerRadius(radius - 40);

        // Get computed colors
        const getColor = (color) => {
            const style = getComputedStyle(document.documentElement);
            return style.getPropertyValue(color).trim();
        };

        // Draw pie slices
        const slices = g.selectAll('.arc')
            .data(pie(pieData))
            .enter()
            .append('g')
            .attr('class', 'arc');

        slices.append('path')
            .attr('d', arc)
            .attr('fill', d => getColor(d.data.color))
            .attr('stroke', getColor('--bg-card'))
            .attr('stroke-width', 2)
            .style('opacity', 0)
            .transition()
            .duration(800)
            .style('opacity', 1)
            .attrTween('d', function(d) {
                const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
                return function(t) {
                    return arc(interpolate(t));
                };
            });

        // Add labels
        slices.append('text')
            .attr('transform', d => `translate(${labelArc.centroid(d)})`)
            .attr('text-anchor', 'middle')
            .attr('fill', getColor('--text-primary'))
            .attr('font-size', '14px')
            .attr('font-weight', '600')
            .style('opacity', 0)
            .text(d => d.data.value)
            .transition()
            .delay(800)
            .duration(300)
            .style('opacity', 1);

        // Add legend
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(20, 20)`);

        const legendItems = legend.selectAll('.legend-item')
            .data(pieData)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 25})`);

        legendItems.append('rect')
            .attr('width', 18)
            .attr('height', 18)
            .attr('fill', d => getColor(d.color))
            .attr('rx', 3);

        legendItems.append('text')
            .attr('x', 24)
            .attr('y', 9)
            .attr('dy', '0.35em')
            .attr('fill', getColor('--text-primary'))
            .attr('font-size', '13px')
            .text(d => `${d.label}: ${d.value} (${((d.value / pieData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%)`);

        // Setup resize handler
        window.addEventListener('resize', () => this.handleResize());

        // Listen for theme changes
        window.addEventListener('themechange', () => this.updateColors());
    }

    handleResize() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.init();
        }, 250);
    }

    updateColors() {
        // Re-render on theme change
        this.init();
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('themechange', this.updateColors);
    }
}
