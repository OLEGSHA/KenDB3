FROM python:3

WORKDIR /usr/src/app

# Install NPM
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        npm \
    && apt-get clean

# Install Python dependencies
COPY requirements-production.txt ./
RUN pip install --no-cache-dir -r requirements-production.txt

# Install NPM dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application
COPY . .

# Make port 80 available for links and/or publish
EXPOSE 80

# Configure Django
ENV DEBUG=False
ENV STATIC_ROOT=/var/www/kendb3_static

# Bake git information
ARG GIT_SHA=''
ENV GIT_SHA=$GIT_SHA
ARG GIT_REF=''
ENV GIT_REF=$GIT_REF

# Launch command
CMD [ "sh", "./.windcorp.ru/start.sh", \
      "kendb3.wsgi", \
      "-b", "0.0.0.0:80", \
      "--log-file", "/var/log/kendb3.gunicorn.log", \
      "--access-logfile", "/var/log/kendb3.access.log", \
      "--workers", "1", \
      "--keep-alive", "0" ]
