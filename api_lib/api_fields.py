"""KenDB3 API model decorator

The goal of this subsystem is to automate generation of REST-like endpoints.
Ideally, each field or every object should only be defined once - in its Django
model.

This subsystem currently only handles (de-)serialization to basic Python obj-
ects - acceptable for DjangoJSONEncoder. It will probably be expanded later.

TypeScript class declarations are automatically generated for all API models,
accessible via `import { MyModel } from 'dataman';` in frontend code.

# Usage

From the system's viewpoint, model instances are collections of fields that can
be read or assigned using getattr and setattr, respectively. However, Django
models and API objects don't necessarily coincide: sometimes it makes sense to
only serialize part of the model. Field groups solve this problem: every field
is assigned to one or more field groups (default being '*'); they are specified
when registering fields. Serialization and deserialization routines can then be
told to use fields from a particular group.

## Boilerplate

 1. Add a `_api` attribute, and initialize it to a APIEngine instance.
 2. Add a @api_model decorator.

Resulting model class template looks like this:

    from api_lib.api_fields import api_model, APIEngine

    @api_model
    class MyModel(models.Model):
        _api = APIEngine()
        # the rest of the model

## Specifying fields

Three syntactical options are available. The example for every option registers
two fields: `my_field` in the default '*' group, and `fav_pizza` in groups
'food_prefs' and 'moral_worth'.

 1. Annotation syntax, usually appropriate for Django Fields. Yes, this is
    incompatible with type hints. We don' use 'em here. Believe or not, annota-
    tions were designed for different uses.

        my_field: _api() = models.CharField(...)
        fav_pizza: _api('food_prefs', 'moral_worth') = models.CharField(...)

 2. Decorator syntax, usually appropriate for @property's. Note that @property
    itself is missing, replaced entirely by @_api().property.

        @_api().property
        def my_field(self): ...
        @my_field.setter
        def my_field(self, value): ...

        @_api('food_prefs', 'moral_worth').property
        def fav_pizza(self): ...
        @my_field.setter
        def fav_pizza(self, value): ...

 3. Manually, for all those pesky special cases.

        # some weird stuff that defines a 'my_field' attribute
        _api.add_field('my_field')

        # more weird weirdness that adds a 'fav_pizza' attribute
        _api.add_field('fav_pizza', groups=['food_prefs', 'moral_worth'])

## Complete model example

    from api_lib.api_fields import api_model, APIEngine

    @api_model
    class Car(models.Model):
        _api = APIEngine()

        make: _api() = models.CharField(max_length=64)
        color = models.CharField(max_length=16)
        design_desc: api('looks') = models.TextField()

        @_api('*', 'looks').property
        def color_rgb(self):
            return to_rgb(self.color)

        @color_rgb.setter
        def color_rgb(self, value):
            return self.color = from_rgb(value)

## Serialization and deserialization

    >>> myCar.api_serialize()
    {'id': 123, 'make': 'Batmobile', 'color_rgb': [0, 0, 0]}
    >>> myCar.api_serialize('looks')
    {'id': 123, 'design_desc': 'Looks cool.', 'color_rgb': [0, 0, 0]}
    >>> t34 = Car.api_deserialize({'id': 456, 'make': 'Soviet tank T-34'})
    >>> t34
    <Car: Car object (456)>
    >>> t34.make
    'Soviet tank T-34'
    >>> t34.color
    ''

## Handling of relational fields

Relational fields are serialized to relevant primary keys. This is currently
implemented by using fields with `_id` suffix if they exist.

Note that fields are set in the order of their registration.
"""

import builtins
from collections import namedtuple
import re

from django.db import models

from taggit.managers import _TaggableManager

from . import api_autogenerator
from . import api_server


def api_model(cls):
    """Create API methods and classmethods in cls and schedule autogeneration.

    This decorator expects to find an APIEngine instance in cls._api, which
    should have been used to mark API fields. See module docstring for details.
    """

    cls._api._assemble_groups(cls)

    api_server.all_models[cls._api.api_name] = cls

    cls.api_serialize = _api_serialize_impl
    cls.api_deserialize = _api_deserialize_impl

    api_autogenerator.include_model(cls)


    return cls


