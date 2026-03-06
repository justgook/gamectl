-- +goose Up
-- Migration: keybinding_overrides
-- Clean break: defaults are declared in view classes, DB stores only overrides

DROP TABLE IF EXISTS keybindings;

CREATE TABLE IF NOT EXISTS keybinding_overrides (
    binding_id TEXT PRIMARY KEY,
    keys TEXT,
    enabled INTEGER
);
