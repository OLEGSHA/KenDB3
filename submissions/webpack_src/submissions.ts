import { formatTimestamp } from 'common';
import { Viewmodule, Subpaths, ViewmoduleManager } from 'viewmodule';
import { Submission, SubmissionRevision, lastModified } from 'dataman';

class IndexViewmodule implements Viewmodule {
    async install(root: HTMLElement, subpath: string) {
        const subs = await Submission.objects.getAll();
        const revs = await SubmissionRevision.objects.getBulk(
            subs.map((s) => s.latest_revision).filter((r) => r !== null),
            'basic'
        );

        const preamble = document.createElement('p');
        preamble.textContent = (
            `Total ${revs.length} submissions. `
            + 'Last update: ' + formatTimestamp(lastModified()));

        const list = document.createElement('ul');
        revs.sort((a, b) => a.id - b.id);
        for (const rev of revs) {
            list.insertAdjacentHTML(
                'beforeend',
                `<li>
                    Submission ${rev.revision_of_id}: ${rev.name ?? 'Untitled'}
                    v${rev.revision_string}
                    <button type="button" data-href="${rev.revision_of_id}">
                        Details
                    </button>
                </li>`
            );
            console.warn('I just inserted unsafe strings into HTML!');
        }

        root.append(preamble, list);

        return {
            title: 'Submissions'
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

        root.insertAdjacentHTML(
            'beforeend',
            `<h1>${id} / ${rev.name ?? 'Untitled'}</h1>
            <p>Version: v${rev.revision_string}
            <p>Rules JSON: ${rev.rules}
            <p>Author notes: ${rev.author_notes}
            <p>Editors' comment: ${rev.editors_comment}
            `
        );
        console.warn('I just inserted unsafe strings into HTML!');

        return {
            title: `Submission ${id}`
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
