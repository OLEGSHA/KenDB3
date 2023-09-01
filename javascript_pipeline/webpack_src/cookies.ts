/*
 * A simple cookie API.
 */

/**
 * Metadata of a cookie.
 */
export interface CookieMeta {

    /**
     * A human-readable short description of this cookie's function.
     */
    description: string;

    /**
     * Whether this cookie should be considered essential.
     */
    isEssential: boolean;

}

/**
 * A cookie name and parameters.
 *
 * 'change' events are fired in this object whenever the value changes. See
 * constructor to homogeniously react to initial value and subsequent changes.
 * 'change' event is a CustomEvent; its detail is true iff the event is the
 * result of the document being loaded or the cookie getting registered, which-
 * ever comes first (happens once per cookie).
 */
export class Cookie extends EventTarget {

    /**
     * The name of the cookie.
     */
    readonly name: string;

    /**
     * The amount of seconds the cookie is set for.
     */
    readonly expiration: number;

    /**
     * Whether the cookie should be refreshed on every page load if it exists.
     */
    readonly autoRefresh: boolean;

    /**
     * Metadata of this cookie.
     */
    readonly meta: CookieMeta;

    /**
     * Create and _register_ a new cookie name and parameters,
     * optionally registering a change listener.
     *
     * The listener will receive a 'change' event asynchronously when the value
     * becomes available.
     */
    constructor(
        data: {
            name: string,
            expiration: number,
            autoRefresh: boolean,
            meta: CookieMeta,
        },
        ...firstListener: any[]
    ) {
        super();

        this.name = data.name;
        this.expiration = data.expiration;
        this.autoRefresh = data.autoRefresh;

        this.meta = {
            ...{
                isEssential: false,
                description: undefined,
            },
            ...data.meta
        };

        if (this.meta.description === undefined) {
            throw new Error('Cookie description not set');
        }

        if (firstListener.length !== 0) {
            (this as any)['addEventListener']('change', ...firstListener);
        }

        registerCookie(this);
    }

    /**
     * Get the current value of this cookie.
     *
     * @returns the current value as a string or null if the cookie is not set.
     */
    get value(): string | null {
        const needle = encodeURIComponent(this.name);

        const encodedOrUndefined = document.cookie
            .split(';')
            .map((s) => s.trim().split('=', 2))
            .find((e) => e[0] === needle)
            ?.[1];

        if (encodedOrUndefined === undefined) {
            return null;
        } else {
            return decodeURIComponent(encodedOrUndefined);
        }
    }

    /**
     * Check whether the cookie is set.
     *
     * @returns true iff the cookie is set
     */
    exists(): boolean {
        return this.value !== null;
    }

    /**
     * Set a new value for this cookie or erase it.
     *
     * @param val the new value or null to delete the cookie
     */
    set value(val: string | null) {
        doSet(this, val);
        fireChangeEvent(this, false);
    }

    /**
     * Erase the cookie.
     */
    erase(): void {
        this.value = null;
    }

}

/**
 * Set a new value for a cookie or erase it. This internal function does not
 * fire the 'change' event.
 *
 * @param cookie the cookie to alter
 * @param val the new value or null to delete the cookie
 */
function doSet(cookie: Cookie, val: string | null): void {
    if (val === undefined) {
        throw new Error('Attempted to set cookie to undefined');
    }

    const value = val ?? '';
    const expireIn = (val === null) ? -1 : cookie.expiration;

    const expire = new Date();
    expire.setSeconds(expire.getSeconds() + expireIn);

    document.cookie = encodeURIComponent(cookie.name)
                      + `=${encodeURIComponent(value)}`
                      + `; expires=${expire.toUTCString()}`
                      + '; samesite=strict'
                      + '; secure';
}

/**
 * Registry of all cookies.
 */
const allCookies: Cookie[] = [];

/**
 * True iff DOMContentLoaded event has not been processed yet.
 */
var isDOMLoaded = false;

/**
 * Register a cookie so its initial 'change' event eventually fires, and it can
 * be auto-refreshed.
 *
 * @param cookie the cookie to register
 */
function registerCookie(cookie: Cookie): void {
    allCookies.push(cookie);
    if (isDOMLoaded) {
        setTimeout(() => processCookie(cookie), 0);
    }
}

/**
 * Refresh the cookie if necessary and fire the initial 'change' event.
 *
 * @param cookie the cookie to process
 */
function processCookie(cookie: Cookie): void {
    if (cookie.autoRefresh) {
        const value = cookie.value;
        if (value !== null) {
            doSet(cookie, value);
        }
    }

    fireChangeEvent(cookie, true);
}


/**
 * Fire a 'change' event.
 *
 * @param cookie the cookie to fire the event within
 * @param isInitial true iff this change resulted from the document loading
 *        or the cookie being registered, false iff this change resulted
 *        from an explicit set.
 */
function fireChangeEvent(cookie: Cookie, isInitial: boolean): void {
    const event = new CustomEvent('change', { detail: isInitial });
    cookie.dispatchEvent(event);
}

/**
 * Return all registered cookies.
 *
 * @returns all cookies in no particular order
 */
export function getAllCookies(): Cookie[] {
    return Array.from(allCookies);
}


/*
 * Process cookies when the document is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    allCookies.forEach(processCookie);
    isDOMLoaded = true;
});
