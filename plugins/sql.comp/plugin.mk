PLUGIN_WIT_WORLD := provider
PLUGIN_COMPONENT_NAME := provider
PLUGIN_COMPONENT_CFLAGS := \
  -I$(PLUGIN_DIR)/sql.comp/vendor \
  -I$(PLUGIN_DIR)/sql.comp/sql-common \
  -DSQLITE_THREADSAFE=0 \
  -DSQLITE_OMIT_LOAD_EXTENSION \
  -DSQLITE_OMIT_WAL \
  -DSQLITE_TEMP_STORE=3 \
  -DSQLITE_DEFAULT_MEMSTATUS=0
PLUGIN_COMPONENT_SOURCES := \
  $(PLUGIN_DIR)/sql.comp/component.c \
  $(PLUGIN_DIR)/sql.comp/vendor/sqlite3.c
PLUGIN_COMPONENT_EXTRA_DEPS := \
  $(PLUGIN_DIR)/sql.comp/sql-common/sqlite_provider.c \
  $(wildcard $(PLUGIN_DIR)/sql.comp/vendor/*.h)
