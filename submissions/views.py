from django.shortcuts import render

from submissions.models import Submission, SubmissionRevision, MinecraftVersion

from api_lib import api_responses


def index(request):
    return api_responses.success({
        'submissions': [s.api_serialize() for s in Submission.objects.all()]
    })
