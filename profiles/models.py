"""Profile model."""
import re

from django.db import models
from django.contrib.auth.models import User

from api_lib.api_fields import api_model, APIEngine


@api_model
class Profile(models.Model):
    """Profile model.

    To be extended in future versions. All other code should reference Profiles
    instead of Users unless in authentication/authorization context.
    """
    _api = APIEngine()

    user: _api() = models.OneToOneField(User, on_delete=models.CASCADE)
    """Corresponding User object."""

    @_api('basic', '*').property
    def display_name(self):
        """Preferred name for the user."""
        return self.user.first_name or self.user.username

    _display_name_pattern = re.compile(
        r'^(?:{0}+ ?)*{0}$'.format(r'[A-Za-z0-9\-\.@+_\(\)\[\]\{\}&=#~]')
    )
    """Pattern that display names have to match.

    Additional length requirements exist that are not enforced by this regex.

    Explanation: allow several groups of allowed non-whitespace characters
    separated by exactly one space.
    """

    @display_name.setter
    def display_name(self, value):
        if value is None:
            self.user.first_name = ''
        elif len(value) > 150:
            raise ValueError(f"Display name is too long ({len(value)} > 150)")
        elif len(value) < 3:
            raise ValueError(f"Display name is too short ({len(value)} < 3)")
        elif Profile._display_name_pattern.fullmatch(value) is None:
            raise ValueError(f"Display name contains illegal characters")
        self.user.first_name = value

    def __str__(self):
        return f"@{self.user.username} ({self.display_name})"
