# Recommendations for development

## Onboarding

New developers should start with [ARCHITECTURE.md](ARCHITECTURE.md); it explains the general layout and provides further links.

## Live reload

Django development server, started with `./manage.py runserver`, has a live reload feature: changes in Python code trigger a seamless restart, and Django templates are reloaded automatically.

Webpack development daemon watches TypeScript and SCSS files and recompiles assets automatically as well. In production mode, Webpack runs only once.

When compiling TypeScript, error messages are not emitted by Webpack. Developers can run `tsc --watch --pretty` in a separate terminal to see compilation errors live. JavaScript will not be produced due to `"noEmit": true` in `tsconfig.json`.

Sometimes, a full restart may still be necessary.

(TODO: run.sh with tmux)
