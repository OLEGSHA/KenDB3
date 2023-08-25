// Importing jsrender causes a TS2688 error due to references to jQuery.
const jsrender = require('jsrender')();
export { jsrender };

import { getChildById } from 'common';

/**
 * A wrapper for an HTMLElement to facilitate rendering or filling in elements.
 */
export class Renderer {

    /**
     * The element all other operations are relative to.
     */
    readonly root: HTMLElement;

    /**
     * Create a new Renderer for the provided element.
     */
    constructor(root: HTMLElement) {
        this.root = root;
    }

    /**
     * Render the requested JsRender template and replace the contents of tar-
     * get with the resulting HTML.
     *
     * @param target the element to modify
     * @param templateId the ID of the JsRender template container without the
     *        'templ-' prefix.
     * @param data an optional data source for the template renderer
     */
    renderInto(
        target: HTMLElement,
        templateId: string,
        data: any = {},
    ): void {
        const html = jsrender.templates('#tmpl-' + templateId).render(data);
        target.innerHTML = html;
    }

    /**
     * Replace the contents of root with the rendered JsRender template.
     *
     * @param templateId ID of the JsRender template container without the
     *        'templ-' prefix.
     * @param data an optional data source for the template renderer
     */
    renderSelf(templateId: string, data: any = {}): void {
        this.renderInto(this.root, templateId, data);
    }

    /**
     * Replace the contents of the element with given ID with the rendered
     * JsRender template. Only descendants of root are considered as targets.
     *
     * @param targetId ID of the target element
     * @param templateId ID of the JsRender template container without the
     *        'templ-' prefix.
     * @param data an optional data source for the template renderer
     * @throws Error if the element could not be found
     */
    render(targetId: string, templateId: string, data: any = {}): void {
        this.renderInto(this.getChildById(targetId), templateId, data);
    }

    /**
     * Replace the textContent of the element with given ID with value.
     * Only descendants of root are considered as targets.
     * Value is HTML-escaped before insertion.
     *
     * @param targetId ID of the target element
     * @param value the new textContent value
     * @throws Error if the element could not be found
     */
    set(targetId: string, value: any): void {
        this.getChildById(targetId).textContent = value;
    }

    /**
     * Replace the contents of the element with given ID with value. Only des-
     * cendants of root are considered as targets. Value is not HTML-escaped
     * before insertion.
     *
     * @param targetId ID of the target element
     * @param html the new innerHTML value
     * @throws Error if the element could not be found
     */
    setRaw(targetId: string, html: string): void {
        this.getChildById(targetId).innerHTML = html;
    }

    /**
     * Return the descendant of root with given ID or throw an Error.
     *
     * @param id ID of the element to find
     *
     * @returns the element
     * @throws Error if the element could not be found
     */
    getChildById(id: string): HTMLElement {
        return getChildById(this.root, id);
    }

}
