"""
WSGI config for kendb3 project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# See JavascriptPipelineConfig.ready() in javascript_pipeline/apps.py
os.environ['JAVASCRIPT_PIPELINE__SHOULD_RUN'] = 'true'

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kendb3.settings')

application = get_wsgi_application()
