-- +goose Up
-- Migration: nodegraph2_storage
-- JSON storage for nodegraph2 view snapshots

CREATE TABLE IF NOT EXISTS nodegraph2_storage (
    name TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    node_count INTEGER NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);
