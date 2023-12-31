# KenDB3 web application

This is the source code of KenDB3, intended to go live on https://kendb.windcorp.ru/. Contributions are welcome.

Up-to-date task tree: [kendb3-plan.drawio.svg](https://windcorp.ru/other/kendb3-plan.drawio.svg).

## Approach

KenDB3 is a web application – as much processing as reasonable should happen on the frontend. The goal is to reduce load times for the visitors and Internet traffic for the host.

For pages with dynamic content, frontend is highly autonomous; it communicates with the host using a REST-like API.

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

#### Useful environment variables
- `DEBUG` – set to `False` to enter production mode.
- `JAVASCRIPT_PIPELINE__TEST_PRODUCTION` – set to `True` to force production mode for JavaScript pipeline builds. Unsafe; do not use in production.
- `JAVASCRIPT_PIPELINE__SHOULD_RUN` – set to `True` to force JavaScript pipeline builds.
- `JAVASCRIPT_PIPELINE__PREVENT_RUNS` – set to `True` to prevent JavaScript pipeline builds.

See [Django 4.2 documentation](https://docs.djangoproject.com/en/4.2/) for more information.

### `makemigrations`???

Project is not production-ready yet. Migrations will be committed once the code is deployed on windcorp.ru.

## Stack

- **Frontend**:
  - [NPM](https://npmjs.com) – package management
  - [Webpack](https://webpack.js.org/) – resource bundling
  - [TypeScript](https://www.typescriptlang.org/) – JavaScript with type checking
    - [Babel](https://babeljs.io) – preprocessor
    - [JsRender](https://www.jsviews.com/#jsrender) – lightweight clientside HTML renderer
  - [Sass](https://sass-lang.com/) – enhanced CSS
  - served as Django static files
- **Backend**:
  - [Django](https://djangoproject.com/) – Python web framework
    - [django-environ](https://pypi.org/project/django-environ/) – override `settings.py` with environment variables
    - [django-taggit](https://pypi.org/project/django-taggit/) – tag management
  - [Pillow](https://python-pillow.org/) – image processing; used to preprocess static resources
  - [cairosvg](https://cairosvg.org/documentation/) – SVG renderer; used to preprocess static resources
  - Production database: [Dolt](https://github.com/dolthub/dolt) – MySQL-compatible database with version control _(not yet implemented)_
- **Deployment**: _(not yet implemented)_
  - something something [Gitea](https://gitea.io/) actions + [Docker](https://www.docker.com/)

## License and reuse

Code and assets in this repository are licensed under AGPLv3-or-later (see [LICENSE](LICENSE)). However, it is not designed to be deployed anywhere except on windcorp.ru.