class _Registrar:
    """An object used to mark fields."""

    def __init__(self, api_engine, groups):
        self.groups = groups
        self.api_engine = api_engine
        api_engine._request(self, groups=groups)

    def __repr__(self):
        return '@_api(' + ', '.join(repr(g) for g in self.groups) + ')'

    def __str__(self):
        return repr(self)

    def property(self, getter):
        """Return a property attribute that is marked as an API field."""
        if isinstance(getter, builtins.property):
            raise TypeError(
                "Don't use @property together with @_api().property")

        registrar = self

        class _APIProperty(builtins.property):
            """Helps keep track of property mutations.

            Each use of property.getter, property.setter or property.deleter
            creates a new instance of property, which makes attributes defined
            with @property hard to track. This class updates references automa-
            tically.
            """

            def getter(self, getter_fn):
                return self._update(builtins.property.getter(self, getter_fn))
            def setter(self, setter_fn):
                return self._update(builtins.property.setter(self, setter_fn))
            def deleter(self, deleter_fn):
                return self._update(builtins.property.deleter(self, deleter_fn))

            def _update(self, new_instance):
                request.find_by = new_instance
                return new_instance

            def __repr__(self):
                spr = builtins.property.__repr__(self)
                return f"{registrar}.property({spr})"
            def __str__(self):
                spr = builtins.property.__str__(self)
                return f"{registrar}.property({spr})"

        first_wrapper = _APIProperty(getter)
        request = self.api_engine._request(first_wrapper, groups=self.groups)
        return first_wrapper


class APIEngine:
    """Orchestrator of API field registrations.

    See module docstring for details.
    """

    class _Request:
        """A request to register a field.

        See APIEngine._request() for details.
        """
        def __init__(self, find_by, groups, getter=None, setter=None):
            if isinstance(groups, str):
                raise TypeError('groups must be a non-str iterable')
            bad_groups = [g for g in groups if not isinstance(g, str)]
            if bad_groups:
                raise TypeError(f"groups must be strs, not {bad_groups}")

            self.find_by = find_by
            self.groups = groups
            self.accessors = (getter, setter) if getter or setter else None

    def __init__(self):
        self._requests = []
        self.field_groups = None
        self.api_name = None
        pass

    def __call__(self, *groups):
        return _Registrar(self, groups or ['*'])

    def _request(self, find_by, **kwargs):
        """Request that a field identified by find_by be registered as a field.

        find_by can take these values:
          - Attribute name (str)
          - Attribute object that will be looked up in cls.__dict__
          - _Registrar object that will be looked up in cls.__annotations__

        If an attribute object isn't found, of if multiple attributes match, an
        error will be raised by @api_method.

        The _Request object is returned and can be modified afterwards.
        """
        if self._requests is None:
            raise ValueError('API is already assembled, '
                             f"cannot request registration of {find_by!r}")

        request = APIEngine._Request(find_by, **kwargs)
        self._requests.append(request)
        return request

    def add_field(self, name, groups='*', getter=None, setter=None):
        """Manually register an API field in given groups.

        Prefer using annotations or decorators to this manual method.

        groups can be a single str or an iterable of strs. If omitted, defaults
        to '*'.

        getter and setter, if specified, will be used to serialize and deseri-
        alize the field. Their call signatures should match getattr and setattr
        builtins.
        """
        if isinstance(groups, str):
            groups = [groups]
        self._request(name, groups=groups, getter=getter, setter=setter)

    def add_related(self, name, groups='*'):
        """Register a related manager as an API field in given groups.

        groups can be a single str or an iterable of strs. If omitted, defaults
        to '*'.
        """
        self.add_field(name, groups,
                       getter=_related_manager_get,
                       setter=_related_manager_set)

    def _assemble_groups(self, cls):
        field_groups = {}
        requests = self._requests
        self._requests = None

        for request in requests:
            if isinstance(request.find_by, str):
                name = request.find_by
            elif isinstance(request.find_by, _Registrar):
                if not hasattr(cls, '__annotations__'):
                    continue
                name = _find_exactly_one(
                    (name for name, annotation in cls.__annotations__.items()
                     if annotation is request.find_by),
                    message_if_zero=None,
                    message_if_many=('@_api() annotation reused on fields {{}}'
                                     f" in {cls}")
                )
                if name is None:
                    continue
            else:
                name = _find_exactly_one(
                    (name for name, value in cls.__dict__.items()
                     if value is request.find_by),
                    message_if_zero=(f"Attribute object {request.find_by}, "
                                     f"marked as API, not found in {cls}"),
                    message_if_many=(f"Attribute object {request.find_by}, "
                                     'marked as API, found in several fields '
                                     f"in {cls}: {{}}")
                )

            if request.accessors:
                field = FieldMeta(name, *request.accessors)
            else:
                field = _determine_field_meta(cls, name)

            for group in request.groups:
                if group not in field_groups:
                    field_groups[group] = []
                field_groups[group].append(field)

        self.field_groups = field_groups
        self.api_name = re.sub(r'(?<!^)(?=[A-Z])', '_', cls.__name__).lower();
        self.all_fields = { meta.name for group in self.field_groups.values()
                                      for meta in group }

    def _get_fields(self, group):
        result = self.field_groups.get(group, None)
        if result is not None:
            return result
        raise ValueError(f"No fields registered in group {group!r}")

    def __repr__(self):
        return '_api: APIEngine'

    def __str__(self):
        return 'APIEngine'


