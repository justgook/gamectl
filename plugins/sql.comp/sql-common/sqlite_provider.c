#include "provider.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "sqlite3.h"

#ifdef GAMS_SQL_WITH_VEC
#include "sqlite-vec.h"
#endif

struct exports_wasi_sql_types_connection_t {
  sqlite3 *db;
  char *name;
};

struct exports_wasi_sql_types_statement_t {
  char *query;
  char **params;
  size_t params_len;
};

struct exports_wasi_sql_types_error_t {
  char *trace;
};

static char *dup_bytes(const uint8_t *ptr, size_t len) {
  char *out = malloc(len + 1);
  if (!out) return NULL;
  if (len > 0) memcpy(out, ptr, len);
  out[len] = '\0';
  return out;
}

static exports_wasi_sql_types_own_error_t make_error(const char *message) {
  exports_wasi_sql_types_error_t *err = calloc(1, sizeof(*err));
  if (!err) abort();
  err->trace = strdup(message ? message : "unknown sql error");
  if (!err->trace) abort();
  return exports_wasi_sql_types_error_new(err);
}

static exports_wasi_sql_types_own_error_t make_sqlite_error(sqlite3 *db, const char *prefix) {
  const char *sqlite_message = db ? sqlite3_errmsg(db) : "sqlite database is not open";
  size_t prefix_len = prefix ? strlen(prefix) : 0;
  size_t sqlite_len = strlen(sqlite_message);
  char *message = malloc(prefix_len + 2 + sqlite_len + 1);
  if (!message) abort();
  size_t pos = 0;
  if (prefix_len > 0) {
    memcpy(message + pos, prefix, prefix_len);
    pos += prefix_len;
    message[pos++] = ':';
    message[pos++] = ' ';
  }
  memcpy(message + pos, sqlite_message, sqlite_len);
  pos += sqlite_len;
  message[pos] = '\0';
  exports_wasi_sql_types_own_error_t err = make_error(message);
  free(message);
  return err;
}

static bool string_is(provider_string_t *value, const char *literal) {
  size_t len = strlen(literal);
  return value->len == len && memcmp(value->ptr, literal, len) == 0;
}

static int bind_statement_params(sqlite3_stmt *stmt, exports_wasi_sql_types_statement_t *statement) {
  for (size_t i = 0; i < statement->params_len; i++) {
    int rc = sqlite3_bind_text(stmt, (int)i + 1, statement->params[i], -1, SQLITE_TRANSIENT);
    if (rc != SQLITE_OK) return rc;
  }
  return SQLITE_OK;
}

#ifdef GAMS_SQL_WITH_VEC
static bool register_vec(sqlite3 *db, exports_wasi_sql_types_own_error_t *err) {
  char *vec_err = NULL;
  int rc = sqlite3_vec_init(db, &vec_err, NULL);
  if (rc == SQLITE_OK) return true;
  if (vec_err) {
    *err = make_error(vec_err);
    sqlite3_free(vec_err);
  } else {
    *err = make_sqlite_error(db, "failed to initialize sqlite-vec");
  }
  return false;
}
#endif

bool exports_wasi_sql_types_static_connection_open(
    provider_string_t *name,
    exports_wasi_sql_types_own_connection_t *ret,
    exports_wasi_sql_types_own_error_t *err) {
  char *path = NULL;
  if (name->len == 0 || string_is(name, "memory")) {
    path = strdup(":memory:");
  } else {
    path = dup_bytes(name->ptr, name->len);
  }
  if (!path) {
    *err = make_error("out of memory while opening sql connection");
    return false;
  }

  exports_wasi_sql_types_connection_t *connection = calloc(1, sizeof(*connection));
  if (!connection) {
    free(path);
    *err = make_error("out of memory while opening sql connection");
    return false;
  }

  int rc = sqlite3_open_v2(path, &connection->db,
                           SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_URI,
                           NULL);
  if (rc != SQLITE_OK) {
    *err = make_sqlite_error(connection->db, "failed to open sql connection");
    if (connection->db) sqlite3_close(connection->db);
    free(connection);
    free(path);
    return false;
  }

#ifdef GAMS_SQL_WITH_VEC
  if (!register_vec(connection->db, err)) {
    sqlite3_close(connection->db);
    free(connection);
    free(path);
    return false;
  }
#endif

  connection->name = path;
  *ret = exports_wasi_sql_types_connection_new(connection);
  return true;
}

