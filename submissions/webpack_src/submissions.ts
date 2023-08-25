// Importing jsrender causes a TS2688 error due to references to jQuery.
const jsrender = require('jsrender')();

import { formatTimestamp, getElementByIdOrDie } from 'common';
import { Viewmodule, Subpaths, ViewmoduleManager } from 'viewmodule';
import { Submission, SubmissionRevision, lastModified } from 'dataman';

class IndexViewmodule implements Viewmodule {
    async install(root: HTMLElement, subpath: string) {

        root.innerHTML = jsrender.templates('#tmpl-index').render();

        const subs = await Submission.objects.getAll();
        const revs = await SubmissionRevision.objects.getBulk(
            subs.map((s) => s.latest_revision).filter((r) => r !== null),
            'basic'
        );

        // FIXME access bypasses root
        getElementByIdOrDie('submission-list').innerHTML = (
            jsrender.templates('#tmpl-index-entry').render(revs)
        );

        return {
            title: 'Submissions',
        };
    }
}

class DetailsViewmodule implements Viewmodule {
    async install(root: HTMLElement, subpath: string) {
        const id = Number(subpath.substring('/'.length));
        const sub = await Submission.objects.get(id);
        const rev = await SubmissionRevision.objects.get(
            sub.latest_revision, '*');

        Submission.objects.getAll().then(
            (subs) => SubmissionRevision.objects.getBulk(
                subs.map((s) => s.latest_revision).filter((r) => r !== null),
                'basic'
            )
        );

        root.innerHTML = jsrender.templates('#tmpl-details').render(rev);

        return {
            title: `Submission ${id}`,
        };
    }
}

declare global {
    interface Window {
        viewmoduleManager: ViewmoduleManager | null
    }
}

document.addEventListener('DOMContentLoaded', () => {

    const index = new IndexViewmodule();
    const details = new DetailsViewmodule();

    const subpaths = new Subpaths();
    subpaths.register('/', index);

    Submission.objects.doOnceForEach(
        (sub) => subpaths.register('/' + sub.id, details)
    );

    window.viewmoduleManager = new ViewmoduleManager(subpaths);

});
