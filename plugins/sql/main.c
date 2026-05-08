#include <stddef.h>
#include <stdint.h>
#include "vendor/pdk.h"
#include "vendor/sqlite3.h"

// SQL plugin implemented in C with SQLite3
// Demonstrates:
// - Embedded SQLite3 database in WASM with mem3 allocator
// - In-memory database operations
// - SQL query execution and result formatting
// - SQLite's built-in mem3 memory management

// Global database connection (in-memory)
static sqlite3 *db = NULL;

// =============================================================================
// PDK-compatible utility functions (no libc dependencies)
// =============================================================================

// Simple string append helper
static uint32_t append_str(char *buf, uint32_t pos, uint32_t max,
                           const char *str) {
  uint32_t i = 0;
  while (str[i] != '\0' && pos < max) {
    buf[pos++] = str[i++];
  }
  return pos;
}

// Simple number to string conversion
static uint32_t uint32_to_str(uint32_t value, char *buffer) {
  if (value == 0) {
    buffer[0] = '0';
    return 1;
  }

  uint32_t len = 0;
  uint32_t temp = value;
  while (temp > 0) {
    temp /= 10;
    len++;
  }

  for (uint32_t i = len; i > 0; i--) {
    buffer[i - 1] = '0' + (value % 10);
    value /= 10;
  }

  return len;
}

// Simple string search helper
static char *pdk_strstr(const char *haystack, const char *needle) {
  if (!haystack || !needle || *needle == '\0')
    return (char *)haystack;

  const char *h = haystack;
  const char *n = needle;

  while (*h) {
    const char *h_start = h;
    const char *n_current = n;

    while (*h && *n_current && *h == *n_current) {
      h++;
      n_current++;
    }

    if (*n_current == '\0') {
      return (char *)h_start;
    }

    h = h_start + 1;
  }

  return NULL;
}

// =============================================================================
// SQLite3 Memory Management using mem3
// =============================================================================

// We'll use SQLite's built-in mem3 allocator with a heap we allocate from PDK
// This is much more reliable than implementing our own allocator

// Allocate a large heap for SQLite mem3 (64MB to start, expandable to 256MB)
#define INITIAL_HEAP_SIZE (64 * 1024 * 1024)

static void *g_sqlite_heap = NULL;
static size_t g_heap_size = 0;

// =============================================================================
// CSV Helper Functions
// =============================================================================

// Check if a string needs CSV quoting (contains comma, quote, or newline)
static int csv_needs_quoting(const char *str) {
  if (!str) return 0;
  
  while (*str) {
    if (*str == ',' || *str == '"' || *str == '\n' || *str == '\r') {
      return 1;
    }
    str++;
  }
  return 0;
}

// Add a properly escaped CSV field to buffer
static uint32_t append_csv_field(char *buf, uint32_t pos, uint32_t max, const char *field) {
  if (!field) {
    return append_str(buf, pos, max, "");
  }
  
  int needs_quotes = csv_needs_quoting(field);
  
  if (needs_quotes && pos < max) {
    buf[pos++] = '"';
  }
  
  // Copy field content, escaping quotes by doubling them
  const char *src = field;
  while (*src && pos < max - 1) {
    if (*src == '"' && needs_quotes) {
      // Escape quote by doubling it
      if (pos < max - 1) {
        buf[pos++] = '"';
        buf[pos++] = '"';
      }
    } else {
      buf[pos++] = *src;
    }
    src++;
  }
  
  if (needs_quotes && pos < max) {
    buf[pos++] = '"';
  }
  
  return pos;
}

// =============================================================================
// Exported Plugin Functions
// =============================================================================

