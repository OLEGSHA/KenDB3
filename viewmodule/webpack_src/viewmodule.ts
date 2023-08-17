/*
 * Viewmodules are a way to implement several pages within one HTML document.
 * The HTML document resides at a base path, and each page is identified by
 * a subpath. Multiple subpaths can be managed by a single viewmodule:
 *
 *     Base path   Subpath   Viewmodule
 *     /dir/fruits /order    order
 *     /dir/fruits /apples   details
 *     /dir/fruits /bananas  details
 *
 * When the HTML document is loaded, window.location.href is used to identify
 * the base path and the current subpath.
 *
 * A global onclick listener is registered. Clicks leading a known subpath are
 * cancelled, and a corresponding viewmodule is installed instead.
 *
 * Viewmodules replace the contents of the HTML element with ID
 * 'viewmodule-root', also known as 'viewmodule root'.
 */

import { debug } from 'common'

/**
 * A viewmodule.
 *
 * Viewmodules need to implement method install.
 *
 * install(root, subpath)
 *   Appends viewmodule contents to the empty element root.
 *   @-param {HTMLElement} root the element to populate. Root is empty.
 *   @-param {String} subpath current subpath
 *   @-returns An Object. Property title contains the new title for the page.
 */
export class Viewmodule {
    // Empty
}

/**
 * Viewmodule manager class.
 */
export class ViewmoduleManager {

    /**
     * Root HTMLElement.
     */
    #_root = null;

    /**
     * Base path.
     */
    #_base = null;

    /**
     * Last installed subpath or null.
     */
    #_installedSubpath = null;

    /**
     * Mapping from subpaths to viewmodules.
     */
    #registry = null;

    /**
     * Initialize viewmodules and install viewmodule based on current location.
     *
     * @param {Map<String, Viewmodule>} moduleMap a viewmodule mapping with
     *        subpaths (specified as '/apple') as keys. A viewmodule can be
     *        mapped to multiple subpaths.
     *
     * @throws {Error} if moduleMap is empty, any subpath is malformed, or if
     *         current location does not correspond to any path.
     */
    constructor(moduleMap) {
        this.#_root = document.getElementById('viewmodule-root');
        this.#registry = new Map(moduleMap);

        // Check module map
        if (this.#registry.size == 0) {
            throw new Error('No subpaths provided');
        }
        for (const [subpath, viewmodule] of this.#registry) {
            if (!subpath.startsWith('/')) {
                throw new Error(`'${subpath}' does not begin with a '/'`);
            }
            if (!(viewmodule instanceof Viewmodule)) {
                throw new TypeError(`${viewmodule} is not a Viewmodule`);
            }
        }

        // Determine base
        const path = getCurrentPath();
        for (const [subpath, viewmodule] of this.#registry) {
            if (path.endsWith(subpath)) {
                this.#_base = path.substring(0, path.length - subpath.length);
                break;
            }
        }
        if (this.base == null) {
            throw new Error(`Path '${path}' did not match any registration`);
        }

        // Setup listeners
        document.addEventListener('click',
            this.#handleClickEvent.bind(this));

        window.addEventListener('popstate',
            this.#handlePopstateEvent.bind(this));

        debug('ViewmoduleManager initialized with base', this.base,
              ', root ', this.root,
              'and registered modules', this.#registry);

        // Initialize root
        this.install();
    }

    #handlePopstateEvent(event) {
        this.install();
    }

    #handleClickEvent(event) {
        // Determine destination
        let href = null;
        let element = event.target;
        while (true) {
            if (!(element instanceof HTMLElement)) {
                // Weird target or click not on anchor or button
                return;
            } else if (element instanceof HTMLAnchorElement) {
                href = element.href;
                break;
            } else if (element instanceof HTMLButtonElement
                       && 'href' in element.dataset) {
                href = element.dataset['href'];
                break;
            }

            element = element.parentElement;
        }

        // Determine if destination is relevant
        const hrefUrl = new URL(href, window.location);
        const path = hrefUrl.origin + hrefUrl.pathname;
        if (!path.startsWith(this.base)) {
            return;
        }
        const subpath = path.substring(this.base.length);
        const viewmodule = this.#registry.get(subpath);
        if (viewmodule === undefined) {
            return;
        }

        // Interject
        event.preventDefault();
        if (this.installedSubpath !== subpath) {
            window.history.pushState(null, '', href);
            this.install();
        }
    }

    /**
     * Return the HTML element that is filled by viewmodules.
     */
    get root() {
        return this.#_root;
    }

    /**
     * Return the base path.
     */
    get base() {
        return this.#_base;
    }

    /**
     * Return the current subpath according to window.location. It may not
     * correctly correspond to the installed module or even be a registered
     * subpath in case the location was modified in a way that was not handled
     * by ViewmoduleManager.
     *
     * @throws {Error} in case the subpath could not be extracted.
     */
    get currentSubpath() {
        const path = getCurrentPath();
        if (path.startsWith(this.base)) {
            return path.substring(this.base.length);
        } else {
            throw new Error(`window.location (${path}) `
                            + `does not start with base path (${this.base})`);
        }
    }

    /**
     * Return the subpath for which a viewmodule was last installed, or null.
     */
    get installedSubpath() {
        return this.#_installedSubpath;
    }

    /**
     * Install the viewmodule appropriate for the current path.
     *
     * Behavior is undefined when current subpath is not registered.
     */
    install() {
        // Wipe root
        const root = this.root;
        while (root.firstChild) {
            root.removeChild(root.lastChild);
        }

        // Find appropriate viewmodule
        const subpath = this.currentSubpath;
        const viewmodule = this.#registry.get(subpath);
        if (viewmodule === undefined) {
            throw Error(`No viewmodule registered at subpath '${subpath}'`);
        }

        // Install it
        debug('ViewmoduleManager: installing ', viewmodule, 'at', subpath);
        const {
            title,
        } = viewmodule.install(this.root, subpath);
        this.#_installedSubpath = subpath;

        document.title = title;
    }

    /**
     * Install the viewmodule appropriate for the current path if subpath has
     * changed since last installation.
     *
     * Behavior is undefined when current subpath is not registered.
     */
    installIfNecessary() {
        const subpath = this.currentSubpath;
        if (subpath !== this.installedSubpath) {
            this.install();
        }
    }

}

/**
 * Return the current path.
 */
function getCurrentPath() {
    return window.location.origin + window.location.pathname;
}