bool exports_wasi_sql_types_static_statement_prepare(
    provider_string_t *query,
    provider_list_string_t *params,
    exports_wasi_sql_types_own_statement_t *ret,
    exports_wasi_sql_types_own_error_t *err) {
  exports_wasi_sql_types_statement_t *statement = calloc(1, sizeof(*statement));
  if (!statement) {
    *err = make_error("out of memory while preparing sql statement");
    return false;
  }

  statement->query = dup_bytes(query->ptr, query->len);
  if (!statement->query) {
    free(statement);
    *err = make_error("out of memory while preparing sql statement");
    return false;
  }

  statement->params_len = params->len;
  if (params->len > 0) {
    statement->params = calloc(params->len, sizeof(char *));
    if (!statement->params) {
      free(statement->query);
      free(statement);
      *err = make_error("out of memory while preparing sql statement params");
      return false;
    }
    for (size_t i = 0; i < params->len; i++) {
      statement->params[i] = dup_bytes(params->ptr[i].ptr, params->ptr[i].len);
      if (!statement->params[i]) {
        for (size_t j = 0; j < i; j++) free(statement->params[j]);
        free(statement->params);
        free(statement->query);
        free(statement);
        *err = make_error("out of memory while preparing sql statement params");
        return false;
      }
    }
  }

  *ret = exports_wasi_sql_types_statement_new(statement);
  return true;
}

void exports_wasi_sql_types_method_error_trace(
    exports_wasi_sql_types_borrow_error_t self,
    provider_string_t *ret) {
  provider_string_dup(ret, self->trace ? self->trace : "unknown sql error");
}

bool exports_wasi_sql_readwrite_exec(
    exports_wasi_sql_readwrite_borrow_connection_t c,
    exports_wasi_sql_readwrite_borrow_statement_t q,
    uint32_t *ret,
    exports_wasi_sql_readwrite_own_error_t *err) {
  sqlite3_stmt *stmt = NULL;
  int rc = sqlite3_prepare_v2(c->db, q->query, -1, &stmt, NULL);
  if (rc != SQLITE_OK) {
    *err = make_sqlite_error(c->db, "failed to prepare sql exec statement");
    return false;
  }

  rc = bind_statement_params(stmt, q);
  if (rc != SQLITE_OK) {
    *err = make_sqlite_error(c->db, "failed to bind sql exec params");
    sqlite3_finalize(stmt);
    return false;
  }

  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {}
  if (rc != SQLITE_DONE) {
    *err = make_sqlite_error(c->db, "failed to execute sql statement");
    sqlite3_finalize(stmt);
    return false;
  }

  sqlite3_finalize(stmt);
  int changes = sqlite3_changes(c->db);
  *ret = changes < 0 ? 0u : (uint32_t)changes;
  return true;
}

static void set_cell_from_sqlite(sqlite3_stmt *stmt, int col, exports_wasi_sql_types_data_type_t *out) {
  int type = sqlite3_column_type(stmt, col);
  switch (type) {
  case SQLITE_INTEGER:
    out->tag = EXPORTS_WASI_SQL_TYPES_DATA_TYPE_INT64;
    out->val.int64 = sqlite3_column_int64(stmt, col);
    break;
  case SQLITE_FLOAT:
    out->tag = EXPORTS_WASI_SQL_TYPES_DATA_TYPE_DOUBLE;
    out->val.double_ = sqlite3_column_double(stmt, col);
    break;
  case SQLITE_TEXT: {
    out->tag = EXPORTS_WASI_SQL_TYPES_DATA_TYPE_STR;
    const unsigned char *text = sqlite3_column_text(stmt, col);
    int len = sqlite3_column_bytes(stmt, col);
    provider_string_dup_n(&out->val.str, (const char *)text, len < 0 ? 0 : (size_t)len);
    break;
  }
  case SQLITE_BLOB: {
    out->tag = EXPORTS_WASI_SQL_TYPES_DATA_TYPE_BINARY;
    const void *blob = sqlite3_column_blob(stmt, col);
    int len = sqlite3_column_bytes(stmt, col);
    if (len <= 0) {
      out->val.binary.ptr = NULL;
      out->val.binary.len = 0;
    } else {
      out->val.binary.ptr = malloc((size_t)len);
      if (!out->val.binary.ptr) abort();
      memcpy(out->val.binary.ptr, blob, (size_t)len);
      out->val.binary.len = (size_t)len;
    }
    break;
  }
  case SQLITE_NULL:
  default:
    out->tag = EXPORTS_WASI_SQL_TYPES_DATA_TYPE_NULL;
    break;
  }
}

