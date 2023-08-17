/*
 * Common JS utilities.
 */

/**
 * A Webpack variable.
 * true iff webpack mode is production, not development.
 */
declare const PRODUCTION : boolean;

/**
 * Log args to console unless in production mode.
 *
 * @param args the arguments for console.log
 */
export function debug(...args: any[]): void {
    if (!PRODUCTION) {
        console.log('%c[Debug]', 'font-weight: bold;',
                    ...args);
    }
}

/**
 * Always throws an Error complaining that `what` is null.
 *
 * Use like so:
 *   const x: number = foo() ?? wasNull('foo()');
 *
 * @throws {Error} - always
 */
export function wasNull(what: string): never {
    throw new Error(`${what} is null`);
}
