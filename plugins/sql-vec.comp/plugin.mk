PLUGIN_WIT_WORLD := provider
PLUGIN_COMPONENT_NAME := provider
PLUGIN_COMPONENT_CFLAGS := \
  -I$(PLUGIN_DIR)/sql-vec/vendor \
  -I$(PLUGIN_DIR)/sql.comp/sql-common \
  -DGAMS_SQL_WITH_VEC \
  -DSQLITE_THREADSAFE=0 \
  -DSQLITE_OMIT_LOAD_EXTENSION \
  -DSQLITE_OMIT_WAL \
  -DSQLITE_TEMP_STORE=3 \
  -DSQLITE_DEFAULT_MEMSTATUS=0 \
  -DSQLITE_CORE \
  -DSQLITE_VEC_STATIC \
  -DSQLITE_VEC_OMIT_FS
PLUGIN_COMPONENT_SOURCES := \
  $(PLUGIN_DIR)/sql-vec.comp/component.c \
  $(PLUGIN_DIR)/sql-vec/vendor/sqlite3.c \
  $(PLUGIN_DIR)/sql-vec/vendor/sqlite-vec.c
PLUGIN_COMPONENT_EXTRA_DEPS := \
  $(PLUGIN_DIR)/sql.comp/sql-common/sqlite_provider.c \
  $(wildcard $(PLUGIN_DIR)/sql-vec/vendor/*.h)
