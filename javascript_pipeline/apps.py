import atexit
import os
import subprocess
import sys

from django.apps import AppConfig
from django.conf import settings

from . import autogenerators


_NPM_EXECUTABLE = os.environ.get('NPM_EXECUTABLE', 'npm')
BUILD_PRODUCTION = [_NPM_EXECUTABLE, 'run', 'build']
BUILD_DEVELOPMENT = [_NPM_EXECUTABLE, 'run', 'dev']


class JavascriptPipelineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'javascript_pipeline'

    def ready(self):
        """Run frontend pipeline, including autogenerators, if necessary.

        Environment variables:

        JAVASCRIPT_PIPELINE__SHOULD_RUN
          Set by wsgi.py and asgi.py. Set manually to encourage building front-
          end. Overridden by either of PREVENT_RUNS and IS_RELOAD.

        JAVASCRIPT_PIPELINE__PREVENT_RUNS
          Set manually to prevent frontend builds. Overrides SHOULD_RUN.

        JAVASCRIPT_PIPELINE__IS_RELOAD
          Set by this method to prevent duplicate runs due to live reloads.
          Do not set manually. Overrides SHOULD_RUN.
        """

        try:
            def check(x):
                return os.environ.get(f"JAVASCRIPT_PIPELINE__{x}", '')

            if check('PREVENT_RUNS'):
                # Disabled by user
                return

            if not check('SHOULD_RUN') and ('runserver' not in sys.argv):
                # Not a real server start
                return

            is_first_load = not check('IS_RELOAD')

            # Run autogenerators
            autogenerators.run()

            # Run script
            if is_first_load:
                if settings.DEBUG:
                    start_development_daemon()
                else:
                    build_pipeline()

            # Prevent re-runs
            os.environ['JAVASCRIPT_PIPELINE__IS_RELOAD'] = 'true'

        finally:
            autogenerators.cancel_registrations()


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
