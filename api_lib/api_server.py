from django.db.models.query import QuerySet
from django.http import JsonResponse, Http404
from django.views.decorators.http import require_safe

from .last_modified_manager import last_modification_timestamp


all_models = {}


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
    """Return a frontend data manager payload.

    ids can be an iterable or None to get all instances.
    """
    query = {'pk__in': set(ids)} if ids is not None else {}

    return {
        'instances': [
            instance.api_serialize(group)
            for instance in model_class.objects.filter(**query)
        ],
        'last_modified': last_modification_timestamp().isoformat(),
    }


def inject(context, entries):
    """Modify context to make an injection of entries.

    Each the entry iterable must be one of:
        (instances, fields)
        instances
    where:
        instances - an iterable of instances of one model (including QuerySet),
        fields - the field group to serialize, defaults to '*'

    This function can be used multiple times on the same context.
    The context object is modified in-place and returned.
    """
    def normalize(e):
        if isinstance(e, tuple) and len(e) == 2 and isinstance(e[1], str):
            instances = e[0]
            group = e[1]
        else:
            instances = e
            group = '*'

        instances = list(instances)
        if not instances:
            return None
        assert len({ type(i) for i in instances }) == 1  # Forbid type mixing
        return (instances, type(instances[0]), group)

    normalized_entries = [
        normalized for e in entries if (normalized := normalize(e))
    ]
    last_modification = last_modification_timestamp().isoformat()

    target = context.get('injected_packets', None)
    if target is None:
        target = []
        context['injected_packets'] = target

    target += [
        {
            'model': model.__name__,
            'fields': group,
            'packet': {
                'instances': [
                    instance.api_serialize(group) for instance in instances
                ],
                'last_modified': last_modification,
            }
        }
        for instances, model, group in normalized_entries
    ]

    return context


@require_safe
def serve_data_manager(request, model_name):
    """Process an API request."""

    model_class = all_models.get(model_name)
    if model_class is None:
        raise Http404('Unknown model')

    assert hasattr(model_class, '_api')

    if request.GET.keys() - {'ids', 'fields'}:
        return failure('Invalid request: unsupported parameters')

    if {'ids', 'fields'} - request.GET.keys():
        return failure("Invalid request: 'ids' and 'fields' are required")

    if request.GET['ids'] == 'all':
        ids = None
    else:
        try:
            ids = [int(id) for id in request.GET['ids'].split(',')]
        except:
            return failure('Could not decode ids')

    fields = request.GET['fields']
    if fields not in model_class._api.field_groups:
        return failure('Unknown field group requested')

    return success(get_models(ids, fields, model_class))
