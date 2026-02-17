SHELL := bash
.ONESHELL:
.SECONDEXPANSION:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

ifdef V
Q=
WGET:=wget
else
Q=@
MAKEFLAGS += --no-print-directory
WGET:=wget -q --show-progress
endif

uniq = $(if $1,$(firstword $1) $(call uniq,$(filter-out $(firstword $1),$1)))

define QUIET
	$(if $(V), , $(1))
endef

MKDIR_P ?= mkdir -p
CP ?= cp -f

.DEFAULT_GOAL := all

APP_NAME ?= Game
APP_TITLE ?= The Game
APP_DIR ?= ./example/cmd/game
ASSETS_DIR ?= example/assets

BUILD_DIR ?= build.nosync
PLUGIN_DIR ?= plugins

# Detect all plugin subdirectories (exclude fs which is now built-in to plugin-manager)
PLUGIN_DIRS := $(filter-out $(PLUGIN_DIR)/fs,$(wildcard $(PLUGIN_DIR)/*))
PLUGINS := $(notdir $(PLUGIN_DIRS))
PLUGIN_TARGETS := $(addprefix $(BUILD_DIR)/plugins/,$(addsuffix .wasm,$(PLUGINS)))

SYS_GOOS := $(shell go env GOOS)
SYS_GOARCH := $(shell go env GOARCH)
GO_MODULE_NAME ?= $(shell go list -m)




.PHONY: all
all: browser

.PHONY: plugins-release
plugins-release: $(PLUGIN_TARGETS)

# Rule to build Go plugins
$(BUILD_DIR)/plugins/%.wasm: $(PLUGIN_DIR)/%/main.go $(wildcard $(PLUGIN_DIR)/%/*.go) | $(BUILD_DIR)/plugins
	$(Q)echo "Building Go plugin $*..."
	$(Q)GOOS=wasip1 GOARCH=wasm tinygo build -buildmode=c-shared -o $@ ./$(PLUGIN_DIR)/$*/

# Rule to build Zig plugins
$(BUILD_DIR)/plugins/%.wasm: $(PLUGIN_DIR)/%/main.zig $(wildcard $(PLUGIN_DIR)/%/*.zig) | $(BUILD_DIR)/plugins
	$(Q)echo "Building Zig plugin $*..."
	$(Q)zig build-exe $< -target wasm32-freestanding -fno-entry -rdynamic -O ReleaseFast -femit-bin=$@

$(BUILD_DIR)/plugins/%.wasm: $(PLUGIN_DIR)/%/index.js $(wildcard $(PLUGIN_DIR)/%/*.zig) | $(BUILD_DIR)/plugins
	$(Q)echo "nothing to do $*..."
	$(Q)touch $@

# Special rule for SQL plugin with SQLite3
# Note: Uses wasm32-wasi target (not freestanding) because SQLite3 needs libc
$(BUILD_DIR)/plugins/sql.wasm: $(PLUGIN_DIR)/sql/main.c $(PLUGIN_DIR)/sql/vendor/sqlite3.c $(wildcard $(PLUGIN_DIR)/sql/vendor/*.h) | $(BUILD_DIR)/plugins
	$(Q)echo "Building SQL plugin with SQLite3 mem3..."
	$(Q)zig build-exe $(PLUGIN_DIR)/sql/main.c $(PLUGIN_DIR)/sql/vendor/sqlite3.c \
		-target wasm32-wasi \
		-lc \
		-rdynamic \
		-O ReleaseFast \
		-DSQLITE_ENABLE_MEMSYS3 \
		-DSQLITE_OMIT_LOAD_EXTENSION \
		-DSQLITE_THREADSAFE=0 \
		-DSQLITE_OMIT_WAL \
		-DSQLITE_DEFAULT_MEMSTATUS=0 \
		-DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 \
		-DSQLITE_LIKE_DOESNT_MATCH_BLOBS \
		-DSQLITE_MAX_EXPR_DEPTH=0 \
		-DSQLITE_OMIT_DECLTYPE \
		-DSQLITE_OMIT_DEPRECATED \
		-DSQLITE_OMIT_PROGRESS_CALLBACK \
		-DSQLITE_OMIT_SHARED_CACHE \
		-DSQLITE_USE_ALLOCA \
		-DSQLITE_TEMP_STORE=3 \
		-femit-bin=$@

# Special rule for stb_tilemap_editor with shared memory support
# Needs --import-memory and --shared-memory so the main thread can read
# draw command buffers from WASM linear memory via SharedArrayBuffer.
$(BUILD_DIR)/plugins/stb_tilemap_editor.wasm: $(PLUGIN_DIR)/stb_tilemap_editor/main.c $(wildcard $(PLUGIN_DIR)/stb_tilemap_editor/*.h) | $(BUILD_DIR)/plugins
	$(Q)echo "Building stb_tilemap_editor plugin (shared memory)..."
	$(Q)zig build-exe $< \
		-target wasm32-freestanding \
		-mcpu generic+atomics+bulk_memory \
		-fno-entry \
		-rdynamic \
		-O ReleaseFast \
		--import-memory \
		--shared-memory \
		--initial-memory=10354688 \
		--max-memory=33554432 \
		-femit-bin=$@

$(BUILD_DIR)/plugins/stbte.wasm: $(PLUGIN_DIR)/stbte/main.c $(wildcard $(PLUGIN_DIR)/stbte/*.h) | $(BUILD_DIR)/plugins
	$(Q)echo "Building stbte plugin (shared memory)..."
	$(Q)zig build-exe $< \
		-target wasm32-freestanding \
		-mcpu generic+atomics+bulk_memory \
		-fno-entry \
		-rdynamic \
		-O ReleaseSmall \
		-fstrip \
		--import-memory \
		--shared-memory \
		--initial-memory=18874368 \
		--max-memory=33554432 \
		-femit-bin=$@

# Rule to build C plugins using Zig (bare WASM)
$(BUILD_DIR)/plugins/%.wasm: $(PLUGIN_DIR)/%/main.c $(wildcard $(PLUGIN_DIR)/%/*.h) | $(BUILD_DIR)/plugins
	$(Q)echo "Building C plugin $*..."
	$(Q)zig build-exe $< -target wasm32-freestanding -fno-entry -rdynamic -O ReleaseFast -femit-bin=$@

.PHONY: browser
browser: $(PLUGIN_TARGETS)
	$(Q)go build -o $(BUILD_DIR)/browser-server ./cmd/browser/server.go

.PHONY: browser-run
browser-run: browser $(PLUGIN_TARGETS)
	$(Q)echo "Starting GameCtl Browser IDE..."
	$(Q)BUILD_DIR=$(BUILD_DIR) $(BUILD_DIR)/browser-server -port 8080

# Ensure build directories exist
$(BUILD_DIR):
	$(Q)mkdir -p $@

$(BUILD_DIR)/plugins:
	$(Q)mkdir -p $@

# Production web deployment target
.PHONY: web
web: $(PLUGIN_TARGETS)
	$(Q)rm -rf $(BUILD_DIR)/web
	$(Q)echo "Creating production web build in $(BUILD_DIR)/web/..."
	$(Q)mkdir -p $(BUILD_DIR)/web/plugins
	$(Q)echo "  Copying browser files..."
	$(Q)pwd
	$(Q)cp -r cmd/browser/. $(BUILD_DIR)/web/
	$(Q)echo "  Copying plugins..."
	$(Q)cp -r $(BUILD_DIR)/plugins/* $(BUILD_DIR)/web/plugins/
	$(Q)echo "✓ Production build ready at $(BUILD_DIR)/web/"

.PHONY: clean
clean:
	$(Q)rm -rf $(BUILD_DIR)
