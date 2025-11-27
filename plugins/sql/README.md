# SQL Plugin

A full-featured SQL database plugin implemented in C with embedded SQLite3 that demonstrates the WPM (WebAssembly Plugin Manager) Plugin Development Kit (PDK) for C.

## Features

- **Full SQLite3 Database**: Complete SQL database engine compiled to WebAssembly
- **In-Memory Database**: Fast, ephemeral database perfect for procedural generation
- **Standard SQL**: Supports CREATE, INSERT, UPDATE, DELETE, SELECT, and more
- **PDK Integration**: Uses PDK for input/output while leveraging SQLite3's internal memory management
- **WASI Target**: Built with wasm32-wasi for libc support required by SQLite3

## Functions

### `open`
Initialize and open an in-memory SQLite3 database.
- **Input**: None
- **Output**: `"OK"` on success, error message on failure
- **Note**: Must be called before any other SQL operations

### `exec`
Execute non-SELECT SQL statements (CREATE, INSERT, UPDATE, DELETE, etc.).
- **Input**: SQL statement as string
- **Output**: `"OK"` on success, error message on failure
- **Example Input**: `"CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"`

### `query`
Execute SELECT queries and return results in CSV format.
- **Input**: SELECT SQL statement as string
- **Output**: CSV-formatted results with header row
- **Format**: `"col1,col2,col3\nval1,val2,val3\n..."`
- **Example Input**: `"SELECT * FROM users"`
- **Example Output**: `"id,name\n1,Alice\n2,Bob\n"`

### `dump`
Export the entire database as SQL statements (like `pg_dump` or SQLite `.dump`).
- **Input**: None
- **Output**: Complete SQL dump including schema and data
- **Format**: SQL statements that can recreate the database
- **Example Output**: 
```sql
-- SQLite database dump
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, value INTEGER);

INSERT INTO items VALUES(1,'sword',100);
INSERT INTO items VALUES(2,'shield',75);

COMMIT;
```

### `backup`
Create a binary backup using optimized SQL format (based on SQLite backup API concepts).
- **Input**: None
- **Output**: Compact binary-style backup with special markers
- **Format**: Optimized SQL with binary backup headers for fast restore
- **Use Case**: IDE state persistence, quick save/restore
- **Example Output**:
```sql
-- BINARY_BACKUP_V1
-- Generated from binary backup
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, value INTEGER);

INSERT INTO items VALUES(1,'sword',100);
INSERT INTO items VALUES(2,'shield',75);

COMMIT;
-- END_BINARY_BACKUP_V1
```

### `load`
Load database from a binary backup created by the `backup` function.
- **Input**: Binary backup string (output from `backup` function)
- **Output**: `"Binary backup loaded successfully"` on success, error message on failure
- **Note**: Validates binary backup format before loading

### `restore`
Restore database from a SQL dump created by the `dump` function.
- **Input**: SQL dump string (output from `dump` function)
- **Output**: `"Database restored successfully"` on success, error message on failure
- **Note**: Executes the entire dump as a transaction

### `close`
Close the database connection and free resources.
- **Input**: None
- **Output**: `"OK"`

### `info`
Returns information about the plugin.
- **Input**: None
- **Output**: Plugin description and version

## Implementation Details

- **Language**: C
- **Database**: SQLite3 (amalgamation build)
- **Target**: wasm32-wasi (requires WASI runtime)
- **Size**: ~4.2MB WASM file (includes full SQLite3 engine)
- **Memory**: Uses PDK allocator for plugin I/O, SQLite3's internal allocator for database operations
- **Features**:
  - Full SQL support (DDL, DML, queries)
  - In-memory database (`:memory:`)
  - CSV result formatting
  - Error handling with descriptive messages
  - Optimized SQLite3 build flags

## SQLite3 Configuration

The plugin uses optimized SQLite3 compile-time options:

- `SQLITE_OMIT_LOAD_EXTENSION`: No dynamic extension loading
- `SQLITE_THREADSAFE=0`: Single-threaded (WASM is single-threaded)
- `SQLITE_OMIT_WAL`: No Write-Ahead Logging
- `SQLITE_TEMP_STORE=3`: Use memory for temporary storage
- `SQLITE_OMIT_DEPRECATED`: Remove deprecated features
- `SQLITE_OMIT_SHARED_CACHE`: No shared cache mode
- Additional optimizations for size and performance

## Building