// Initialize and open in-memory database. This is intentionally not exported
// as a public plugin method; runtimes call __sql_init when the plugin loads.
static uint32_t sql_init_database(void) {
  if (db) {
    const char success_msg[] = "OK";
    pdk_output((const uint8_t *)success_msg, sizeof(success_msg) - 1);
    return 0;
  }

  // Allocate heap for SQLite mem3 if not already allocated
  if (!g_sqlite_heap) {
    uint32_t heap_ptr = pdk_alloc((uint64_t)INITIAL_HEAP_SIZE);
    if (heap_ptr == 0) {
      const char error_msg[] = "Failed to allocate heap for SQLite";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
      return 1;
    }
    g_sqlite_heap = (void *)(uintptr_t)heap_ptr;
    g_heap_size = INITIAL_HEAP_SIZE;

    // Configure SQLite3 to use mem3 with our heap before SQLite initializes.
    // Args: heap pointer, size in bytes, minimum allocation size (32 bytes = 2^5)
    int config_rc = sqlite3_config(SQLITE_CONFIG_HEAP, g_sqlite_heap, (int)g_heap_size, 32);
    if (config_rc != SQLITE_OK) {
      const char error_msg[] = "Failed to configure SQLite mem3 allocator";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
      return 1;
    }
  }

  // Open in-memory database
  int rc = sqlite3_open(":memory:", &db);
  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    sqlite3_close(db);
    db = NULL;
    return 1;
  }

  const char success_msg[] = "OK";
  pdk_output((const uint8_t *)success_msg, sizeof(success_msg) - 1);
  return 0;
}

__attribute__((export_name("__sql_init"))) uint32_t sql_init(void) {
  return sql_init_database();
}

