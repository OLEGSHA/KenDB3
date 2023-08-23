_registry = []

def register(generator):
    """Register a callable generator of resources.

    Autogenerators are executed sequentially in the order of registration when
    javascript_pipeline app becomes ready, but before webpack is invoked.
    Autogenerators are skipped when webpack does not run.
    """
    if _registry is None:
        raise ValueError('Autogenerator registration is no longer possible')
    _registry.append(generator)


def run():
    """Run all registered autogenerators."""
    generators = _registry
    cancel_registrations()
    for generator in generators:
        generator()


def cancel_registrations():
    """Prevent all future registrations and delete the registry."""
    global _registry
    _registry = None
