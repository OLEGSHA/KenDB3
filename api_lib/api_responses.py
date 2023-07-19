from django.http import JsonResponse


def _api_response(*, status, payload):
    return JsonResponse({
        'status': status,
        'payload': payload
    })


def success(payload):
    """Build a Response object for a successful API request."""
    return _api_response(status='OK', payload=payload)
