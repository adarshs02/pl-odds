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

        // Bind back to dashboard links
        document.querySelectorAll('#back-to-dashboard, #back-to-dashboard-tables').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate('');
            });
        });

        console.log('Router initialized');
    }

    static handleRoute() {
        const hash = window.location.hash.slice(1); // Remove #

        if (!hash || hash === '/') {
            this.showDashboard();
        } else if (hash === '/tables') {
            this.showTables();
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

        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('team-detail-view').style.display = 'none';
        document.getElementById('tables-view').style.display = 'none';
        const sidebar = document.querySelector('.upcoming-sidebar');
        if (sidebar) sidebar.style.display = '';

        if (this.handlers.onDashboard) {
            this.handlers.onDashboard();
        }

        window.scrollTo(0, 0);
    }

    static showTeamDetail(teamName) {
        console.log('Showing team detail view for:', teamName);
        this.currentView = 'team-detail';

        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('team-detail-view').style.display = 'block';
        document.getElementById('tables-view').style.display = 'none';
        const sidebar = document.querySelector('.upcoming-sidebar');
        if (sidebar) sidebar.style.display = '';

        if (this.handlers.onTeamDetail) {
            this.handlers.onTeamDetail(teamName);
        }

        window.scrollTo(0, 0);
    }

    static showTables() {
        console.log('Showing tables view');
        this.currentView = 'tables';

        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('team-detail-view').style.display = 'none';
        document.getElementById('tables-view').style.display = 'block';
        const sidebar = document.querySelector('.upcoming-sidebar');
        if (sidebar) sidebar.style.display = 'none';

        if (this.handlers.onTables) {
            this.handlers.onTables();
        }

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

    static navigateToTables() {
        this.navigate('/tables');
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
