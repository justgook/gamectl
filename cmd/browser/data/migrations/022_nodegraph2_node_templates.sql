-- +goose Up
-- Migration: nodegraph2_node_templates
-- Reusable node templates for nodegraph2 add-node presets

CREATE TABLE IF NOT EXISTS nodegraph2_node_templates (
    name TEXT PRIMARY KEY,
    kind INTEGER NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);
