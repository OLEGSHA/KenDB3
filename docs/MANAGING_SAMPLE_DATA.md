# On managing sample data

This repository includes a limited dump of sample data for the database.

KenDB3 code assumes some data is present in the database already. Instead of writing complex initialization logic and corner case handling, OLEGSHA decided to just provide some bootstrap data via Django fixtures as recommended [Django documentation](https://docs.djangoproject.com/en/5.0/howto/initial-data/#provide-data-with-fixtures).

## Updating sample data

Adapt and run the following commands to recreate fixtures based on developer database contents:

```sh
python3 manage.py \
    dumpdata --format json --indent 2 --output fixtures/sample_users.json \
    --pks 2 auth.user

python3 manage.py \
    dumpdata --format json --indent 2 --output fixtures/sample_data.json \
    profiles submissions taggit
```
