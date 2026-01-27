-- Animation storage for sprite animations
-- Each animation is stored as JSON with spritesheet reference, tile dimensions, and frame sequence

CREATE TABLE IF NOT EXISTS animation_storage (
    name TEXT PRIMARY KEY,
    data TEXT NOT NULL  -- JSON: { spritesheet, tileWidth, tileHeight, frames: [{tileId, duration}], loop }
);
