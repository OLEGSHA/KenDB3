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

import {
    debug,
    error,
    getElementByIdOrDie
} from 'util/common';

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
    install(root: HTMLElement, subpath: string): Promise<{title: string}>;

}

/**
 * A registry of subpath-to-viewmodule pairs.
 */
export class Subpaths {

    /**
     * Backing container.
     */
    private readonly map = new Map<string, Viewmodule>();

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
        if (!/^\/[0-9a-zA-Z_/]*$/.test(subpath)) {
            throw new Error(`Subpath '${subpath}' is invalid`)
        }

        // Check for duplicates
        if (this.map.has(subpath)) {
            throw new Error(`Subpath '${subpath}' is already registered`);
        }

        debug('ViewmoduleManager: registered', viewmodule, 'at', subpath);
        this.map.set(subpath, viewmodule);
    }

    get size(): number {
        return this.map.size;
    }

    [Symbol.iterator] = this.map[Symbol.iterator].bind(this.map);
    get = this.map.get.bind(this.map)

}

/**
 * Viewmodule manager class.
 */
export class ViewmoduleManager {

    /**
     * Base path.
     */
    private readonly _base: string;

    /**
     * A function that outputs document title for a title suggested
     * by submodule.
     */
    private readonly titleFunction: (sub: string) => string;

    /**
     * Last installed subpath or null.
     */
    private _installedSubpath: string | null = null;

    /**
     * Mapping from subpaths to viewmodules.
     */
    private readonly registry: Subpaths;

    /**
     * Initialize viewmodules and install viewmodule based on current location.
     *
     * @param subpaths subpath mapping to use. A reference to this object is
     *        stored, so updates to subpaths are automatically visible.
     *
     * @throws {Error} if subpaths is empty, or if current location does not
     *         correspond to any path.
     */
    constructor(subpaths: Subpaths) {
        this.registry = subpaths;
        if (this.registry.size == 0) {
            throw new Error('No subpaths provided');
        }

        // Determine base
        const path = getCurrentPath();
        let base: string | null = null;
        for (const [subpath, viewmodule] of this.registry) {
            if (path.endsWith(subpath)) {
                const b = path.substring(0, path.length - subpath.length);
                // Select shortest base
                if (base === null || base.length > b.length) {
                    base = b;
                }
            }
        }
        this._base = base ?? error(`Path '${path}' is unknown`);

        // Determine title function
        // (Cheat)
        this.titleFunction = (s) => `${s} | KenDB`;

        // Setup listeners
        document.addEventListener('click',
            this.handleClickEvent.bind(this));

        window.addEventListener('popstate',
            this.handlePopStateEvent.bind(this));

        debug('ViewmoduleManager initialized with base', this.base,
              'and root', this.root);

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
                }

                element = element.parentElement;
            }
        }
        const href = findDestination();
        if (href === null) {
            return;
        }

        // Interject
        if (this.go(href)) {
            event.preventDefault();
        }
    }

    /**
     * Return the HTML element that is filled by viewmodules.
     */
    get root(): HTMLElement {
        return getElementByIdOrDie('viewmodule-root');
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
     * Install the viewmodule appropriate for the current path.
     *
     * Behavior is undefined when current subpath is not registered.
     */
    install(): void {
        // Find appropriate viewmodule
        const subpath = this.currentSubpath;
        const viewmodule = this.registry.get(subpath);
        if (viewmodule === undefined) {
            throw Error(`No viewmodule registered at subpath '${subpath}'`);
        }

        // Replace root
        const newRoot = this.root.cloneNode(false) as HTMLElement;
        this.root.replaceWith(newRoot);

        // Install viewmodule
        debug('ViewmoduleManager: installing ', viewmodule, 'at', subpath);
        this._installedSubpath = subpath;
        viewmodule.install(newRoot, subpath)
            .then((wishes) => {
                document.title = this.titleFunction(wishes.title);
            });
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

    /**
     * Go to given subpath and install appropriate viewmodule. A history state
     * is pushed if the subpath is different from current. If href is not
     * a path handled by this ViewmoduleManager, no action is taken.
     *
     * Behavior is undefined when new subpath is not registered.
     *
     * @param href the location to install.
     *
     * @returns true iff href is a path handled by this ViewmoduleManager.
     */
    go(href: string): boolean {
        // Determine if destination is relevant
        const hrefUrl = new URL(href, window.location.href);
        const path = hrefUrl.origin + hrefUrl.pathname;
        if (!path.startsWith(this.base)) {
            return false;
        }
        const subpath = path.substring(this.base.length);
        const viewmodule = this.registry.get(subpath);
        if (viewmodule === undefined) {
            return false;
        }

        // Determine if pushState is necessary
        if (this.installedSubpath !== subpath) {
            window.history.pushState(null, '', href);
        }

        this.install();

        return true;
    }

}

/**
 * Return the current path.
 */
function getCurrentPath(): string {
    return window.location.origin + window.location.pathname;
}
