PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tileset (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL UNIQUE,
    display_name TEXT,
    description TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tileset_image_source (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tileset_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,

    tile_width INTEGER NOT NULL CHECK (tile_width > 0),
    tile_height INTEGER NOT NULL CHECK (tile_height > 0),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tileset_id) REFERENCES tileset(id) ON DELETE CASCADE,

    UNIQUE (tileset_id, image_path),
    UNIQUE (id, tileset_id)
);

CREATE TABLE IF NOT EXISTS tile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tileset_id INTEGER NOT NULL,
    image_source_id INTEGER NOT NULL,

    -- Dual-grid mask for MVP. Valid masks are 1-15; 0b0000 means empty and is not stored.
    -- Bit layout: 0b1000 = top-left, 0b0100 = top-right,
    -- 0b0010 = bottom-left, 0b0001 = bottom-right.
    mask INTEGER NOT NULL CHECK (mask >= 1 AND mask <= 15),

    -- One-based linear tile index in the source image. For the current demo tilesets,
    -- tile_index 1 maps to mask 0b0001, tile_index 15 maps to mask 0b1111.
    -- Pixel coordinates are derived from the source image dimensions plus
    -- tileset_image_source tile size.
    tile_index INTEGER NOT NULL CHECK (tile_index >= 1),

    -- Main tile is variant_index = 0. Alternatives use variant_index > 0.
    variant_index INTEGER NOT NULL DEFAULT 0 CHECK (variant_index >= 0),

    -- Weighted random selection between variants.
    weight INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),

    name TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tileset_id) REFERENCES tileset(id) ON DELETE CASCADE,
    FOREIGN KEY (image_source_id, tileset_id)
        REFERENCES tileset_image_source(id, tileset_id)
        ON DELETE CASCADE,

    UNIQUE (tileset_id, mask, variant_index)
);

CREATE INDEX IF NOT EXISTS idx_tileset_image_source_tileset
ON tileset_image_source (tileset_id);

CREATE INDEX IF NOT EXISTS idx_tile_tileset_mask
ON tile (tileset_id, mask);

CREATE INDEX IF NOT EXISTS idx_tile_image_source
ON tile (image_source_id);

CREATE TABLE IF NOT EXISTS sprite (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL UNIQUE,
    display_name TEXT,
    description TEXT,

    -- Source image/authoring file. MVP may use .aseprite, later may use qoi/png/etc.
    image_path TEXT NOT NULL,

    -- Tile footprint for placement/generation compatibility.
    grid_width INTEGER NOT NULL CHECK (grid_width > 0),
    grid_height INTEGER NOT NULL CHECK (grid_height > 0),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (image_path)
);

CREATE TABLE IF NOT EXISTS sprite_animation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    sprite_id INTEGER NOT NULL,

    name TEXT NOT NULL,

    -- Zero-based frame indexes matching the Aseprite plugin/runtime frame API.
    start_frame INTEGER NOT NULL CHECK (start_frame >= 0),
    end_frame INTEGER NOT NULL CHECK (end_frame >= start_frame),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (sprite_id) REFERENCES sprite(id) ON DELETE CASCADE,

    UNIQUE (sprite_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sprite_animation_sprite
ON sprite_animation (sprite_id);
