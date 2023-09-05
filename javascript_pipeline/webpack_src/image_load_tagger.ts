/*
 * Adds classes to <img> elements when they successfully load or fail to load.
 *
 * This tagger works with pre-existing <img> elements, both complete and
 * incomplete at run time, and with new <img> elements added to DOM.
 *
 * Use "data-dont-tag" to exempt an img from this tagger.
 *
 * Known limitations:
 *   - "data-dont-tag" is only checked when the <img> is first encountered
 *   - source changes do not trigger tag changes
 *   - SVG images and other images without natural width break error detection
 *   - images with natural width of 0 break error detection
 */
/*
 * N.B.: HTMLImageElement.complete and possibly .naturalWidth are updated
 * asynchronously (see MDN docs), make sure to avoid race conditions.
 */
import { setClasses, debug } from './common';

/**
 * Set tags according to current state of image and remove listeners.
 */
function setTags(image: HTMLImageElement): void {
    if (!image.complete) {
        setClasses(image, 'img-', []);
    } else {

        // https://keith.gaughan.ie/detecting-broken-images-js.html
        const broken = ((image.naturalWidth ?? 0) == 0);

        setClasses(image, 'img-', broken ? 'broken' : 'loaded');
    }
}

/**
 * The shared listener instance.
 */
const theListener = (event: Event) => {
    if (event.target instanceof HTMLImageElement) {
        setTags(event.target);
    }
};

/**
 * Ensure load tags are applied correctly to the provided HTMLImageElement.
 *
 * Unfit elements are ignored silently.
 *
 * @param element the element to process
 */
function setupTags(element: HTMLElement): void {
    if (!(element instanceof HTMLImageElement)) {
        return;
    }
    const image = element as HTMLImageElement;

    if ('dontTag' in image.dataset) {
        return;
    }

    image.addEventListener('error', theListener);
    image.addEventListener('load', theListener);

    if (image.complete) {
        setTags(image);
    }
}

/*
 * Inject listeners into existing imgs
 */
for (const element of document.body.getElementsByTagName('img')) {
    setupTags(element);
}

/*
 * Setup and activate injector
 */
function observerCallback(
    mutationList: MutationRecord[],
    observer: MutationObserver
): void {
    for (const mutation of mutationList) {
        for (const addedNode of mutation.addedNodes) {
            if (addedNode instanceof HTMLImageElement) {
                setupTags(addedNode);
            } else if (addedNode instanceof HTMLElement) {
                for (const child of addedNode.getElementsByTagName('img')) {
                    setupTags(child);
                }
            }
        }
    }
}

new MutationObserver(observerCallback).observe(document.body, {
    subtree: true,
    childList: true,
});
