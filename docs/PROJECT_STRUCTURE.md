# Project structure

## Django

KenDB3 is a Python Django site at its highest level. Django sites are organized into distinct Django apps brought together by a so-called Django project. (Django has this complicated structure to make sites more flexible, something KenDB3 does not take advantage of.) In this repository, Django apps group related functionality without much regard to ensuring loose coupling – in fact, apps form a strict dependency tree where no components can be swapped. It may be useful to think of Django apps in KenDB3 as simply top-level Python submodules.

> For developers unfamiliar with Python, `__init__.py` files turn directories into Python modules by mere presence. As of now, all these files are empty and can safely be ignored altogether.

### Django project

The Django project resides in [`kendb3/`](../kendb3/).

```
kendb3/
├── asgi.py
├── __init__.py
├── settings.py
├── urls.py
└── wsgi.py
```

`urls.py` defines the top-level router. It maps Django apps to URL their subpaths. You may notice that some apps are mapped to `''`, the URL root. This means they define their subpaths themselves.

`settings.py` is a configuration file for Django. It contains a fair amount of logic for determining some of the values. It additionally declares the Django apps and other plugins (middleware, etc.) that are part of this Django site. All new Django apps must be activated via addition to this file.

`wsgi.py` and `asgi.py` provide support to correspondingly-named webserver interfaces; KenDB3 is designed to be deployed with WSGI.

### Django apps
