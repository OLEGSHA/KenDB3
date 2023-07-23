from django.shortcuts import render

from profiles.models import Profile

from api_lib import api_responses


def index(request):
    return api_responses.success({
        'profiles': [p.api_serialize() for p in Profile.objects.all()]
    })
