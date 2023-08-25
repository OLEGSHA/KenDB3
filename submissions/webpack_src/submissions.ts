import {
    formatTimestamp,
    error,
} from 'common';
import { Renderer, jsrender } from 'render';
import { Viewmodule, Subpaths, ViewmoduleManager } from 'viewmodule';
import {
    Submission,
    SubmissionRevision,
    MinecraftVersion,
    lastModified,
} from 'dataman';

declare global {
    interface Window {
        viewmoduleManager: ViewmoduleManager | null;
    }
}

/*
 * JsRender converter mcver
 *
 * Return version string by ID.
 *
 * @param vid ID of the version to fetch
 * @returns the version string
 */
jsrender.views.converters('mcver', (() => {
    const versions: MinecraftVersion[] = [];
    MinecraftVersion.objects.doOnceForEach((ver) => versions[ver.id] = ver);

    return (vid: number) => (
        versions[vid]?.display_name ?? error(`Unknown version ID ${vid}`)
    );
})());

class IndexViewmodule implements Viewmodule {
    async install(root: HTMLElement, subpath: string) {
        const rr = new Renderer(root);

        rr.renderSelf('index');

        const subs = await Submission.objects.getAll();
        const revs = await SubmissionRevision.objects.getBulk(
            subs.map((s) => s.latest_revision).filter((r) => r !== null),
            'basic'
        );

        rr.render('submission-list', 'index-entry', revs);
        rr.set('visible-count', revs.length);
        rr.set('submissions-count', revs.length);

        return {
            title: 'Submissions',
        };
    }
}

class DetailsViewmodule implements Viewmodule {
    async install(root: HTMLElement, subpath: string) {
        const rr = new Renderer(root);
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

        rr.renderSelf('details', rev);

        return {
            title: `Submission ${id}`,
        };
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
