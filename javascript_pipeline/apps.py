import atexit
import os
import logging
import subprocess
import sys

from django.apps import AppConfig
from django.conf import settings

from . import autogenerators

# Autogenerators not imported elsewhere
from . import logo_autogenerator
from . import license_exposer


logger = logging.getLogger(__name__)


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

        JAVASCRIPT_PIPELINE__TEST_PRODUCTION
          Set manually to force production mode behavior even with DEBUG.
          Useful for testing only; do not use in production.
        """

        try:
            def check(x):
                return os.environ.get(f"JAVASCRIPT_PIPELINE__{x}", '')

            if check('PREVENT_RUNS'):
                # Disabled by user
                return

            if not check('SHOULD_RUN') and not (
                'runserver' in sys.argv
                or 'collectstatic' in sys.argv
            ):
                # Not a real server start
                return

            is_first_load = not check('IS_RELOAD')

            # Run autogenerators
            autogenerators.run()

            # Run script
            if is_first_load:
                if settings.DEBUG and not check('TEST_PRODUCTION'):
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
    if 'collectstatic' in sys.argv:
        logger.warning(
            'I am in development mode (DEBUG=True) and it looks like '
            "'collectstatic' is running. Webpack will likely not complete the "
            "initial build before 'collectstatic' terminates, and some static "
            'files will be missing.')

    process = subprocess.Popen(BUILD_DEVELOPMENT, cwd=settings.BASE_DIR)
    atexit.register(subprocess.Popen.terminate, process)


def build_pipeline():
    """Run frontend pipeline once in production mode.

    Unlike start_development_daemon, this function blocks until the process is
    complete.
    """
    subprocess.run(BUILD_PRODUCTION, cwd=settings.BASE_DIR)
