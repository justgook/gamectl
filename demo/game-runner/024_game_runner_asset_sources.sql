-- +goose Up
-- Migration: game_runner_asset_sources
-- Persisted asset path to source mappings for the game runner view

CREATE TABLE IF NOT EXISTS game_runner_asset_sources (
    asset_path TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO game_runner_asset_sources (asset_path, source, updated_at) VALUES 
  ('/game/clear-color.rgb', 'local:/example/floor-16x16.png', datetime('now')),
  ('/game/the_atlas.qoi', 'local:/assets/game/the_atlas.qoi', datetime('now')),
  ('/game/lut.qoi', 'local:/assets/game/lut.qoi', datetime('now')),
  ('/game/data.rspk', 'local:/assets/game/data.rspk', datetime('now'));
