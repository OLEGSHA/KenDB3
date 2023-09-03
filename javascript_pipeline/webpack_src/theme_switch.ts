/*
 * A cookie-based global dark theme switch.
 *
 * The switch has three states:
 * - light: cookie 'force-theme' exists and has value 'light'
 * - dark: cookie 'force-theme' exists and has value 'dark'
 * - auto: cookie 'force-theme' does not exist
 *
 * This script should be referenced in each styled document.
 */

import {
    setClasses,
    getElementByIdOrDie,
} from 'util/common';
import { Cookie } from 'util/cookies';

const COOKIE = new Cookie(
    {
        name: 'force-theme',
        expiration: 30*24*60*60, // 1 month
        autoRefresh: true,
        meta: {
            isEssential: false,
            description:
                'Controls the color scheme of the website. Only set when a '
                + 'light theme or a dark theme is explicitly enabled by the '
                + 'user via the use of a color scheme selection button.',
        },
    },
    onChange,
);

/**
 * Called on cookie change and initialization; applies the theme choice.
 */
function onChange() {
    console.log('Cookie is now', COOKIE.value, COOKIE.exists() ? 'exists' : 'absent');
    setClasses(document.body, 'theme-', getTheme() ?? []);
}

/**
 * Set forced theme or disable forced themes.
 *
 * Use lowercase-with-dashes for theme names.
 *
 * @param theme the theme to force or null
 */
export function setTheme(theme: string | null): void {
    COOKIE.value = theme;
}

/**
 * Get current forced theme.
 *
 * @returns the current forced theme or null
 */
export function getTheme(): string | null {
    return COOKIE.value;
}

/*
 * Add listeners for theme change buttons.
 */
document.addEventListener('DOMContentLoaded', () => {
    const options = [null, 'light', 'dark'];

    const container = getElementByIdOrDie('theme-buttons');

    for (const option of options) {
        const str = option ?? 'auto';
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add(str);
        button.addEventListener('click', () => setTheme(option));
        container.appendChild(button);
    }
});