The plugin is automatically built when running `make plugins-release` from the project root.

**Requirements**: Zig compiler with WASI libc support

```bash
# Build all plugins
make plugins-release

# Build only SQL plugin
make build.nosync/sql.wasm
```

### Build Process

The Makefile includes a special rule for the SQL plugin that:
1. Compiles both `main.c` and `sqlite3.c` together
2. Links with WASI libc (`-lc`)
3. Applies SQLite3 optimization flags
4. Produces a single `sql.wasm` file

## Usage Examples

### Basic Workflow

```javascript
// 1. Open database
manager.call('sql', 'open', '')
// Returns: "OK"

// 2. Create table
manager.call('sql', 'exec', 'CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)')
// Returns: "OK"

// 3. Insert data
manager.call('sql', 'exec', "INSERT INTO items (name, value) VALUES ('sword', 100)")
manager.call('sql', 'exec', "INSERT INTO items (name, value) VALUES ('shield', 75)")
// Returns: "OK"

// 4. Query data
manager.call('sql', 'query', 'SELECT * FROM items WHERE value > 50')
// Returns: "id,name,value\n1,sword,100\n2,shield,75\n"

// 5. Backup database
const dumpResult = manager.call('sql', 'dump', '')
const sqlDump = new TextDecoder().decode(dumpResult.output)
localStorage.setItem('my-game-backup', sqlDump)
// Save dump for later restoration

// 6. Update data
manager.call('sql', 'exec', "UPDATE items SET value = 120 WHERE name = 'sword'")
// Returns: "OK"

// 7. Restore from backup (if needed)
const savedDump = localStorage.getItem('my-game-backup')
manager.call('sql', 'restore', savedDump)
// Returns: "Database restored successfully"

// 8. Close database
manager.call('sql', 'close', '')
// Returns: "OK"
```

### Backup and Restore Workflows

#### **SQL Dump/Restore** (Human-readable, version control friendly)

```javascript
// Create SQL dump for version control
async function createSqlDump() {
  const dumpResult = await manager.call('sql', 'dump', '')
  const sqlDump = new TextDecoder().decode(dumpResult.output)
  
  // Save to localStorage
  localStorage.setItem('game-sql-backup-' + Date.now(), sqlDump)
  
  // Download as .sql file for version control
  const blob = new Blob([sqlDump], { type: 'text/sql' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'procedural-world.sql'
  a.click()
  
  return sqlDump
}

// Restore from SQL dump
async function restoreFromSqlDump(sqlDump) {
  await manager.call('sql', 'open', '')
  const result = await manager.call('sql', 'restore', sqlDump)
  console.log(new TextDecoder().decode(result.output))
}
```

#### **Binary Backup/Load** (Fast, IDE state persistence)

```javascript
// Create binary backup for fast state saving
async function createBinaryBackup() {
  const backupResult = await manager.call('sql', 'backup', '')
  const binaryBackup = new TextDecoder().decode(backupResult.output)
  
  // Save to localStorage for IDE state
  localStorage.setItem('ide-state-backup', binaryBackup)
  
  return binaryBackup
}

// Load binary backup for fast restoration
async function loadBinaryBackup() {
  const binaryBackup = localStorage.getItem('ide-state-backup')
  if (binaryBackup) {
    await manager.call('sql', 'open', '')
    const result = await manager.call('sql', 'load', binaryBackup)
    console.log('IDE state restored:', new TextDecoder().decode(result.output))
  }
}

// Auto-save on page unload
window.addEventListener('beforeunload', async () => {
  await createBinaryBackup()
})

// Auto-restore on page load
window.addEventListener('load', async () => {
  await loadBinaryBackup()
})
```

#### **Utility Functions**

```javascript
// List all backups in localStorage
function listBackups() {
  const sqlBackups = Object.keys(localStorage)
    .filter(key => key.startsWith('game-sql-backup-'))
    .sort()
  
  const binaryBackups = Object.keys(localStorage)
    .filter(key => key.includes('ide-state-backup'))
  
  return { sqlBackups, binaryBackups }
}

// Compare backup sizes
function compareBackupSizes() {
  const sqlDump = localStorage.getItem('game-sql-backup-latest')
  const binaryBackup = localStorage.getItem('ide-state-backup')
  
  return {
    sql: sqlDump ? sqlDump.length : 0,
    binary: binaryBackup ? binaryBackup.length : 0
  }
}
```

