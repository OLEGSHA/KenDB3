import os
from functools import cache
from django import template

register = template.Library()


@register.simple_tag
@cache
def git_ref():
    return os.getenv('GIT_REF', '(dev)')


@register.simple_tag
@cache
def git_sha():
    return os.getenv('GIT_SHA', '-')[:9]
