"""Tracker and manager for last modification timestamp for API models."""
from django.db.models import Max


_all_models = None


def last_modification_timestamp():
    """Get last modification timestamp as UTC datetime.

    Tracked objects include all API models.
    """

    # TODO improve perfomance - this function should not run any heavy queries
    global _all_models

    # Steal all_models from api_server >:D (Terrible Temporary Solution)
    # (Your eyes bleeding is intentional, it ensures this is fixed promptly.)
    if _all_models is None:
        from . import api_server
        _all_models = [m for m in api_server.all_models.values()
                       if any(f.name == 'last_modified'
                              for f in m._meta.get_fields())]

    return max(
        model.objects.aggregate(Max('last_modified'))['last_modified__max']
        for model in _all_models
    )