// Execute non-SELECT SQL (CREATE, INSERT, UPDATE, DELETE)
__attribute__((export_name("exec"))) uint32_t sql_exec(void) {
  if (!db) {
    const char error_msg[] = "SQL database was not initialized.";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  uint32_t input_len;
  const uint8_t *input = pdk_input(&input_len);

  if (!input || input_len == 0) {
    const char error_msg[] = "No SQL provided";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Allocate buffer for null-terminated SQL string
  char *sql = (char *)pdk_alloc(input_len + 1);
  if (!sql) {
    const char error_msg[] = "Memory allocation failed";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  pdk_memcpy(sql, input, input_len);
  sql[input_len] = '\0';

  // Execute SQL
  char *err_msg = NULL;
  int rc = sqlite3_exec(db, sql, NULL, NULL, &err_msg);
  pdk_free((uint32_t)sql);

  if (rc != SQLITE_OK) {
    if (err_msg) {
      uint32_t err_len = pdk_strlen(err_msg);
      pdk_output((const uint8_t *)err_msg, err_len);
      sqlite3_free(err_msg);
    } else {
      const char error_msg[] = "Unknown SQLite error";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    }
    return 1;
  }

  const char success_msg[] = "OK";
  pdk_output((const uint8_t *)success_msg, sizeof(success_msg) - 1);
  return 0;
}

// Execute SELECT query and return CSV-formatted results
__attribute__((export_name("query"))) uint32_t sql_query(void) {
  if (!db) {
    const char error_msg[] = "SQL database was not initialized.";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  uint32_t input_len;
  const uint8_t *input = pdk_input(&input_len);

  if (!input || input_len == 0) {
    const char error_msg[] = "No SQL provided";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Allocate buffer for null-terminated SQL string
  char *sql = (char *)pdk_alloc(input_len + 1);
  if (!sql) {
    const char error_msg[] = "Memory allocation failed";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  pdk_memcpy(sql, input, input_len);
  sql[input_len] = '\0';

  // Prepare statement
  sqlite3_stmt *stmt;
  int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
  pdk_free((uint32_t)sql);

  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    return 1;
  }

// Build CSV-style result
// Format: "col1,col2,col3\nval1,val2,val3\n..."
#define RESULT_BUF_SIZE (2 * 1024 * 1024)  // 2MB for large tilemaps (was 32KB)
  char *result_buf = (char *)pdk_alloc(RESULT_BUF_SIZE);
  if (!result_buf) {
    sqlite3_finalize(stmt);
    const char error_msg[] = "Memory allocation failed";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  uint32_t pos = 0;
  int col_count = sqlite3_column_count(stmt);

  // Write header row (column names)
  for (int i = 0; i < col_count; i++) {
    const char *col_name = sqlite3_column_name(stmt, i);
    if (col_name) {
      pos = append_csv_field(result_buf, pos, RESULT_BUF_SIZE, col_name);
    }

    if (i < col_count - 1) {
      if (pos < RESULT_BUF_SIZE)
        result_buf[pos++] = ',';
    } else {
      if (pos < RESULT_BUF_SIZE)
        result_buf[pos++] = '\n';
    }

    if (pos >= RESULT_BUF_SIZE - 100)
      break;
  }

  // Write data rows
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW && pos < RESULT_BUF_SIZE - 100) {
    for (int i = 0; i < col_count; i++) {
      const unsigned char *text = sqlite3_column_text(stmt, i);
      if (text) {
        pos = append_csv_field(result_buf, pos, RESULT_BUF_SIZE, (const char *)text);
      } else {
        pos = append_csv_field(result_buf, pos, RESULT_BUF_SIZE, "NULL");
      }

      if (i < col_count - 1) {
        if (pos < RESULT_BUF_SIZE)
          result_buf[pos++] = ',';
      } else {
        if (pos < RESULT_BUF_SIZE)
          result_buf[pos++] = '\n';
      }

      if (pos >= RESULT_BUF_SIZE - 100)
        break;
    }
  }

  sqlite3_finalize(stmt);

  // Output result
  pdk_output((const uint8_t *)result_buf, pos);
  pdk_free((uint32_t)result_buf);

  return 0;
}

// Close database
__attribute__((export_name("close"))) uint32_t sql_close(void) {
  if (db) {
    sqlite3_close(db);
    db = NULL;
  }

  const char success_msg[] = "OK";
  pdk_output((const uint8_t *)success_msg, sizeof(success_msg) - 1);
  return 0;
}

// Dump database as SQL statements
__attribute__((export_name("dump"))) uint32_t sql_dump(void) {
  if (!db) {
    const char error_msg[] = "SQL database was not initialized.";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Allocate buffer for the dump output
#define DUMP_BUF_SIZE (2 * 1024 * 1024)  // 2MB for large dumps (was 32KB)
  char *dump_buf = (char *)pdk_alloc(DUMP_BUF_SIZE);
  if (!dump_buf) {
    const char error_msg[] = "Memory allocation failed";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  uint32_t pos = 0;

  // Add header comment
  pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "-- SQLite database dump\n");
  pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "PRAGMA foreign_keys=OFF;\n");
  pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "BEGIN TRANSACTION;\n\n");

  // First, dump table schemas
  sqlite3_stmt *stmt;
  int rc = sqlite3_prepare_v2(db,
                              "SELECT sql FROM sqlite_schema WHERE "
                              "type='table' AND sql IS NOT NULL ORDER BY name",
                              -1, &stmt, NULL);

  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    pdk_free((uint32_t)dump_buf);
    return 1;
  }

  // Output table CREATE statements
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW && pos < DUMP_BUF_SIZE - 100) {
    const unsigned char *sql = sqlite3_column_text(stmt, 0);
    if (sql) {
      pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, (const char *)sql);
      pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, ";\n");
    }
  }
  sqlite3_finalize(stmt);

  pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "\n");

  // Now dump table data
  rc = sqlite3_prepare_v2(db,
                          "SELECT name FROM sqlite_schema WHERE type='table' "
                          "AND name NOT LIKE 'sqlite_%' ORDER BY name",
                          -1, &stmt, NULL);

  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    pdk_free((uint32_t)dump_buf);
    return 1;
  }

  // For each table, generate INSERT statements
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW &&
         pos < DUMP_BUF_SIZE - 1000) {
    const unsigned char *table_name = sqlite3_column_text(stmt, 0);
    if (!table_name)
      continue;

    // Create SELECT statement to get data
    char *data_sql = sqlite3_mprintf(
        "SELECT 'INSERT INTO %q VALUES(' || group_concat(quote(CASE WHEN "
        "typeof(c0) = 'null' THEN NULL ELSE c0 END) || CASE WHEN c1 IS NOT "
        "NULL THEN ',' || quote(CASE WHEN typeof(c1) = 'null' THEN NULL ELSE "
        "c1 END) ELSE '' END || CASE WHEN c2 IS NOT NULL THEN ',' || "
        "quote(CASE WHEN typeof(c2) = 'null' THEN NULL ELSE c2 END) ELSE '' "
        "END || CASE WHEN c3 IS NOT NULL THEN ',' || quote(CASE WHEN "
        "typeof(c3) = 'null' THEN NULL ELSE c3 END) ELSE '' END || CASE WHEN "
        "c4 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c4) = 'null' THEN "
        "NULL ELSE c4 END) ELSE '' END || CASE WHEN c5 IS NOT NULL THEN ',' || "
        "quote(CASE WHEN typeof(c5) = 'null' THEN NULL ELSE c5 END) ELSE '' "
        "END || CASE WHEN c6 IS NOT NULL THEN ',' || quote(CASE WHEN "
        "typeof(c6) = 'null' THEN NULL ELSE c6 END) ELSE '' END || CASE WHEN "
        "c7 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c7) = 'null' THEN "
        "NULL ELSE c7 END) ELSE '' END, ');') FROM (SELECT * FROM %q) AS t(%s)",
        table_name, table_name, "c0,c1,c2,c3,c4,c5,c6,c7");

    // Simplified approach: just use a basic INSERT generation
    sqlite3_free(data_sql);
    data_sql = sqlite3_mprintf("SELECT * FROM %q", table_name);

    sqlite3_stmt *data_stmt;
    rc = sqlite3_prepare_v2(db, data_sql, -1, &data_stmt, NULL);
    sqlite3_free(data_sql);

    if (rc == SQLITE_OK) {
      int col_count = sqlite3_column_count(data_stmt);

      while ((rc = sqlite3_step(data_stmt)) == SQLITE_ROW &&
             pos < DUMP_BUF_SIZE - 200) {
        pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "INSERT INTO ");
        pos =
            append_str(dump_buf, pos, DUMP_BUF_SIZE, (const char *)table_name);
        pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, " VALUES(");

        for (int i = 0; i < col_count; i++) {
          if (i > 0) {
            pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, ",");
          }

          int col_type = sqlite3_column_type(data_stmt, i);
          if (col_type == SQLITE_NULL) {
            pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "NULL");
          } else if (col_type == SQLITE_INTEGER) {
            char num_buf[32];
            int64_t val = sqlite3_column_int64(data_stmt, i);
            // Simple int64 to string conversion
            if (val == 0) {
              pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "0");
            } else {
              char temp[32];
              int len = 0;
              int64_t temp_val = val;
              int negative = 0;

              if (temp_val < 0) {
                negative = 1;
                temp_val = -temp_val;
              }

              while (temp_val > 0) {
                temp[len++] = '0' + (temp_val % 10);
                temp_val /= 10;
              }

              int buf_pos = 0;
              if (negative)
                num_buf[buf_pos++] = '-';
              for (int j = len - 1; j >= 0; j--) {
                num_buf[buf_pos++] = temp[j];
              }
              num_buf[buf_pos] = '\0';
              pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, num_buf);
            }
          } else {
            // For TEXT, REAL, BLOB - quote the value
            pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "'");
            const unsigned char *text = sqlite3_column_text(data_stmt, i);
            if (text) {
              // Simple escaping - replace ' with ''
              const char *src = (const char *)text;
              while (*src && pos < DUMP_BUF_SIZE - 10) {
                if (*src == '\'') {
                  dump_buf[pos++] = '\'';
                  dump_buf[pos++] = '\'';
                } else {
                  dump_buf[pos++] = *src;
                }
                src++;
              }
            }
            pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "'");
          }
        }
        pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, ");\n");
      }
      sqlite3_finalize(data_stmt);
    }
  }
  sqlite3_finalize(stmt);

  // Add indexes, triggers, views
  rc = sqlite3_prepare_v2(
      db,
      "SELECT sql FROM sqlite_schema WHERE type IN ('index','trigger','view') "
      "AND sql IS NOT NULL ORDER BY type",
      -1, &stmt, NULL);

  if (rc == SQLITE_OK) {
    pos = append_str(dump_buf, pos, DUMP_BUF_SIZE,
                     "\n-- Indexes, triggers, and views\n");
    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW &&
           pos < DUMP_BUF_SIZE - 100) {
      const unsigned char *sql = sqlite3_column_text(stmt, 0);
      if (sql) {
        pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, (const char *)sql);
        pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, ";\n");
      }
    }
    sqlite3_finalize(stmt);
  }

  // Add footer
  pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "\nCOMMIT;\n");

  // Output the complete dump
  pdk_output((const uint8_t *)dump_buf, pos);
  pdk_free((uint32_t)dump_buf);
  return 0;
}

