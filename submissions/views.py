from django.shortcuts import render
from django.views.decorators.http import require_safe


@require_safe
def page(request, subpath=''):
    return render(request, "submissions/index.html")
