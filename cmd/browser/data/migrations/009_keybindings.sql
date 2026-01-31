-- +goose Up
-- Migration: keybindings
-- Keybindings for macOS
-- Following Vim-style key notation

CREATE TABLE IF NOT EXISTS keybindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,              -- Context/mode (e.g., 'global', 'nodegraph', 'tilemap', 'tree', 'console')
    keys TEXT NOT NULL,              -- Vim-style key format: '<C-s>', '<M-j>', 'gg', etc.
    event_name TEXT NOT NULL,        -- Event bus event name (e.g., 'file:save', 'node:create')
    event_data TEXT,                 -- JSON data to send with event (optional)
    description TEXT,                -- Human-readable description
    enabled INTEGER DEFAULT 1,       -- Whether the keybinding is active (0 or 1)
    UNIQUE(mode, keys)               -- Same keys can have different actions in different modes
);

-- Global shortcuts (work everywhere)
INSERT INTO keybindings (mode, keys, event_name, description) VALUES
('global', '<C-s>', 'file:save', 'Save current work'),
('global', '<C-z>', 'editor:undo', 'Undo last action'),
('global', '<C-S-z>', 'editor:redo', 'Redo last action'),
('global', '<C-r>', 'app:reload', 'Reload application'),
('global', '<C-w>', 'file:close', 'Close current view'),
('global', '<C-q>', 'app:quit', 'Quit application'),
('global', '<C-,>', 'app:settings', 'Open settings');

-- Node graph mode shortcuts
INSERT INTO keybindings (mode, keys, event_name, description) VALUES
('nodegraph', '<C-n>', 'node:create', 'Create new node'),
('nodegraph', '<Del>', 'node:delete', 'Delete selected nodes'),
('nodegraph', '<BS>', 'node:delete', 'Delete selected nodes (backspace)'),
('nodegraph', '<C-CR>', 'node:run', 'Run node graph'),
('nodegraph', '<C-=>', 'view:zoom-in', 'Zoom in'),
('nodegraph', '<C-->', 'view:zoom-out', 'Zoom out'),
('nodegraph', '<C-0>', 'view:zoom-fit', 'Fit view to content'),
('nodegraph', '<C-a>', 'node:select-all', 'Select all nodes'),
('nodegraph', '<C-d>', 'node:duplicate', 'Duplicate selected nodes'),
('nodegraph', '<C-f>', 'node:find', 'Find node'),
('nodegraph', 'gg', 'view:goto-top', 'Go to top of graph'),
('nodegraph', 'G', 'view:goto-bottom', 'Go to bottom of graph');

-- Tilemap mode shortcuts
INSERT INTO keybindings (mode, keys, event_name, description) VALUES
('tilemap', '<C-=>', 'view:zoom-in', 'Zoom in'),
('tilemap', '<C-->', 'view:zoom-out', 'Zoom out'),
('tilemap', '<C-0>', 'view:zoom-fit', 'Fit view to content'),
('tilemap', '<Space>', 'tilemap:toggle-grid', 'Toggle grid visibility'),
('tilemap', 'h', 'tilemap:pan-left', 'Pan left'),
('tilemap', 'j', 'tilemap:pan-down', 'Pan down'),
('tilemap', 'k', 'tilemap:pan-up', 'Pan up'),
('tilemap', 'l', 'tilemap:pan-right', 'Pan right');

-- Tree/minimap mode shortcuts
INSERT INTO keybindings (mode, keys, event_name, description) VALUES
('tree', '<C-=>', 'view:zoom-in', 'Zoom in'),
('tree', '<C-->', 'view:zoom-out', 'Zoom out'),
('tree', '<C-0>', 'view:zoom-fit', 'Fit view to content'),
('tree', '<Space>', 'tree:expand-collapse', 'Toggle node expansion');

-- Console mode shortcuts
INSERT INTO keybindings (mode, keys, event_name, description) VALUES
('console', '<C-l>', 'console:clear', 'Clear console'),
('console', '<C-k>', 'console:clear', 'Clear console (alternate)');

-- Animation editor mode shortcuts
INSERT INTO keybindings (mode, keys, event_name, description) VALUES
('animation-editor', '<Space>', 'animation:playback:toggle', 'Play/pause animation'),
('animation-editor', '<Del>', 'animation:frame:delete', 'Delete selected frames'),
('animation-editor', '<BS>', 'animation:frame:delete', 'Delete selected frames (backspace)'),
('animation-editor', '<C-a>', 'animation:frame:select-all', 'Select all frames'),
('animation-editor', '<C-s>', 'animation:save', 'Save animation'),
('animation-editor', '<Esc>', 'animation:selection:clear', 'Clear selection');