static bool append_query_row(exports_wasi_sql_readwrite_list_row_t *rows,
                             sqlite3_stmt *stmt,
                             int col_count,
                             exports_wasi_sql_readwrite_own_error_t *err) {
  size_t old_len = rows->len;
  size_t add_len = (size_t)col_count;
  if (add_len == 0) return true;
  if (old_len > SIZE_MAX - add_len) {
    *err = make_error("sql query result is too large");
    return false;
  }
  exports_wasi_sql_readwrite_row_t *next = realloc(rows->ptr, (old_len + add_len) * sizeof(*next));
  if (!next) {
    *err = make_error("out of memory while building sql query result");
    return false;
  }
  rows->ptr = next;
  for (int col = 0; col < col_count; col++) {
    exports_wasi_sql_readwrite_row_t *cell = &rows->ptr[rows->len++];
    memset(cell, 0, sizeof(*cell));
    const char *name = sqlite3_column_name(stmt, col);
    provider_string_dup(&cell->field_name, name ? name : "");
    set_cell_from_sqlite(stmt, col, &cell->value);
  }
  return true;
}

bool exports_wasi_sql_readwrite_query(
    exports_wasi_sql_readwrite_borrow_connection_t c,
    exports_wasi_sql_readwrite_borrow_statement_t q,
    exports_wasi_sql_readwrite_list_row_t *ret,
    exports_wasi_sql_readwrite_own_error_t *err) {
  ret->ptr = NULL;
  ret->len = 0;

  sqlite3_stmt *stmt = NULL;
  int rc = sqlite3_prepare_v2(c->db, q->query, -1, &stmt, NULL);
  if (rc != SQLITE_OK) {
    *err = make_sqlite_error(c->db, "failed to prepare sql query statement");
    return false;
  }

  rc = bind_statement_params(stmt, q);
  if (rc != SQLITE_OK) {
    *err = make_sqlite_error(c->db, "failed to bind sql query params");
    sqlite3_finalize(stmt);
    return false;
  }

  int col_count = sqlite3_column_count(stmt);
  while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
    if (!append_query_row(ret, stmt, col_count, err)) {
      sqlite3_finalize(stmt);
      exports_wasi_sql_readwrite_list_row_free(ret);
      ret->ptr = NULL;
      ret->len = 0;
      return false;
    }
  }

  if (rc != SQLITE_DONE) {
    *err = make_sqlite_error(c->db, "failed to execute sql query");
    sqlite3_finalize(stmt);
    exports_wasi_sql_readwrite_list_row_free(ret);
    ret->ptr = NULL;
    ret->len = 0;
    return false;
  }

  sqlite3_finalize(stmt);
  return true;
}

void exports_wasi_sql_types_statement_destructor(exports_wasi_sql_types_statement_t *rep) {
  if (!rep) return;
  for (size_t i = 0; i < rep->params_len; i++) free(rep->params[i]);
  free(rep->params);
  free(rep->query);
  free(rep);
}

void exports_wasi_sql_types_error_destructor(exports_wasi_sql_types_error_t *rep) {
  if (!rep) return;
  free(rep->trace);
  free(rep);
}

void exports_wasi_sql_types_connection_destructor(exports_wasi_sql_types_connection_t *rep) {
  if (!rep) return;
  if (rep->db) sqlite3_close(rep->db);
  free(rep->name);
  free(rep);
}
