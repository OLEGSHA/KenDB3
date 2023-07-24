from django.views.decorators.http import require_safe

from profiles.models import Profile

from api_lib import api_responses


@require_safe
def profiles(request):
    return api_responses.success([
        p.api_serialize() for p in Profile.objects.all()
    ])
