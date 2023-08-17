from django.shortcuts import render
from django.views.decorators.http import require_safe

from submissions.models import Submission, SubmissionRevision, MinecraftVersion

from api_lib import api_responses


@require_safe
def submissions(request):
    return api_responses.success([
        s.api_serialize() for s in Submission.objects.all()
    ])


@require_safe
def submission_by_sid(request, submission_id):
    return api_responses.success(
        Submission.objects.get(submission_id=submission_id).api_serialize()
    )


def _basic_or_not(request):
    """Choose API group to use - 'basic' or '*' - based on GET query."""
    return 'basic' if 'basic' in request.GET else '*'


@require_safe
def revisions(request):
    group = _basic_or_not(request)
    return api_responses.success([
        s.api_serialize(group) for s in SubmissionRevision.objects.all()
    ])


@require_safe
def revision_by_id(request, revision_id):
    group = _basic_or_not(request)
    return api_responses.success(
        SubmissionRevision.objects.get(pk=revision_id).api_serialize(group)
    )


@require_safe
def revision_of_submission(request, submission_id, revision_string):
    group = _basic_or_not(request)
    return api_responses.success(
        SubmissionRevision.objects.get(
            revision_of_id=submission_id,
            revision_string=revision_string,
        ).api_serialize(group)
    )


@require_safe
def page(request, subpath=''):
    return render(request, "submissions/index.html")
