"""An autogenerator of model declarations for api_lib.ts."""

import datetime
from inspect import cleandoc
import os.path

from django.conf import settings

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
    HEADER = _ts_template('''
        /*
         * THIS IS AN AUTOGENERATED FILE
         * Do not commit this file to version control.
         * Generator: {me}
         * Generated at: {date}
         *
         * Model class declarations for dataman.ts
         */

        import {{
            ModelBase,
            ModelManager,
            manageModel,
            Status,
        }} from './api_lib';
        import {{ getInjection }} from 'common';

        /**
         * Create a ModelManager and store it in modelClass.objects.
         *
         * Request URL is generated based on provided API model name.
         *
         * @param modelClass model class
         * @param modelAPIName model name to use in download URL
         */
        function autogenManagerModel<Model extends ModelBase>(
            modelClass: new(id: number) => Model,
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

    ''')

    FIELD = _ts_template('''
            {field_name}: {field_type};
    ''')

    FIELD_GROUP = _ts_template('''
            private '_fields_{group_name}': Status = Status.NotRequested;
    ''')

    CLASS_END = _ts_template('''
        }}
        autogenManagerModel({model}, {model_api_name!r});
    ''')


class _APIAutogenerator():

    def __init__(self):
        self.models = []

    def include_model(self, model):
        self.models.append(model)

    def __call__(self):
        path = (settings.BASE_DIR / 'api_lib' / 'webpack_src'
                / 'models.autogenerated.ts')

        with open(path, 'w') as f:
            ctxt = {
                'me': os.path.relpath(__file__, settings.BASE_DIR),
                'date': datetime.datetime.now().isoformat()
            }

            f.write(_TypeScriptTemplates.HEADER.format(**ctxt))

            for model in self.models:
                _APIAutogenerator.write_model(f.write, model, ctxt)

            f.write(_TypeScriptTemplates.FOOTER.format(**ctxt))

    def write_model(output, model, ctxt):
        templ = _TypeScriptTemplates
        ctxt = {**ctxt,
            'model': model.__name__,
            'model_api_name': model._api.api_name,
            'model_docs': _make_jsdoc(cleandoc(model.__doc__)),
        }

        output('\n')

        output(templ.CLASS_START.format(**ctxt))

        for field_name in model._api.all_fields:
            output(templ.FIELD.format(**{**ctxt,
                'field_name': field_name,
                'field_type': 'any | null',
            }))

        output('\n')

        for group in model._api.field_groups.keys():
            output(templ.FIELD_GROUP.format(**{**ctxt,
                'group_name': group
            }))

        output(templ.CLASS_END.format(**ctxt))


# Create singleton and register it
_INSTANCE = _APIAutogenerator()

autogenerators.register(_INSTANCE)


def include_model(model):
    """Include given model class declaration."""
    _INSTANCE.include_model(model)
