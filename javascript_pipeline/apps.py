import atexit
import os
import subprocess
import sys

from django.apps import AppConfig
from django.conf import settings


_NPM_EXECUTABLE = os.environ.get('NPM_EXECUTABLE', 'npm')
BUILD_PRODUCTION = [_NPM_EXECUTABLE, 'run', 'build']
BUILD_DEVELOPMENT = [_NPM_EXECUTABLE, 'run', 'dev']


class JavascriptPipelineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'javascript_pipeline'

    def ready(self):
        """Run frontend pipeline if necessary.

        Environment variables:

        JAVASCRIPT_PIPELINE__SHOULD_RUN
          Set by wsgi.py and asgi.py. Set manually to encourage building front-
          end. Overridden by PREVENT_RUNS.

        JAVASCRIPT_PIPELINE__PREVENT_RUNS
          Set by this method to prevent duplicate runs due to live reloads. Set
          manually to prevent frontend builds. Overrides SHOULD_RUN.
        """

        # Determine if running is necessary
        def check(x):
            return os.environ.get(f"JAVASCRIPT_PIPELINE__{x}", '')
        should_run = (not check('PREVENT_RUNS')
                      and (check('SHOULD_RUN') or ('runserver' in sys.argv)))
        if not should_run:
            return

        # Run appropriate command
        if settings.DEBUG:
            start_development_daemon()
        else:
            build_pipeline()

        # Prevent re-runs
        os.environ['JAVASCRIPT_PIPELINE__PREVENT_RUNS'] = 'true'


def start_development_daemon():
    """Start a live update daemon and add a shutdown hook to kill it.

    This function does not wait for the initial build to complete.
    """
    process = subprocess.Popen(BUILD_DEVELOPMENT, cwd=settings.BASE_DIR)
    atexit.register(subprocess.Popen.terminate, process)


def build_pipeline():
    """Run frontend pipeline once in production mode.

    Unlike start_development_daemon, this function blocks until the process is
    complete.
    """
    subprocess.run(BUILD_PRODUCTION, cwd=settings.BASE_DIR)
