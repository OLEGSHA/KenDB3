/*
 * Common JS utilities.
 */

/**
 * Log args to console unless in production mode.
 *
 * @param args the arguments for console.log
 */
export function debug(...args) {
    if (!PRODUCTION) {
        console.log('%c[Debug]', 'font-weight: bold;',
                    ...args);
    }
}
