# KenDB3 web application

This is the source code of KenDB3, intended to go live on https://kendb.windcorp.ru/. Contributions are welcome.

Up-to-date task tree: [kendb3-plan.drawio.svg](https://windcorp.ru/other/kendb3-plan.drawio.svg).

## Approach and stack

KenDB3 is a web application – as much processing as reasonable should happen on the frontend. The goal is to reduce load times for the visitors and Internet traffic for the host.

KenDB3 will use Django as backend, with a REST-like API to access most of the data.

Frontend will not use any frameworks. A basic NPM and Webpack pipeline will be used.

The site will be deployed using docker-compose. It will use PostgreSQL as its production database.

## Developer setup

Initial setup:

```bash
# Clone repository
git clone https://github.com/OLEGSHA/KenDB3.git

# Setup and activate a dedicated venv
python3 -m venv KenDB3-venv
source KenDB3-venv/bin/activate

cd KenDB3

# Install Python packages
pip3 install -r requirements.txt

# Install frontend packages
npm install

# Configure development database (see below)
python3 manage.py makemigrations
python3 manage.py migrate
```

Run a development server with a SQLite3 database:

```bash
python3 manage.py runserver
```

See [Django 4.2 documentation](https://docs.djangoproject.com/en/4.2/) for more information.

### `makemigrations`???

Project is not production-ready yet. Migrations will be committed once the code is deployed on windcorp.ru.

## Dependencies

- **Backend**: [Django](https://djangoproject.com/) 4.2
  - [django-environ](https://pypi.org/project/django-environ/) – override settings.py with environment variables
  - [django-taggit](https://pypi.org/project/django-taggit/) – tag management
- **Frontend**:
  - [NPM](https://npmjs.com) – package management
  - [Webpack](https://webpack.js.org/) – resource bundling
  - [Babel](https://babeljs.io) – resource preprocessing
  - [JsRender](https://www.jsviews.com/#jsrender) – lightweight clientside HTML renderer

## License and reuse

Code and assets in this repository are licensed under AGPLv3-or-later (see [LICENSE](LICENSE)). However, it is not designed to be deployed anywhere except on windcorp.ru.
