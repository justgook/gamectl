-- +goose Up
-- Migration: settings
-- Key-value settings store with category grouping

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general'
);

-- Default appearance settings
INSERT OR IGNORE INTO settings (key, value, category) VALUES
    ('appearance.theme', 'dark', 'appearance'),
    ('appearance.font-family', 'Roboto Mono, monospace', 'appearance'),
    ('appearance.font-size', '14', 'appearance');
