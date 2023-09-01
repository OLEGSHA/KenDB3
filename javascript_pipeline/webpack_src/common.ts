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
 * Always throws an Error with given message.
 *
 * Use like so:
 *   const x: number = foo() ?? error('foo() is null');
 *
 * @throws {Error} always
 */
export function error(message: string): never {
    throw new Error(message);
}

/**
 * Always throws an Error.
 *
 * Use like so:
 *   const x: number = foo() ?? die(); // foo() should never return null
 *
 * @throws {Error} always
 */
export function die(): never {
    throw new Error('Assertion failed');
}

/**
 * Get an HTMLElement by its ID or throw an Error.
 *
 * @param id the ID to find
 *
 * @returns the element
 * @throws {Error} when element is not found
 */
export function getElementByIdOrDie(id: string): HTMLElement {
    return document.getElementById(id) ?? error(`#${id} not found`);
}

/**
 * Get an HTMLElement child of within by its ID or throw an Error.
 * Works on detached elements.
 *
 * @param within the element to look in
 * @param id the ID to find
 *
 * @returns the element
 * @throws {Error} when element is not found
 */
export function getChildById(
    within: HTMLElement,
    id: string
): HTMLElement {
    return (within.querySelector('#' + id)
        ?? error(`#${id} not found in ${within}`));
}

/**
 * Cache of loaded injections by former element ID.
 */
const loadedInjections = new Map<string, any>();

/**
 * Get an injected value by its ID.
 *
 * Injected values are usually created within Django templates using
 * {{ somevar|json_script:"injection-id" }}.
 *
 * Injected values are loaded once from DOM, after which the element containing
 * the injection is removed to reduce RAM usage. By default the value is
 * instead cached in a Map, but function parameter cache can be used to disable
 * caching and destroy the value forever.
 *
 * @param id the ID of the injection element
 * @param cache when set to false, injection data is deleted permanently
 *
 * @return the value loaded from DOM or cache
 */
export function getInjection<T>(id: string, cache: boolean = true): T {
    if (loadedInjections.has(id)) {
        return loadedInjections.get(id) as T;
    }

    const element = getElementByIdOrDie(id);
    if (!(element instanceof HTMLScriptElement)) {
        throw new Error('Injection must be a script element');
    }
    if (element.type !== "application/json") {
        throw new Error('Injection must have type="application/json"');
    }

    const value = JSON.parse(element.textContent
                             ?? error('Injection has no textContent'));
    element.remove();

    if (cache) {
        loadedInjections.set(id, value);
    }

    return value as T;
}

/**
 * Formats given Date object, e.g. 2023-02-28 11:39. Local timezone is used.
 *
 * @param ts the date to format
 * @returns the formatted date
 */
export function formatTimestamp(ts: Date): string {
    const pad = function(obj: any, minLength: number): string {
        let str = '' + obj;
        while (str.length < minLength) {
            str = '0' + str;
        }
        return str;
    };

    return pad(ts.getFullYear(), 4) + '-' +
           pad(ts.getMonth() + 1, 2) + '-' +
           pad(ts.getDate(), 2) + ' ' +
           pad(ts.getHours(), 2) + ':' +
           pad(ts.getMinutes(), 2);
}

/**
 * Ensure that only certain CSS classes out of a family are present.
 *
 * A family includes all classes that begin with prefix.
 *
 * Example:
 *
 *   theDiv = <div class="foo-cat bar-egg ham foo-fish">
 *   setClasses(theDiv, 'foo-', ['cat', 'foo-dog']);
 *   // theDiv now has class="foo-cat bar-egg ham foo-dog"
 *
 * @param element the element to modify
 * @param prefix the prefix to manage
 * @param allowed CSS class or classes to retain or add. prefix is prepended to
 *        classes do not start with it.
 */
export function setClasses(
    element: HTMLElement,
    prefix: string,
    allowed: string | Iterable<string>,
): void {
    const desiredClasses =
        ((typeof allowed === 'string') ? [allowed] : Array.from(allowed))
        .map((s) => s.startsWith(prefix) ? s : prefix + s);

    const currentClasses =
        Array.from(element.classList)
        .filter((s) => s.startsWith(prefix));

    // Remove classes that are no longer needed
    for (const currentClass of currentClasses) {
        if (!desiredClasses.includes(currentClass)) {
            element.classList.remove(currentClass);
        }
    }

    // Add missing classes
    for (const desiredClass of desiredClasses) {
        if (!currentClasses.includes(desiredClass)) {
            element.classList.add(desiredClass);
        }
    }
}
