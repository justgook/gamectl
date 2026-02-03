-- +goose Up
-- Migration: pipeline_storage
-- Pipeline storage table for nodegraph save/load

CREATE TABLE IF NOT EXISTS pipeline_storage (
    name TEXT PRIMARY KEY,        -- Pipeline name (user-provided)
    node_count INTEGER NOT NULL,  -- Number of nodes (for display)
    html_content TEXT NOT NULL,   -- Serialized HTML of all node-* elements
    created_at TEXT DEFAULT (datetime('now'))
);