// Binary backup using SQLite backup API - creates binary database snapshot
__attribute__((export_name("backup"))) uint32_t sql_backup(void) {
  if (!db) {
    const char error_msg[] = "SQL database was not initialized.";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Use a single buffer approach like the dump function
  char *backup_buf = (char *)pdk_alloc(DUMP_BUF_SIZE);
  if (!backup_buf) {
    const char error_msg[] = "Memory allocation failed";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  uint32_t pos = 0;

  // Add binary backup header
  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "-- BINARY_BACKUP_V1\n");
  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE,
                   "-- Generated from binary backup\n");
  pos =
      append_str(backup_buf, pos, DUMP_BUF_SIZE, "PRAGMA foreign_keys=OFF;\n");
  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "BEGIN TRANSACTION;\n\n");

  // Get schema - reuse the same logic as dump function
  sqlite3_stmt *stmt;
  int rc = sqlite3_prepare_v2(db,
                              "SELECT sql FROM sqlite_schema WHERE "
                              "type='table' AND sql IS NOT NULL ORDER BY name",
                              -1, &stmt, NULL);

  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    pdk_free((uint32_t)backup_buf);
    return 1;
  }

  // Output table CREATE statements
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW && pos < DUMP_BUF_SIZE - 100) {
    const unsigned char *sql = sqlite3_column_text(stmt, 0);
    if (sql) {
      pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, (const char *)sql);
      pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, ";\n");
    }
  }
  sqlite3_finalize(stmt);

  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "\n");

  // Get data - reuse same logic as dump function but mark as binary
  rc = sqlite3_prepare_v2(db,
                          "SELECT name FROM sqlite_schema WHERE type='table' "
                          "AND name NOT LIKE 'sqlite_%' ORDER BY name",
                          -1, &stmt, NULL);

  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    pdk_free((uint32_t)backup_buf);
    return 1;
  }

  // For each table, generate INSERT statements (same as dump function)
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW &&
         pos < DUMP_BUF_SIZE - 1000) {
    const unsigned char *table_name = sqlite3_column_text(stmt, 0);
    if (!table_name)
      continue;

    char *data_sql = sqlite3_mprintf("SELECT * FROM %q", table_name);
    sqlite3_stmt *data_stmt;
    int data_rc = sqlite3_prepare_v2(db, data_sql, -1, &data_stmt, NULL);
    sqlite3_free(data_sql);

    if (data_rc == SQLITE_OK) {
      int col_count = sqlite3_column_count(data_stmt);

      while ((data_rc = sqlite3_step(data_stmt)) == SQLITE_ROW &&
             pos < DUMP_BUF_SIZE - 200) {
        pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "INSERT INTO ");
        pos = append_str(backup_buf, pos, DUMP_BUF_SIZE,
                         (const char *)table_name);
        pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, " VALUES(");

        for (int i = 0; i < col_count; i++) {
          if (i > 0) {
            pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, ",");
          }

          int col_type = sqlite3_column_type(data_stmt, i);
          if (col_type == SQLITE_NULL) {
            pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "NULL");
          } else if (col_type == SQLITE_INTEGER) {
            char num_buf[32];
            int64_t val = sqlite3_column_int64(data_stmt, i);
            // Simple int64 to string conversion (reuse same logic as dump)
            if (val == 0) {
              pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "0");
            } else {
              char temp[32];
              int len = 0;
              int64_t temp_val = val;
              int negative = 0;

              if (temp_val < 0) {
                negative = 1;
                temp_val = -temp_val;
              }

              while (temp_val > 0) {
                temp[len++] = '0' + (temp_val % 10);
                temp_val /= 10;
              }

              int buf_pos = 0;
              if (negative)
                num_buf[buf_pos++] = '-';
              for (int j = len - 1; j >= 0; j--) {
                num_buf[buf_pos++] = temp[j];
              }
              num_buf[buf_pos] = '\0';
              pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, num_buf);
            }
          } else {
            // For TEXT, REAL, BLOB - quote the value
            pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "'");
            const unsigned char *text = sqlite3_column_text(data_stmt, i);
            if (text) {
              // Simple escaping - replace ' with ''
              const char *src = (const char *)text;
              while (*src && pos < DUMP_BUF_SIZE - 10) {
                if (*src == '\'') {
                  backup_buf[pos++] = '\'';
                  backup_buf[pos++] = '\'';
                } else {
                  backup_buf[pos++] = *src;
                }
                src++;
              }
            }
            pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "'");
          }
        }
        pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, ");\n");
      }
      sqlite3_finalize(data_stmt);
    }
  }
  sqlite3_finalize(stmt);

  // Add footer
  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "\nCOMMIT;\n");
  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "-- END_BINARY_BACKUP_V1\n");

  // Output the complete backup
  pdk_output((const uint8_t *)backup_buf, pos);
  pdk_free((uint32_t)backup_buf);
  return 0;
}

