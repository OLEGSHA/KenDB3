FROM python:3-debian

WORKDIR /usr/src/app

# Install NPM
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        npm \
    && apt-get clean

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install NPM dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application
COPY . .

# Make port 80 available for links and/or publish
EXPOSE 80

# Configure Django
ENV DEBUG=False

# Launch command
CMD [ "gunicorn", \
      "kendb3.wsgi", \
      "-b", "0.0.0.0:80", \
      "--log-file", "-", \
      "--access-logfile", "-", \
      "--workers", "4", \
      "--keep-alive", "0" ]
