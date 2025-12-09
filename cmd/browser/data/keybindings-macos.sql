-- Keybindings for macOS
-- Following Vim-style key notation
--
-- Key Format:
--   <C-x>   - Cmd (⌘) key
--   <M-x>   - Option/Alt (⌥) key
--   <S-x>   - Shift (⇧) key
--   <D-x>   - Ctrl key (reserved for actual Control)
--   <CR>    - Enter
--   <Esc>   - Escape
--   <Space> - Space
--   <Tab>   - Tab
--   <BS>    - Backspace
--   <Del>   - Delete
--   <Up>, <Down>, <Left>, <Right> - Arrow keys
--   <F1>-<F12> - Function keys
--   gg, gd  - Multi-key sequences

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

-- Clear existing (for development - allows re-running)
DELETE FROM keybindings;

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
