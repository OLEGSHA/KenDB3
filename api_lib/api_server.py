from django.http import JsonResponse
from django.views.decorators.http import require_safe


def _api_response(*, status, payload, status_code):
    result = JsonResponse({
        'status': status,
        'payload': payload
    })
    result.status_code = status_code
    return result


def success(payload):
    """Build a Response object for a successful API request."""
    return _api_response(status='OK', payload=payload, status_code=200)


def failure(message, code=400):
    """Build a Response object for an unsuccessful API request."""
    return _api_response(status=message, payload=None, status_code=code)


def get_models(ids, group, model_class):
    """Return a frontend data manager payload."""
    return {
        'instances': [
            instance.api_serialize(group)
            for instance in model_class.objects.filter(pk__in=set(ids))
        ],
    }


@require_safe
def serve_data_manager(request, model_class):
    """Process an API request.

    Only URL search parameters are validated.
    """
    assert hasattr(model_class, '_api')

    if request.GET.keys() - {'ids', 'fields'}:
        return failure('Invalid request: unsupported parameters')

    if {'ids', 'fields'} - request.GET.keys():
        return failure("Invalid request: 'ids' and 'fields' are required")

    try:
        ids = [int(id) for id in request.GET['ids'].split(',')]
    except:
        return failure('Could not decode ids')

    fields = request.GET['fields']
    if fields not in model_class._api.field_groups:
        return failure('Unknown field group requested')

    return success(get_models(ids, fields, model_class))
