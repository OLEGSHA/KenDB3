# Deploying KenDB3

## Overview

> **TL;DR**
>
> Django is served [Gunicorn](https://gunicorn.org/). Static files are served by Gunicorn, too,
via [WhiteNoise](https://whitenoise.readthedocs.io/en/latest/). The application is packaged into a Docker image.
>
> CI on windcorp.ru builds new images based on `main` and `development` branches and deploys them automatically.
>
> Deployment is handled by a script named manage.sh on windcorp.ru. It uses `.windcorp.ru/docker-compose.yaml` to deploy the Docker image and sets up a reverse proxy with Apache2 that is installed on host.

![Overview diagram of KenDB3 deployment on windcorp.ru](deployment-overview.drawio.svg)

## Prerequisites

The following is required to deploy the website:
- install Python and NPM dependencies
- provide a Django secret key using environment variables `SECRET_KEY_FILE` or `SECRET_KEY` (Django secret key can be any string)
- set `DEBUG` environment variable to `False` to enable production mode in Django
- set `ALLOWED_HOSTS` environment variable to the fully qualified domain name to expect in HTTP Host header
- set `STATIC_ROOT` environment variable to the path where static files should be stored
- set `ERROR_LOG` environment variable to the path where errors should be logged in plain text

After that, the webserver can be started:
```bash
# In repository root
python3 manage.py makemigrations &&
python3 manage.py migrate &&
python3 manage.py collectstatic &&
gunicorn kendb3.wsgi
```

## Docker

The repository contains a Dockerfile that can be used to build an almost-ready-to-deploy image.

```bash
# In repository root
docker build --tag kendb3:latest
docker run \
    --publish=80:80 \
    --volume=./db.sqlite3:/usr/src/app/db.sqlite3 \
    --volume=./django_secret_key:/django_secret_key \
    --volume=./error.log:/var/log/kendb3.error.log \
    --env=SECRET_KEY_FILE=/django_secret_key \
    --env=ERROR_LOG=/var/log/kendb3.error.log \
    --env=STATIC_ROOT=/static \
    --env=ALLOWED_HOSTS=kendb3.example.com \
    kendb3:latest
```

Logs can be found in `/var/log/` inside the container.

## Gitea Actions

The repository additionally contains a CI configuration for automatic deployment at windcorp.ru by means of [Gitea Actions](https://docs.gitea.com/usage/actions/overview) (very similar to [GitHub Actions](https://github.com/features/actions)).

The action checks out the repository into a container, then builds the Docker image and tags it appropriately. Finally, the host is notified through SSH, and the running instance is reloaded based on the image that was built.

See [.windcorp.ru](../.windcorp.ru) for some windcorp.ru-specific files.

The infrastructure on host is not represented in this repository.