def _find_exactly_one(candidates, message_if_zero, message_if_many):
    """Extract the only item from candidates, or optionally raise errors."""

    non_existant = object()
    candidate_iterable = iter(candidates)

    # Candidate 1 should exist
    candidate1 = next(candidate_iterable, non_existant)
    if candidate1 is non_existant:
        if message_if_zero:
            raise ValueError(message_if_zero)
        else:
            return None

    # Candidate 2 should not exist
    candidate2 = next(candidate_iterable, non_existant)
    if candidate2 is not non_existant:
        if message_if_many:
            raise ValueError(message_if_many.format(
                [candidate1, candidate2] + list(candidate_iterable)
            ))
        else:
            return None

    return candidate1


FieldMeta = namedtuple('FieldMeta',
                       'name, getter, setter',
                       defaults=(getattr, setattr))


def _determine_field_meta(cls, name):
    """Create FieldMeta for field registered as name in model cls."""

    if not hasattr(cls, name):
        # Probably a dynamic attribute
        return FieldMeta(name)

    attribute = getattr(cls, name)

    # Check for foreign keys and use object IDs instead
    if hasattr(attribute, 'field'):
        django_field = attribute.field
        if isinstance(django_field, models.ForeignKey):
            return FieldMeta(django_field.attname)
        elif isinstance(django_field, models.OneToOneField):
            return FieldMeta(django_field.attname)

    # Check for TaggableManager
    if isinstance(attribute, _TaggableManager):
        return FieldMeta(name, _taggable_manager_get, _taggable_manager_set)

    # Check for RelatedManager
    if hasattr(attribute, 'related_manager_cls'):
        return FieldMeta(name, _related_manager_get, _related_manager_set)

    return FieldMeta(name)


def _related_manager_get(obj, name):
    manager = getattr(obj, name)
    return [pk for (pk,) in manager.values_list('pk')]


def _related_manager_set(obj, name, value):
    manager = getattr(obj, name)
    objects = manager.model.objects.filter(pk__in=value)
    manager.set(objects)


def _taggable_manager_get(obj, name):
    return list(getattr(obj, name).names())


def _taggable_manager_set(obj, name, value):
    return getattr(obj, name).set(value)


def _api_serialize_impl(self, group='*'):
    """Serializes this object into a Python dict.

    The dict will include the values of all API fields in the requested group,
    and `'id': self.pk`.
    """

    fields = type(self)._api._get_fields(group)
    result = {name: getter(self, name) for name, getter, _ in fields}
    result['id'] = self.pk
    return result


@classmethod
def _api_deserialize_impl(cls, data, group='*'):
    """Creates an object from a Python dict.

    The object is created roughly so:

        obj = type(self)()
        if 'id' in data: obj.pk = data['id']
        if 'field_1' in data: obj.field_1 = data['field_1']
        ...
        if 'field_N' in data: obj.field_N = data['field_N']

    All API fields from the requested group will be looked up in data. Missing
    fields, and dict entries not corresponding to a field are silently ignored.

    Returned object is not saved automatically.
    """
    fields = cls._api._get_fields(group)

    obj = cls()
    if 'id' in data:
        obj.pk = data['id']

    for field, _, setter in fields:
        if field in data:
            setter(self, field, data[field])
    return obj
