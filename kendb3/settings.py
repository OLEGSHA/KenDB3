"""Django settings for KenDB3 project.

Settings in this file are acceptable for a development environment. They should
be replaced using environment variables in a production environment.

The following Django settings can be set from environment variables:
  DEBUG
  SECRET_KEY
  SECRET_KEY_FILE
  ALLOWED_HOSTS
  DATABASE_URL
  ERROR_LOG
  STATIC_ROOT
"""

from pathlib import Path

import environ


# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Setup environ
env = environ.Env(

    DEBUG=(bool, True),

    ERROR_LOG=(str, None),

    SECRET_KEY=(
        str,
        'django-insecure-s!q1auw%5c6s(csx3(og24s*^50b7ln-^@hby!tcpakwc^ha6('
    ),

    SECRET_KEY_FILE=(str, None),

    ALLOWED_HOSTS=(list, []),

    STATIC_ROOT=(str, None),

)


# Environment-dependent settings
#
# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

if not env('SECRET_KEY_FILE'):
    SECRET_KEY = env('SECRET_KEY')
else:
    with open(env('SECRET_KEY_FILE'), 'rb') as secret_key_file:
        SECRET_KEY = secret_key_file.read()

DEBUG = env('DEBUG')
ALLOWED_HOSTS = env('ALLOWED_HOSTS')
STATIC_ROOT = env('STATIC_ROOT')

DATABASES = {
    'default': env.db(default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
}


# Suppressions
SILENCED_SYSTEM_CHECKS = [
    # Empty
]


# Logging setup for production
if ERROR_LOG:
    LOGGING = {
        "version": 1,
        "disable_existing_loggers": False,
        "handlers": {
            "file": {
                "level": "WARNING",
                "class": "logging.FileHandler",
                "filename": ERROR_LOG,
            },
        },
        "loggers": {
            "django": {
                "handlers": ["file"],
                "level": "WARNING",
                "propagate": True,
            },
        },
    }


# (Here be dragons)
# Application definition

INSTALLED_APPS = [
    'api_lib.apps.ApiLibConfig',
    'viewmodule.apps.ViewmoduleConfig',
    'profiles.apps.ProfilesConfig',
    'submissions.apps.SubmissionsConfig',
    'javascript_pipeline.apps.JavascriptPipelineConfig',
    'taggit',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'kendb3.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'templates',
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'kendb3.wsgi.application'


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = 'static/'

STATICFILES_DIRS = [
    BASE_DIR / 'static',
    BASE_DIR / 'autogenerated_static',
]

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
