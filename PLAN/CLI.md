# CLI

## Direction

CLI should follow the same plugin-owned initialization direction as browser2 instead of accumulating host-owned migration/bootstrap knowledge for each plugin.

## Plugin-owned init hooks

Current direction:
- if a plugin exposes `__fs_init`, the host may call it during filesystem/bootstrap initialization
- if a plugin exposes `__sql_init`, the host may call it during SQL/bootstrap initialization

For now the hook split stays explicit:
- `__fs_init`
- `__sql_init`

This is preferred over a generic `__init__` for now because it keeps resource ownership and bootstrap ordering readable.

## Intended behavior

- plugin load checks whether `__fs_init` or `__sql_init` exists
- if the hook exists, plugin load calls it
- the plugin decides what to create/populate
- hooks should be idempotent
- centralized host migration files should shrink over time as plugins take ownership of their own bootstrap state

## Example

A plugin like `treegen` can expose:
- `__sql_init()` to create `tree_storage`
- `gen(...)` to populate it later

## Open questions

- when CLI should call all available hooks vs only a selected set of loaded plugins
- how hook execution should be tracked long-term (always idempotent vs state-driven detection)
- whether these two hooks should eventually collapse into a more generic lifecycle model later