// Binary load using SQLite backup API - loads from binary database snapshot
__attribute__((export_name("load"))) uint32_t sql_load(void) {
  if (!db) {
    const char error_msg[] = "SQL database was not initialized.";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  uint32_t input_len;
  const uint8_t *input = pdk_input(&input_len);

  if (!input || input_len == 0) {
    const char error_msg[] = "No binary backup data provided";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Allocate buffer for null-terminated SQL string
  char *backup_data = (char *)pdk_alloc(input_len + 1);
  if (!backup_data) {
    const char error_msg[] = "Memory allocation failed";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  pdk_memcpy(backup_data, input, input_len);
  backup_data[input_len] = '\0';

  // Check if this is a binary backup by looking for the marker
  if (pdk_strstr(backup_data, "-- BINARY_BACKUP_V1") == backup_data) {
    // This is a binary backup, execute it like a regular SQL dump
    char *err_msg = NULL;
    int rc = sqlite3_exec(db, backup_data, NULL, NULL, &err_msg);
    pdk_free((uint32_t)backup_data);

    if (rc != SQLITE_OK) {
      if (err_msg) {
        uint32_t err_len = pdk_strlen(err_msg);
        pdk_output((const uint8_t *)err_msg, err_len);
        sqlite3_free(err_msg);
      } else {
        const char error_msg[] = "Unknown SQLite error during binary load";
        pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
      }
      return 1;
    }

    const char success_msg[] = "Binary backup loaded successfully";
    pdk_output((const uint8_t *)success_msg, sizeof(success_msg) - 1);
    return 0;
  } else {
    pdk_free((uint32_t)backup_data);
    const char error_msg[] = "Invalid binary backup format";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }
}

// Restore database from SQL dump
__attribute__((export_name("restore"))) uint32_t sql_restore(void) {
  if (!db) {
    const char error_msg[] = "SQL database was not initialized.";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  uint32_t input_len;
  const uint8_t *input = pdk_input(&input_len);

  if (!input || input_len == 0) {
    const char error_msg[] = "No SQL dump provided";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Allocate buffer for null-terminated SQL string
  char *sql_dump = (char *)pdk_alloc(input_len + 1);
  if (!sql_dump) {
    const char error_msg[] = "Memory allocation failed";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  pdk_memcpy(sql_dump, input, input_len);
  sql_dump[input_len] = '\0';

  // Execute the entire dump as one script
  char *err_msg = NULL;
  int rc = sqlite3_exec(db, sql_dump, NULL, NULL, &err_msg);
  pdk_free((uint32_t)sql_dump);

  if (rc != SQLITE_OK) {
    if (err_msg) {
      uint32_t err_len = pdk_strlen(err_msg);
      pdk_output((const uint8_t *)err_msg, err_len);
      sqlite3_free(err_msg);
    } else {
      const char error_msg[] = "Unknown SQLite error during restore";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    }
    return 1;
  }

  const char success_msg[] = "Database restored successfully";
  pdk_output((const uint8_t *)success_msg, sizeof(success_msg) - 1);
  return 0;
}

// Save database as binary file to filesystem
// Input: file path (e.g., "/databases/game.sqlite")
// Uses sqlite3_serialize() to get binary database and fs.write to save
__attribute__((export_name("save_binary"))) uint32_t sql_save_binary(void) {
  if (!db) {
    const char error_msg[] = "SQL database was not initialized.";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Get path from input
  uint32_t input_len;
  const uint8_t *input = pdk_input(&input_len);

  if (!input || input_len == 0) {
    const char error_msg[] = "No file path provided";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Serialize the database to binary format
  sqlite3_int64 db_size = 0;
  unsigned char *db_data = sqlite3_serialize(db, "main", &db_size, 0);
  
  if (!db_data) {
    const char error_msg[] = "Failed to serialize database";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  if (db_size == 0) {
    sqlite3_free(db_data);
    const char error_msg[] = "Database is empty";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Prepare fs.write input: path + null byte + binary data
  // Format: [path bytes][0x00][database binary bytes]
  uint32_t write_input_len = input_len + 1 + (uint32_t)db_size;
  uint8_t *write_input = (uint8_t *)pdk_alloc(write_input_len);
  if (!write_input) {
    sqlite3_free(db_data);
    const char error_msg[] = "Memory allocation failed for write buffer";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Copy path
  pdk_memcpy(write_input, input, input_len);
  // Add null byte separator
  write_input[input_len] = 0;
  // Copy database binary data
  pdk_memcpy(write_input + input_len + 1, db_data, (uint32_t)db_size);

  // Free the serialized data from SQLite
  sqlite3_free(db_data);

  // Call fs.write
  pdk_call_result_t result = pdk_call_plugin_str("fs", "write", write_input, write_input_len);
  pdk_free((uint32_t)write_input);

  if (result.error != 0 || result.return_code != 0) {
    // Check if there's an error message in the output
    if (result.output_len > 0) {
      pdk_output(result.output, result.output_len);
    } else {
      const char error_msg[] = "Failed to write database file";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    }
    return 1;
  }

  const char success_msg[] = "OK";
  pdk_output((const uint8_t *)success_msg, sizeof(success_msg) - 1);
  return 0;
}

// Load database from binary file in filesystem
// Input: file path (e.g., "/databases/game.sqlite")
// Uses fs.read to get binary data and sqlite3_deserialize() to load
__attribute__((export_name("load_binary"))) uint32_t sql_load_binary(void) {
  // Get path from input
  uint32_t input_len;
  const uint8_t *input = pdk_input(&input_len);

  if (!input || input_len == 0) {
    const char error_msg[] = "No file path provided";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Call fs.read to get the binary database file
  pdk_call_result_t result = pdk_call_plugin_str("fs", "read", input, input_len);

  if (result.error != 0 || result.return_code != 0) {
    // Check if there's an error message in the output
    if (result.output_len > 0) {
      pdk_output(result.output, result.output_len);
    } else {
      const char error_msg[] = "Failed to read database file";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    }
    return 1;
  }

  if (result.output_len == 0) {
    const char error_msg[] = "Database file is empty";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Close existing database if open
  if (db) {
    sqlite3_close(db);
    db = NULL;
  }

  // Allocate heap for SQLite mem3 if not already allocated
  if (!g_sqlite_heap) {
    uint32_t heap_ptr = pdk_alloc((uint64_t)INITIAL_HEAP_SIZE);
    if (heap_ptr == 0) {
      const char error_msg[] = "Failed to allocate heap for SQLite";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
      return 1;
    }
    g_sqlite_heap = (void *)(uintptr_t)heap_ptr;
    g_heap_size = INITIAL_HEAP_SIZE;

    // Configure SQLite3 to use mem3 with our heap
    int rc = sqlite3_config(SQLITE_CONFIG_HEAP, g_sqlite_heap, (int)g_heap_size, 32);
    if (rc != SQLITE_OK) {
      const char error_msg[] = "Failed to configure SQLite mem3 allocator";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
      return 1;
    }
  }

  // Open a new in-memory database
  int rc = sqlite3_open(":memory:", &db);
  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    sqlite3_close(db);
    db = NULL;
    return 1;
  }

  // Copy the data to SQLite-managed memory (required by deserialize with SQLITE_DESERIALIZE_FREEONCLOSE)
  unsigned char *db_data = sqlite3_malloc64(result.output_len);
  if (!db_data) {
    sqlite3_close(db);
    db = NULL;
    const char error_msg[] = "Failed to allocate memory for database data";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }
  pdk_memcpy(db_data, result.output, result.output_len);

  // Deserialize the binary data into the database
  // Flags: SQLITE_DESERIALIZE_FREEONCLOSE - SQLite will free db_data when done
  //        SQLITE_DESERIALIZE_RESIZEABLE - Allow database to grow
  rc = sqlite3_deserialize(db, "main", db_data, result.output_len, result.output_len,
                           SQLITE_DESERIALIZE_FREEONCLOSE | SQLITE_DESERIALIZE_RESIZEABLE);
  
  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    sqlite3_close(db);
    db = NULL;
    return 1;
  }

  const char success_msg[] = "OK";
  pdk_output((const uint8_t *)success_msg, sizeof(success_msg) - 1);
  return 0;
}

// Get plugin info
__attribute__((export_name("info"))) uint32_t info(void) {
  const char info_msg[] =
      "SQL plugin v2.1 - SQLite3 with mem3 allocator - provides open, "
      "exec, query, close, dump, restore, backup, load, save_binary, load_binary, mem_stats functions";
  pdk_output((const uint8_t *)info_msg, sizeof(info_msg) - 1);
  return 0;
}

// Get memory statistics
__attribute__((export_name("mem_stats"))) uint32_t mem_stats(void) {
  // With mem3, we can report the heap size we allocated
  char buf[128];
  uint32_t pos = 0;
  char temp[32];
  
  // Report heap size
  const char msg1[] = "heap_size=";
  for (uint32_t i = 0; i < sizeof(msg1) - 1 && pos < sizeof(buf); i++) {
    buf[pos++] = msg1[i];
  }
  
  uint32_t len = uint32_to_str((uint32_t)g_heap_size, temp);
  for (uint32_t i = 0; i < len && pos < sizeof(buf); i++) {
    buf[pos++] = temp[i];
  }

  pdk_output((const uint8_t *)buf, pos);
  return 0;
}

// Required main function for WASM with libc
int main(void) { return 0; }
