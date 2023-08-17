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

import { debug, wasNull } from 'common'

/**
 * A viewmodule.
 *
 * Viewmodules need to implement method install.
 */
export interface Viewmodule {

    /**
     * Appends viewmodule contents to the empty element root.
     *
     * @param root the element to populate. Root is empty.
     * @param subpath current subpath
     *
     * @returns An Object.
     *          Property title contains the new title for the page.
     */
    install(root: HTMLElement, subpath: string): {title: string};

}

/**
 * Viewmodule manager class.
 */
export class ViewmoduleManager {

    /**
     * Root HTMLElement.
     */
    private _root: HTMLElement;

    /**
     * Base path.
     */
    private _base: string;

    /**
     * Last installed subpath or null.
     */
    private _installedSubpath: string | null = null;

    /**
     * Mapping from subpaths to viewmodules.
     */
    private registry: Map<string, Viewmodule> = new Map();

    /**
     * Initialize viewmodules and install viewmodule based on current location.
     *
     * @param moduleMap a viewmodule mapping with
     *        subpaths (specified as '/apple') as keys. A viewmodule can be
     *        mapped to multiple subpaths.
     *
     * @throws {Error} if moduleMap is empty, any subpath is malformed, or if
     *         current location does not correspond to any path.
     */
    constructor(moduleMap: Map<string, Viewmodule>) {
        this._root = document.getElementById('viewmodule-root')
            ?? wasNull('#viewmodule-root');

        // Register all subpaths
        for (const [subpath, viewmodule] of moduleMap) {
            this.register(subpath, viewmodule);
        }
        if (this.registry.size == 0) {
            throw new Error('No subpaths provided');
        }

        // Determine base
        const path = getCurrentPath();
        let base: string | null = null;
        for (const [subpath, viewmodule] of this.registry) {
            if (path.endsWith(subpath)) {
                base = path.substring(0, path.length - subpath.length);
                break;
            }
        }
        if (base == null) {
            throw new Error(`Path '${path}' did not match any registration`);
        }
        this._base = base;

        // Setup listeners
        document.addEventListener('click',
            this.handleClickEvent.bind(this));

        window.addEventListener('popstate',
            this.handlePopStateEvent.bind(this));

        debug('ViewmoduleManager initialized with base', this.base,
              ', root ', this.root,
              'and registered modules', this.registry);

        // Initialize root
        this.install();
    }

    private handlePopStateEvent(event: PopStateEvent): void {
        this.install();
    }

    private handleClickEvent(event: MouseEvent): void {
        // Determine destination
        function findDestination(): string | null {
            let element: any = event.target;
            while (true) {
                if (!(element instanceof HTMLElement)) {
                    // Weird target or click not on anchor or button
                    return null;
                } else if (element instanceof HTMLAnchorElement) {
                    return element.href;
                } else if (element instanceof HTMLButtonElement
                        && 'href' in element.dataset) {
                    return '' + element.dataset['href'];
                }

                element = element.parentElement;
            }
        }
        const href = findDestination();
        if (href === null) {
            return;
        }


        // Determine if destination is relevant
        const hrefUrl = new URL(href, window.location.href);
        const path = hrefUrl.origin + hrefUrl.pathname;
        if (!path.startsWith(this.base)) {
            return;
        }
        const subpath = path.substring(this.base.length);
        const viewmodule = this.registry.get(subpath);
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
    get root(): HTMLElement {
        return this._root;
    }

    /**
     * Return the base path.
     */
    get base(): string {
        return this._base;
    }

    /**
     * Return the current subpath according to window.location. It may not
     * correctly correspond to the installed module or even be a registered
     * subpath in case the location was modified in a way that was not handled
     * by ViewmoduleManager.
     *
     * @throws {Error} in case the subpath could not be extracted.
     */
    get currentSubpath(): string {
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
    get installedSubpath(): string | null {
        return this._installedSubpath;
    }

    /**
     * Register a new viewmodule for given subpath.
     *
     * @param subpath the subpath to assign the viewmodule to
     * @param viewmodule the viewmodule to register
     *
     * @throws {Error} if subpath is invalid or if it is already registered.
     */
    register(subpath: string, viewmodule: Viewmodule): void {
        // Check for subpath validity
        if (!subpath.startsWith('/')) {
            throw new Error(`Subpath '${subpath}' is invalid: `
                            + "does not start with '/'");
        }
        for (const badChar of ['#', '?', '@']) {
            if (subpath.includes(badChar)) {
                throw new Error(`Subpath '${subpath}' is invalid: `
                                + `contains '${badChar}'`);
            }
        }

        // Check for duplicates
        if (this.registry.has(subpath)) {
            throw new Error(`Subpath '${subpath}' is already registered`);
        }

        this.registry.set(subpath, viewmodule);
    }

    /**
     * Install the viewmodule appropriate for the current path.
     *
     * Behavior is undefined when current subpath is not registered.
     */
    install(): void {
        // Wipe root
        const root = this.root;
        while (root.firstChild) {
            root.removeChild(root.lastChild as Node);
        }

        // Find appropriate viewmodule
        const subpath = this.currentSubpath;
        const viewmodule = this.registry.get(subpath);
        if (viewmodule === undefined) {
            throw Error(`No viewmodule registered at subpath '${subpath}'`);
        }

        // Install it
        debug('ViewmoduleManager: installing ', viewmodule, 'at', subpath);
        const wishes = viewmodule.install(this.root, subpath);
        this._installedSubpath = subpath;

        document.title = wishes.title;
    }

    /**
     * Install the viewmodule appropriate for the current path if subpath has
     * changed since last installation.
     *
     * Behavior is undefined when current subpath is not registered.
     */
    installIfNecessary(): void {
        const subpath = this.currentSubpath;
        if (subpath !== this.installedSubpath) {
            this.install();
        }
    }

}

/**
 * Return the current path.
 */
function getCurrentPath(): string {
    return window.location.origin + window.location.pathname;
}
