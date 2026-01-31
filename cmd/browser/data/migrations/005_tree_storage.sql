-- +goose Up
-- Migration: tree_storage
-- Tree storage table to replace tree-storage plugin

CREATE TABLE IF NOT EXISTS tree_storage (
    name TEXT PRIMARY KEY,     -- Tree identifier (e.g., 'progression', 'sample-oak')
    data TEXT NOT NULL         -- JSON data as-is from current tree-storage format
);
