-- Tree storage table to replace tree-storage plugin
-- This table stores tree structures as JSON data with simple name-based access
CREATE TABLE IF NOT EXISTS tree_storage (
    name TEXT PRIMARY KEY,     -- Tree identifier (e.g., 'progression', 'sample-oak')
    data TEXT NOT NULL         -- JSON data as-is from current tree-storage format
);