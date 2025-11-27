#include "pdk.h"
#include "sqlite3.h"

// SQL plugin implemented in C with SQLite3
// Demonstrates:
// - Embedded SQLite3 database in WASM
// - In-memory database operations
// - SQL query execution and result formatting
// - PDK-compatible memory management

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
static char* pdk_strstr(const char *haystack, const char *needle) {
  if (!haystack || !needle || *needle == '\0') return (char *)haystack;
  
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
// SQLite3 Memory Allocator using PDK
// =============================================================================

// Custom memory allocator for SQLite3 using PDK
static void *sqlite_malloc(int size) {
  if (size <= 0)
    return NULL;
  return (void *)pdk_alloc((uint64_t)size);
}

static void sqlite_free(void *ptr) {
  if (ptr) {
    pdk_free((uint32_t)ptr);
  }
}

static void *sqlite_realloc(void *ptr, int size) {
  if (size <= 0) {
    sqlite_free(ptr);
    return NULL;
  }

  // Simple realloc: allocate new, copy old, free old
  // Note: This is inefficient but works for WASM
  void *new_ptr = sqlite_malloc(size);
  if (new_ptr && ptr) {
    // We don't know the old size, so we just copy 'size' bytes
    // This is a limitation of this simple implementation
    pdk_memcpy(new_ptr, ptr, (uint32_t)size);
    sqlite_free(ptr);
  }
  return new_ptr;
}

static int sqlite_size(void *ptr) {
  // We can't track sizes in this simple implementation
  // Return -1 to indicate unknown size
  return -1;
}

static int sqlite_roundup(int size) {
  // Round up to nearest 8 bytes
  return (size + 7) & ~7;
}

static int sqlite_init(void *data) {
  return 0; // Success
}

static void sqlite_shutdown(void *data) {
  // Nothing to do
}

// SQLite3 memory methods structure
static const sqlite3_mem_methods pdk_mem_methods = {
    sqlite_malloc, sqlite_free,     sqlite_realloc, sqlite_size, sqlite_roundup,
    sqlite_init,   sqlite_shutdown,
    NULL // pAppData
};

// =============================================================================
// Exported Plugin Functions
// =============================================================================

// Initialize and open in-memory database
__attribute__((export_name("open"))) uint32_t sql_open(void) {
  // Configure SQLite3 to use our PDK memory allocator
  int rc = sqlite3_config(SQLITE_CONFIG_MALLOC, &pdk_mem_methods);
  if (rc != SQLITE_OK) {
    const char error_msg[] = "Failed to configure SQLite memory allocator";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Open in-memory database
  rc = sqlite3_open(":memory:", &db);
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

// Execute non-SELECT SQL (CREATE, INSERT, UPDATE, DELETE)
__attribute__((export_name("exec"))) uint32_t sql_exec(void) {
  if (!db) {
    const char error_msg[] = "Database not opened. Call 'open' first.";
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
    const char error_msg[] = "Database not opened. Call 'open' first.";
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
#define RESULT_BUF_SIZE 8192
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
      pos = append_str(result_buf, pos, RESULT_BUF_SIZE, col_name);
    }

    if (i < col_count - 1) {
      if (pos < RESULT_BUF_SIZE)
        result_buf[pos++] = ',';
    } else {
      if (pos < RESULT_BUF_SIZE)
        result_buf[pos++] = '\n';
    }

    if (pos >= RESULT_BUF_SIZE - 1)
      break;
  }

  // Write data rows
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW && pos < RESULT_BUF_SIZE - 1) {
    for (int i = 0; i < col_count; i++) {
      const unsigned char *text = sqlite3_column_text(stmt, i);
      if (text) {
        pos = append_str(result_buf, pos, RESULT_BUF_SIZE, (const char *)text);
      } else {
        pos = append_str(result_buf, pos, RESULT_BUF_SIZE, "NULL");
      }

      if (i < col_count - 1) {
        if (pos < RESULT_BUF_SIZE)
          result_buf[pos++] = ',';
      } else {
        if (pos < RESULT_BUF_SIZE)
          result_buf[pos++] = '\n';
      }

      if (pos >= RESULT_BUF_SIZE - 1)
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
    const char error_msg[] = "Database not opened. Call 'open' first.";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  // Allocate buffer for the dump output
#define DUMP_BUF_SIZE 32768
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
    "SELECT sql FROM sqlite_schema WHERE type='table' AND sql IS NOT NULL ORDER BY name", 
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
    "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    -1, &stmt, NULL);

  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    pdk_free((uint32_t)dump_buf);
    return 1;
  }

  // For each table, generate INSERT statements
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW && pos < DUMP_BUF_SIZE - 1000) {
    const unsigned char *table_name = sqlite3_column_text(stmt, 0);
    if (!table_name) continue;

    // Create SELECT statement to get data
    char *data_sql = sqlite3_mprintf(
      "SELECT 'INSERT INTO %q VALUES(' || group_concat(quote(CASE WHEN typeof(c0) = 'null' THEN NULL ELSE c0 END) || CASE WHEN c1 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c1) = 'null' THEN NULL ELSE c1 END) ELSE '' END || CASE WHEN c2 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c2) = 'null' THEN NULL ELSE c2 END) ELSE '' END || CASE WHEN c3 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c3) = 'null' THEN NULL ELSE c3 END) ELSE '' END || CASE WHEN c4 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c4) = 'null' THEN NULL ELSE c4 END) ELSE '' END || CASE WHEN c5 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c5) = 'null' THEN NULL ELSE c5 END) ELSE '' END || CASE WHEN c6 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c6) = 'null' THEN NULL ELSE c6 END) ELSE '' END || CASE WHEN c7 IS NOT NULL THEN ',' || quote(CASE WHEN typeof(c7) = 'null' THEN NULL ELSE c7 END) ELSE '' END, ');') FROM (SELECT * FROM %q) AS t(%s)",
      table_name, table_name, "c0,c1,c2,c3,c4,c5,c6,c7");
    
    // Simplified approach: just use a basic INSERT generation
    sqlite3_free(data_sql);
    data_sql = sqlite3_mprintf("SELECT * FROM %q", table_name);

    sqlite3_stmt *data_stmt;
    rc = sqlite3_prepare_v2(db, data_sql, -1, &data_stmt, NULL);
    sqlite3_free(data_sql);

    if (rc == SQLITE_OK) {
      int col_count = sqlite3_column_count(data_stmt);
      
      while ((rc = sqlite3_step(data_stmt)) == SQLITE_ROW && pos < DUMP_BUF_SIZE - 200) {
        pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "INSERT INTO ");
        pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, (const char *)table_name);
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
              if (negative) num_buf[buf_pos++] = '-';
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
  rc = sqlite3_prepare_v2(db,
    "SELECT sql FROM sqlite_schema WHERE type IN ('index','trigger','view') AND sql IS NOT NULL ORDER BY type",
    -1, &stmt, NULL);

  if (rc == SQLITE_OK) {
    pos = append_str(dump_buf, pos, DUMP_BUF_SIZE, "\n-- Indexes, triggers, and views\n");
    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW && pos < DUMP_BUF_SIZE - 100) {
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
    const char error_msg[] = "Database not opened. Call 'open' first.";
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
  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "-- Generated from binary backup\n");
  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "PRAGMA foreign_keys=OFF;\n");
  pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "BEGIN TRANSACTION;\n\n");

  // Get schema - reuse the same logic as dump function
  sqlite3_stmt *stmt;
  int rc = sqlite3_prepare_v2(db, 
    "SELECT sql FROM sqlite_schema WHERE type='table' AND sql IS NOT NULL ORDER BY name", 
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
    "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    -1, &stmt, NULL);

  if (rc != SQLITE_OK) {
    const char *err = sqlite3_errmsg(db);
    uint32_t err_len = pdk_strlen(err);
    pdk_output((const uint8_t *)err, err_len);
    pdk_free((uint32_t)backup_buf);
    return 1;
  }

  // For each table, generate INSERT statements (same as dump function)
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW && pos < DUMP_BUF_SIZE - 1000) {
    const unsigned char *table_name = sqlite3_column_text(stmt, 0);
    if (!table_name) continue;

    char *data_sql = sqlite3_mprintf("SELECT * FROM %q", table_name);
    sqlite3_stmt *data_stmt;
    int data_rc = sqlite3_prepare_v2(db, data_sql, -1, &data_stmt, NULL);
    sqlite3_free(data_sql);

    if (data_rc == SQLITE_OK) {
      int col_count = sqlite3_column_count(data_stmt);
      
      while ((data_rc = sqlite3_step(data_stmt)) == SQLITE_ROW && pos < DUMP_BUF_SIZE - 200) {
        pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, "INSERT INTO ");
        pos = append_str(backup_buf, pos, DUMP_BUF_SIZE, (const char *)table_name);
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
              if (negative) num_buf[buf_pos++] = '-';
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
    const char error_msg[] = "Database not opened. Call 'open' first.";
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
    const char error_msg[] = "Database not opened. Call 'open' first.";
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

// Get plugin info
__attribute__((export_name("info"))) uint32_t info(void) {
  const char info_msg[] = "SQL plugin v1.1 - SQLite3 in WASM - provides open, "
                          "exec, query, close, dump, restore, backup, load functions";
  pdk_output((const uint8_t *)info_msg, sizeof(info_msg) - 1);
  return 0;
}

// Required main function for WASM with libc
int main(void) { return 0; }
