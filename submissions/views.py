from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_safe

from api_lib.api_server import inject

from .models import Submission, SubmissionRevision, MinecraftVersion


@require_safe
def page(request, submission_id=None):

    context = inject({}, MinecraftVersion.objects.all(), dump=True)

    if submission_id is None:
        # Inject list of submissions and basic info on latest revisions
        subs = list(Submission.objects.all())
        revs = (SubmissionRevision.objects
            .filter(pk__in={sub.latest_revision for sub in subs}))

        inject(context, subs, dump=True),
        inject(context, revs, 'basic')
    else:
        # Inject requested submission and its latest revision
        sub = get_object_or_404(Submission, pk=submission_id)
        rev = sub.get_latest_revision(raise_if_none=False)

        inject(context, [sub])
        inject(context, [rev], '*')

    return render(request, "submissions/index.html", context=context)
