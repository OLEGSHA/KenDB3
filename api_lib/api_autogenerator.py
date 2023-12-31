"""An autogenerator of model declarations for api_lib.ts."""

import datetime
from inspect import cleandoc
import os.path

from django.conf import settings
from django.db import models

from javascript_pipeline import autogenerators


def _ts_template(string):
    """Remove 2 levels of indentation from a multiline string literal."""
    return '\n'.join(line[8:] for line in string.splitlines()[1:])


def _make_jsdoc(doc, indent_level=0):
    """Format doc as a JavaScript multi-line comment, possibly indented."""
    indent = '    ' * indent_level
    return (f"/*\n{indent} * "
            + f"\n{indent} * ".join(doc.splitlines())
            + f"\n{indent} */")


class _TypeScriptTemplates:  # namespace
    """Namespace for TypeScript file fragments.

    As fragments are used as Python format strings, literal { and } need to be
    escaped as {{ and }}.
    """

    HEADER = _ts_template('''
        /*
         * THIS IS AN AUTOGENERATED FILE
         * Do not commit this file to version control.
         * Generator: {me}
         * Generated at: {date}
         *
         * Model class declarations for dataman
         */

        import {{
            ModelBase,
            ModelClass,
            ModelManager,
            manageModel,
            Status,
        }} from './api_lib';
        import {{ getInjection }} from 'util/common';

        /**
         * Create a ModelManager and store it in modelClass.objects.
         *
         * Request URL is generated based on provided API model name.
         *
         * @param modelClass model class
         * @param modelAPIName model name to use in download URL
         */
        function autogenManageModel<Model extends ModelBase>(
            modelClass: ModelClass<Model>,
            modelAPIName: string,
        ): void {{
            const template = getInjection<string>('dataman-endpoint');
            const path = template.replace('MODEL_NAME', modelAPIName);
            manageModel(modelClass, new URL(path, window.location.origin));
        }}
    ''')

    FOOTER = ''

    CLASS_START = _ts_template('''
        {model_docs}
        export class {model} extends ModelBase {{
            /*
             * This model's ModelManager.
             */
            static objects: ModelManager<{model}>;

            /**
             * Field groups available for this model.
             */
            static fields = {model_groups};
    ''')

    FIELD = _ts_template('''

            {field_name}: {field_type} | null = null;
    ''')

    RESOLVE_FIELD = _ts_template('''

            {field_name}: number{field_array} | null = null;
            {field_base_name}: {field_type}{field_array} | null = null;
            static '_type_of_{field_base_name}': \
ModelClass<{field_type}> | null = null;
    ''')

    FIELD_GROUP = _ts_template('''
            private '_fields_{group_name}': Status = Status.NotRequested;
    ''')

    CLASS_END = _ts_template('''
        }}
        autogenManageModel({model}, {model_api_name!r});
        /**
         * Shortcut for {model}.objects.
         */
        export const {model}s = {model}.objects;
    ''')

    RESOLVE_TYPES_INIT_START = _ts_template('''

        /*
         * Initialize _type_of_X fields
         */
    ''')

    RESOLVE_TYPES_INIT_ENTRY = _ts_template('''
        {model}['_type_of_{field_base_name}'] = {field_type};
    ''')

    RESOLVE_TYPES_INIT_END = _ts_template('')


class _APIAutogenerator():
    """Autogenerator of models.autogenerated.ts."""

    def __init__(self):
        # Models to include
        self.models = []

        # List of context dicts for RESOLVE_TYPES_INIT_ENTRY, one for each
        # resolve field.
        self.resolve_init = None

    def include_model(self, model):
        """Add provided model definition to models.autogenerated.ts.

        Model must be a API model.
        """
        self.models.append(model)

    def __call__(self):
        """Generate models.autogenerated.ts using models included previously.
        """

        path = (settings.BASE_DIR / 'api_lib' / 'webpack_src'
                / 'models.autogenerated.ts')

        with open(path, 'w') as f:
            ctxt = {
                'me': os.path.relpath(__file__, settings.BASE_DIR),
                'date': datetime.datetime.now().isoformat()
            }

            # Transition to working state
            self.resolve_init = []

            # Write file header
            f.write(_TypeScriptTemplates.HEADER.format(**ctxt))

            # Write models
            for model in sorted(self.models, key=lambda m: m.__name__):
                self.write_model(f.write, model, ctxt)

            # Write resolve fields late initialization
            self.write_resolve_init(f.write, ctxt);

            # Write file footer
            f.write(_TypeScriptTemplates.FOOTER.format(**ctxt))

    def write_model(self, output, model, ctxt):
        """Output the definition of a single model."""
        templ = _TypeScriptTemplates

        # Extend context
        ctxt = {**ctxt,
            'model': model.__name__,
            'model_groups': (
                '[' + ', '.join(
                    repr(r) for r in model._api.field_groups.keys()
                ) + ']'
            ),
            'model_api_name': model._api.api_name,
            'model_docs': _make_jsdoc(cleandoc(model.__doc__)),
        }

        # Output model header
        output('\n')
        output(templ.CLASS_START.format(**ctxt))

        # Output all fields
        for field_name in sorted(model._api.all_fields):
            # Try dealing with resolve fields separately
            if field_name.endswith('_id') or field_name.endswith('_ids'):
                if self.write_resolve_field(output, model, field_name, ctxt):
                    continue

            # Normal field
            output(templ.FIELD.format(**{**ctxt,
                'field_name': field_name,
                'field_type': 'any',
            }))

        # Output field group trackers
        output('\n')
        for group in model._api.field_groups.keys():
            output(templ.FIELD_GROUP.format(**{**ctxt,
                'group_name': group
            }))

        # Output model footer
        output(templ.CLASS_END.format(**ctxt))

    def write_resolve_field(self, output, model, field_name, ctxt):
        """Output a resolve field or return False."""

        # Determine type of resolve field
        if field_name.endswith('_id'):
            suffix = '_id'
            field_array = ''
        elif field_name.endswith('_ids'):
            suffix = '_ids'
            field_array = '[]'
        else:
            assert False
        base_name = field_name.removesuffix(suffix)

        # Obtain referenced model class
        field_type = model._meta.get_field(base_name).related_model
        assert field_type is not None
        if field_type not in self.models:
            # External references are opaque
            return False

        # Context for RESOLVE_TYPES_INIT_ENTRY
        data = {
            'model': ctxt['model'],
            'field_name': field_name,
            'field_base_name': base_name,
            'field_type': field_type.__name__,
            'field_array': field_array,
        }

        output(_TypeScriptTemplates.RESOLVE_FIELD.format(**{**ctxt, **data}))
        self.resolve_init.append(data)
        return True

    def write_resolve_init(self, output, ctxt):
        """Output resolve field Initializers."""
        templ = _TypeScriptTemplates

        output(templ.RESOLVE_TYPES_INIT_START.format(**ctxt))
        for data in self.resolve_init:
            output(templ.RESOLVE_TYPES_INIT_ENTRY.format(**{**ctxt, **data}))
        output(templ.RESOLVE_TYPES_INIT_END.format(**ctxt))


# Create singleton and register it
_INSTANCE = _APIAutogenerator()

autogenerators.register(_INSTANCE)


def include_model(model):
    """Include given model class declaration."""
    _INSTANCE.include_model(model)