### Procedural Generation Use Case

```javascript
// Generate a procedural world with biomes
manager.call('sql', 'open', '')

// Create biome table
manager.call('sql', 'exec', `
  CREATE TABLE biomes (
    id INTEGER PRIMARY KEY,
    name TEXT,
    temperature INTEGER,
    humidity INTEGER,
    rarity INTEGER
  )
`)

// Insert biome data
manager.call('sql', 'exec', "INSERT INTO biomes VALUES (1, 'desert', 90, 10, 20)")
manager.call('sql', 'exec', "INSERT INTO biomes VALUES (2, 'forest', 60, 70, 40)")
manager.call('sql', 'exec', "INSERT INTO biomes VALUES (3, 'tundra', 10, 30, 15)")

// Query for hot, dry biomes
const result = manager.call('sql', 'query', 
  'SELECT name FROM biomes WHERE temperature > 70 AND humidity < 30'
)
// Returns: "name\ndesert\n"

// Complex query with aggregation
manager.call('sql', 'query', 
  'SELECT AVG(temperature) as avg_temp, COUNT(*) as count FROM biomes'
)
// Returns: "avg_temp,count\n53.333333,3\n"
```

### Advanced SQL Features

```javascript
// Joins
manager.call('sql', 'exec', `
  CREATE TABLE regions (id INTEGER, biome_id INTEGER, x INTEGER, y INTEGER)
`)
manager.call('sql', 'query', `
  SELECT r.x, r.y, b.name 
  FROM regions r 
  JOIN biomes b ON r.biome_id = b.id
`)

// Aggregations
manager.call('sql', 'query', `
  SELECT biome_id, COUNT(*) as region_count 
  FROM regions 
  GROUP BY biome_id
`)

// Subqueries
manager.call('sql', 'query', `
  SELECT * FROM biomes 
  WHERE rarity > (SELECT AVG(rarity) FROM biomes)
`)
```

## Comparison with Math Plugin

| Feature | Math Plugin | SQL Plugin |
|---------|-------------|------------|
| **Target** | wasm32-freestanding | wasm32-wasi |
| **Dependencies** | None (bare WASM) | WASI libc |
| **Size** | ~18KB | ~4.2MB |
| **Memory** | PDK only | PDK + SQLite3 allocator |
| **Use Case** | Simple calculations | Complex data queries |

## Limitations

1. **In-Memory Only**: Database is ephemeral by default (but can be backed up with `dump`/`restore`)
2. **No Direct File I/O**: Cannot save to disk directly (use `dump` + localStorage/server instead)
3. **Size**: Large WASM file (~4.2MB) due to full SQLite3 engine
4. **WASI Required**: Host must support WASI runtime
5. **Dump Size**: Large databases may exceed output buffer limits (32KB currently)

## Future Enhancements

- [x] **Database dump/restore functionality** (✅ IMPLEMENTED)
- [ ] Larger dump buffer sizes for big databases
- [ ] Incremental/differential backups
- [ ] JSON output format option for dumps
- [ ] Prepared statement caching
- [ ] Advanced transaction support
- [ ] Custom SQL functions via PDK callbacks
- [ ] Binary database serialization (smaller than SQL dumps)
- [ ] Compression for dumps

## Technical Notes

### Why WASI Instead of Bare WASM?

Unlike the Math plugin which uses bare WASM (`wasm32-freestanding`), the SQL plugin requires WASI because:

1. **SQLite3 Dependencies**: SQLite3 uses standard C library functions (stdio, stdlib, string.h)
2. **File System Abstraction**: SQLite3's VFS (Virtual File System) expects POSIX-like APIs
3. **Memory Management**: SQLite3 has its own sophisticated memory allocator
4. **Complexity**: Reimplementing all libc functions for bare WASM would be impractical

### Memory Management Strategy

The plugin uses a hybrid approach:
- **PDK Allocator**: For plugin input/output buffers
- **SQLite3 Allocator**: For internal database operations (can be configured to use PDK via `sqlite3_config`)
- **WASI libc**: For standard C library functions

### Performance Considerations

- In-memory database is very fast (no disk I/O)
- CSV formatting is simple but not the most efficient
- Consider using binary formats for large result sets
- Query complexity affects performance (use EXPLAIN QUERY PLAN)

## License

This plugin uses SQLite3, which is in the public domain.
See: https://www.sqlite.org/copyright.html
