import os
from django import template

register = template.Library()


def return_env(name, env_var, default=''):
    """Create a function that returns the value of an environment variable.

    Queried environment variables are assumed to be constant.
    """
    value = os.getenv(env_var, default=default)
    result = lambda: value
    result.__name__ = name
    return result


register.simple_tag(return_env('git_ref', 'GIT_REF', '(dev)'))
register.simple_tag(return_env('git_sha', 'GIT_SHA', '-'))
