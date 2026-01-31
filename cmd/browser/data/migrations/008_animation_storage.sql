-- +goose Up
-- Migration: animation_storage
-- Animation storage for sprite animations

CREATE TABLE IF NOT EXISTS animation_storage (
    source_file TEXT NOT NULL,
    start_frame INTEGER NOT NULL,
    tile_width INTEGER NOT NULL DEFAULT 16,
    tile_height INTEGER NOT NULL DEFAULT 16,
    data TEXT NOT NULL,  -- JSON: { frames: [{tileId, duration}], loop }
    PRIMARY KEY (source_file, start_frame)
);
