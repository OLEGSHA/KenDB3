#!/bin/sh
# Starts the production server
python3 manage.py makemigrations &&
python3 manage.py migrate &&
python3 manage.py collectstatic &&
gunicorn "$@"
