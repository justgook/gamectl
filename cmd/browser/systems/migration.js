/**
 * Database Migration System
 * 
 * Goose-style migration system for SQLite database.
 * Manages schema versions and applies migrations incrementally.
 * 
 * Migration file format:
 * - Filename: 001_name.sql, 002_name.sql, etc.
 * - Content: SQL statements (goose Up section only for now)
 * 
 * Features:
 * - Tracks current schema version in database
 * - Loads binary database from OPFS if available
 * - Runs only pending migrations
 * - Saves database binary on demand
 */

import { bus } from './event-bus.js'
import { toast } from './toast.js'

// Constants
const DATABASE_PATH = '/database.sqlite'
const MIGRATIONS_PATH = '/data/migrations'

// Text decoder for SQL plugin output
const decoder = new TextDecoder()

/**
 * MigrationManager
 * 
 * Handles database initialization, migration execution, and persistence.
 */
class MigrationManager {
  constructor() {
    this.currentVersion = 0
    this.migrations = []
    this.initialized = false
  }

  /**
   * Initialize the database
   * - Try to load from binary file first
   * - If no binary exists, run all migrations
   * - Check for pending migrations and apply them
   */
  async init() {
    console.log('[Migration] Initializing database...')

    // The SQL plugin opens its empty in-memory database during plugin load.

    // Check if binary database exists
    const exists = await this.databaseExists()

    if (exists) {
      console.log('[Migration] Found existing database, loading from binary...')
      const loaded = await this.loadDatabase()

      if (loaded) {
        // Get current version from loaded database
        this.currentVersion = await this.getSchemaVersion()
        console.log(`[Migration] Loaded database at version ${this.currentVersion}`)
      } else {
        console.warn('[Migration] Failed to load binary database, starting fresh')
        this.currentVersion = 0
      }
    } else {
      console.log('[Migration] No existing database, will run all migrations')
      this.currentVersion = 0
    }

    // Ensure schema_version table exists
    await this.ensureSchemaVersionTable()

    // Load and run pending migrations
    await this.loadMigrations()
    await this.runPendingMigrations()

    // Setup file:save listener
    this.setupSaveListener()

    this.initialized = true
    console.log('[Migration] Database initialization complete')

    return true
  }

  /**
   * Check if database binary file exists in OPFS
   */
  async databaseExists() {
    try {
      const result = await window.pluginManager.call('fs', 'exists', DATABASE_PATH)
      const output = decoder.decode(result.output)
      return output.trim() === 'true'
    } catch (error) {
      console.error('[Migration] Error checking database existence:', error)
      return false
    }
  }

  /**
   * Load database from binary file
   */
  async loadDatabase() {
    try {
      const result = await window.pluginManager.call('sql', 'load_binary', DATABASE_PATH)
      const output = decoder.decode(result.output)
      return output.includes('OK')
    } catch (error) {
      console.error('[Migration] Error loading database:', error)
      return false
    }
  }

  /**
   * Save database to binary file
   */
  async saveDatabase() {
    try {
      console.log('[Migration] Saving database to binary...')
      const result = await window.pluginManager.call('sql', 'save_binary', DATABASE_PATH)
      const output = decoder.decode(result.output)

      if (output.includes('OK')) {
        console.log('[Migration] Database saved successfully')
        toast.success('Database saved')
        return true
      } else {
        console.error('[Migration] Failed to save database:', output)
        toast.error('Failed to save database')
        return false
      }
    } catch (error) {
      console.error('[Migration] Error saving database:', error)
      toast.error('Error saving database')
      return false
    }
  }

  /**
   * Ensure schema_version table exists
   */
  async ensureSchemaVersionTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `
    try {
      await window.pluginManager.call('sql', 'exec', sql)
    } catch (error) {
      console.error('[Migration] Error creating schema_version table:', error)
    }
  }

  /**
   * Get current schema version from database
   */
  async getSchemaVersion() {
    try {
      // First check if table exists
      const tableCheck = await window.pluginManager.call('sql', 'query',
        "SELECT name FROM sqlite_schema WHERE type='table' AND name='schema_version'"
      )
      const tableOutput = decoder.decode(tableCheck.output)

      if (!tableOutput.includes('schema_version')) {
        return 0
      }

      const result = await window.pluginManager.call('sql', 'query',
        'SELECT COALESCE(MAX(version), 0) as version FROM schema_version'
      )
      const output = decoder.decode(result.output)

      // Parse CSV output (header + data row)
      const lines = output.trim().split('\n')
      if (lines.length >= 2) {
        const version = parseInt(lines[1], 10)
        return isNaN(version) ? 0 : version
      }
      return 0
    } catch (error) {
      console.error('[Migration] Error getting schema version:', error)
      return 0
    }
  }

  /**
   * Record migration in schema_version table
   */
  async recordMigration(version, name) {
    const sql = `INSERT INTO schema_version (version, name) VALUES (${version}, '${name.replace(/'/g, "''")}');`
    try {
      await window.pluginManager.call('sql', 'exec', sql)
    } catch (error) {
      console.error(`[Migration] Error recording migration ${version}:`, error)
    }
  }

  /**
   * Load migration files from server
   */
  async loadMigrations() {
    try {
      // Fetch migration index
      const response = await fetch(`${MIGRATIONS_PATH}/index.json`)
      if (!response.ok) {
        console.error('[Migration] Failed to load migration index')
        return
      }

      const index = await response.json()
      this.migrations = index.migrations || []

      console.log(`[Migration] Found ${this.migrations.length} migrations`)
    } catch (error) {
      console.error('[Migration] Error loading migrations:', error)
      this.migrations = []
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations() {
    const pending = this.migrations.filter(m => m.version > this.currentVersion)

    if (pending.length === 0) {
      console.log('[Migration] No pending migrations')
      return
    }

    console.log(`[Migration] Running ${pending.length} pending migrations...`)

    // Sort by version
    pending.sort((a, b) => a.version - b.version)

    for (const migration of pending) {
      await this.runMigration(migration)
    }

    this.currentVersion = pending[pending.length - 1].version
    console.log(`[Migration] All migrations complete, now at version ${this.currentVersion}`)
  }

  /**
   * Run a single migration
   */
  async runMigration(migration) {
    console.log(`[Migration] Running migration ${migration.version}: ${migration.name}`)

    try {
      // Fetch migration SQL
      const response = await fetch(`${MIGRATIONS_PATH}/${migration.file}`)
      if (!response.ok) {
        console.error(`[Migration] Failed to fetch ${migration.file}`)
        return false
      }

      const sql = await response.text()

      // Execute migration
      const result = await window.pluginManager.call('sql', 'restore', sql)
      console.log(`[Migration] Executed ${migration.file}:`, decoder.decode(result.output))

      // Record in schema_version
      await this.recordMigration(migration.version, migration.name)

      return true
    } catch (error) {
      console.error(`[Migration] Error running migration ${migration.version}:`, error)
      return false
    }
  }

  /**
   * Setup file:save event listener
   */
  setupSaveListener() {
    bus.on('file:save', async () => {
      if (this.initialized) {
        await this.saveDatabase()
      }
    })
    console.log('[Migration] Registered file:save listener')
  }

  /**
   * Get migration status
   */
  getStatus() {
    return {
      currentVersion: this.currentVersion,
      totalMigrations: this.migrations.length,
      pendingMigrations: this.migrations.filter(m => m.version > this.currentVersion).length,
      initialized: this.initialized
    }
  }
}

// Export singleton
export const migrationManager = new MigrationManager()
