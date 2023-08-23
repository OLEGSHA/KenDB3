from django.shortcuts import render
from django.views.decorators.http import require_safe

from api_lib import api_server

from .models import Submission, SubmissionRevision, MinecraftVersion


@require_safe
def page(request, subpath=''):
    submissions = list(Submission.objects.all())
    context = {
        'injected_packets': api_server.make_injection(
            submissions,
            MinecraftVersion.objects.all(),
            ([SubmissionRevision.objects.all().first()], 'basic'),
        )
    }
    return render(request, "submissions/index.html", context=context)
