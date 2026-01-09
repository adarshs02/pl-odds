/**
 * Router
 * Handles client-side navigation using hash-based routing
 */

export class Router {
    static currentView = 'dashboard';
    static handlers = {};

    static init(handlers) {
        this.handlers = handlers;

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());

        // Handle initial route
        this.handleRoute();

        // Bind back to dashboard link
        const backLink = document.getElementById('back-to-dashboard');
        if (backLink) {
            backLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate('');
            });
        }

        console.log('Router initialized');
    }

    static handleRoute() {
        const hash = window.location.hash.slice(1); // Remove #

        if (!hash || hash === '/') {
            this.showDashboard();
        } else if (hash.startsWith('/team/')) {
            const teamName = decodeURIComponent(hash.replace('/team/', ''));
            this.showTeamDetail(teamName);
        } else {
            // Unknown route, redirect to dashboard
            this.showDashboard();
        }
    }

    static showDashboard() {
        console.log('Showing dashboard view');
        this.currentView = 'dashboard';

        // Hide team detail, show dashboard
        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('team-detail-view').style.display = 'none';

        // Call dashboard handler if defined
        if (this.handlers.onDashboard) {
            this.handlers.onDashboard();
        }

        // Scroll to top
        window.scrollTo(0, 0);
    }

    static showTeamDetail(teamName) {
        console.log('Showing team detail view for:', teamName);
        this.currentView = 'team-detail';

        // Hide dashboard, show team detail
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('team-detail-view').style.display = 'block';

        // Call team detail handler if defined
        if (this.handlers.onTeamDetail) {
            this.handlers.onTeamDetail(teamName);
        }

        // Scroll to top
        window.scrollTo(0, 0);
    }

    static navigate(path) {
        window.location.hash = path;
    }

    static navigateToTeam(teamName) {
        this.navigate(`/team/${encodeURIComponent(teamName)}`);
    }

    static navigateToDashboard() {
        this.navigate('');
    }

    static getCurrentView() {
        return this.currentView;
    }

    static getCurrentTeam() {
        const hash = window.location.hash.slice(1);
        if (hash.startsWith('/team/')) {
            return decodeURIComponent(hash.replace('/team/', ''));
        }
        return null;
    }
}
