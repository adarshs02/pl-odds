/**
 * Theme Manager
 * Handles light/dark theme toggle and persistence
 */

export class ThemeManager {
    static STORAGE_KEY = 'pl-odds-theme';

    static init() {
        // Load saved preference or detect system preference
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
        this.setTheme(theme, false); // Don't animate on initial load

        // Bind toggle button
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => this.toggle());
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem(this.STORAGE_KEY)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });

        console.log('Theme Manager initialized:', theme);
    }

    static setTheme(theme, animate = true) {
        const root = document.documentElement;

        // Add transition class for smooth animation
        if (animate) {
            root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
            setTimeout(() => {
                root.style.transition = '';
            }, 300);
        }

        root.setAttribute('data-theme', theme);
        localStorage.setItem(this.STORAGE_KEY, theme);

        // Dispatch event for other components to react to theme change
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    static toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        console.log('Theme toggled to:', newTheme);
    }

    static getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme');
    }
}
