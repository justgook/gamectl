# Yoinking: Asset Inventory + CastleDB tilesets for GAMS

Status: captured
Date: 2026-06-21
Source:
- https://assetstore.unity.com/packages/tools/utilities/asset-inventory-4-349582
- http://castledb.org
- User-described goal: an "Assets Inventory" for GAMS, somewhere between Unity Asset Inventory and CastleDB, starting with database-queryable dual-grid tilesets for generation workflows rather than tilemap/tileset editing.

## Source summary

Unity Asset Inventory appears to be an asset catalog/search/inventory utility for Unity projects. The public page exposes limited detail without interactive marketplace context, but the adaptation target is asset discovery and management rather than a game-data editor alone.

CastleDB is a game-data editor with spreadsheet-like sheets plus a 2D map editor. Its level editor can use typed game data as visual references, supports tile layers, object/list/zone layers, per-tile properties, tile palette workflows, random tile painting, and tileset-backed display.

## What we like

- Asset inventory/catalog framing: assets should be searchable, inspectable, queryable, and reusable across workflows.
- Database-first asset records can feed game generation, not only human browsing/editing.
- CastleDB's unified game-content workflow is useful inspiration for typed records and visual references, but GAMS already has internal views/plugins for tileset/tilemap editing.
- Tileset-first scope is small enough to become a useful vertical slice.
- Per-tile metadata/properties are important for generation workflows such as collision, terrain kind, tags, biome compatibility, rules, and selection weights.
- Query-result views can become configurable CMS/search surfaces rather than bespoke editors for every asset type.

## What we dislike / should avoid

- Avoid making this a tilemap/tileset editor; GAMS already has internal views/plugins for that.
- Avoid making GAMS only a level editor; asset inventory should stay broader than map painting.
- Avoid host-special-case behavior; GAMS direction prefers Plugin Manager-routed plugins/views.
- Avoid copying CastleDB storage details too early; use it as workflow inspiration, not as a binding schema.
- Avoid making the first slice depend on embeddings, semantic search, or AI indexing before basic database querying works.

## GAMS adaptation hypotheses

- Name candidate resolved for now as **Catalog**, or **Asset Catalog** when disambiguation is useful.
- Model the capability as a queryable Catalog Project Unit backed by records, not primarily as an editor.
- First view should be a simple Catalog view registered in `examples/demo/gams.json`, focused on querying/showing stored tileset records.
- Demo Project should get an `examples/demo/catalog/` folder for catalog assets, schema/seed files, and/or the project-local database.
- `examples/demo/` is the running demo Project root, so catalog paths should be Project-root-relative.
- The `catalog/` folder itself does not need to be a special config value; it is just a normal path prefix used by files such as the database, migration files, and `tileset_image_source.image_path`.
- Catalog creation for a new game may be a one-time migration/seed step. After the database exists, app reload/restart should use the existing database instead of recreating it.
- Start with only tileset tables rather than a generic `asset` root table; add generic assets later only if the need becomes clear.
- Search/meta is explicitly not v1. A future Catalog meta layer may be created per asset-like record and may support semantic search, but the MVP should not depend on it.
- MVP target is storing enough tileset/tile data for the game generation/runtime need to work.
- First model should use **three tables**: `tileset`, `tileset_image_source`, and `tile`.
- Image source is referenced from tile/source-reference level via `tile.image_source_id`, not treated as only tileset-level data.
- Avoid storing `image_width` / `image_height` in the database for MVP; those are derivable from the image file and would be denormalized state.
- Use `tile_index` as the canonical source reference for regular spritesheets/atlases; derive `(x, y)` and pixel coordinates from actual image dimensions and tile size at load/validation time.
- Treat dual-grid tiles as the first searchable catalog schema, not proof that GAMS needs a universal asset abstraction.
- First likely expansion after static tilesets is animated tilesets / animated tiles.
- Later extensions may add sprites, models, sounds, music, generic asset types, per-tile properties, terrain/autotile rules, search facets, importers, validation, thumbnails, embeddings, and generation-time search.

## Possible use in GAMS

- Users/workflows: game creators and generation pipelines searching for suitable assets, selecting tilesets by constraints, and feeding those records into procedural/content generation.
- Project Unit area: likely Project Composition for declaring the Asset Catalog unit/view and its query/result configuration in Project Config.
- Runtime area: likely Core Runtime through singleton plugins and View Plugins routed via the Plugin Manager.
- Browser UI area: a Core View for configured query filters and result rendering, not a full tileset/tilemap editor.
- Demo integration: register a `view-catalog` entry in `examples/demo/gams.json` and point it at project-root-relative database/migration files such as `catalog/catalog.sqlite` and `catalog/migrations/0001-tilesets.sql`; do not introduce a separate `catalogRoot` config.

## Risks / mismatches

- A four-table dual-grid schema may be too much for the MVP if `tileset + tile` is enough to make the game work.
- Deferring search/meta is good for focus, but the base tileset/tile fields should not block future metadata/semantic layers.
- If `tileset_image_source` is deferred, the `tile` table still needs a clear image source reference or the model becomes implicitly one-image-per-tileset.
- `tile_index` validation depends on reading image dimensions and checking divisibility by tile size at load/validation time.
- CastleDB's level-editor concepts may pull scope into map editing before inventory foundations are stable.

## Open questions for grilling

- Should **Catalog** be the official GAMS term, or should docs use **Asset Catalog** for clarity until the concept is established?
- Is `dual_grid_tile` the first-class MVP tile table, or should it be a generic `tile` table with dual-grid fields?
- Should `tile_width` / `tile_height` live on `tileset_image_source`, or on `tileset` if all sources in a tileset must share dimensions?
- Should static tiles be implemented first and animated tiles as the first follow-up slice, or should animation tables be included from day one?
- Should storage be SQLite-first, plugin-owned, or abstracted behind a GAMS data plugin contract?
- Should the one-time catalog creation artifact be a raw SQL migration/seed file, a JSON manifest imported by the view/plugin, or both?

## Conversion outcome

- Not yet converted.
