-- Animation storage for sprite animations
-- Each animation is identified by source file + starting frame index
-- This allows one animation per starting tile per spritesheet

-- Drop old schema (migration from name-based to composite key)
DROP TABLE IF EXISTS animation_storage;

CREATE TABLE IF NOT EXISTS animation_storage (
    source_file TEXT NOT NULL,
    start_frame INTEGER NOT NULL,
    tile_width INTEGER NOT NULL DEFAULT 16,
    tile_height INTEGER NOT NULL DEFAULT 16,
    data TEXT NOT NULL,  -- JSON: { frames: [{tileId, duration}], loop }
    PRIMARY KEY (source_file, start_frame)
);
