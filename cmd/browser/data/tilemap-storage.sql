-- Tilemap storage table to replace tilemap-storage plugin
-- This table stores tilemap structures as JSON data with simple name-based access
CREATE TABLE IF NOT EXISTS tilemap_storage (
    name TEXT PRIMARY KEY,     -- Tilemap identifier (e.g., 'new_map', 'rules-basic-walls')
    data TEXT NOT NULL         -- JSON data as-is from current tilemap-storage format
);