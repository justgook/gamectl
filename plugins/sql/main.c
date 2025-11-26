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

// Get plugin info
__attribute__((export_name("info"))) uint32_t info(void) {
  const char info_msg[] = "SQL plugin v1.0 - SQLite3 in WASM - provides open, "
                          "exec, query, close functions";
  pdk_output((const uint8_t *)info_msg, sizeof(info_msg) - 1);
  return 0;
}

// Required main function for WASM with libc
int main(void) { return 0; }
