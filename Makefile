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
DESIGN_DIR ?= design

# Detect all plugin subdirectories
PLUGIN_DIRS := $(wildcard $(PLUGIN_DIR)/*)
PLUGINS := $(notdir $(PLUGIN_DIRS))
PLUGIN_TARGETS := $(addprefix $(BUILD_DIR)/,$(addsuffix .wasm,$(PLUGINS)))

SYS_GOOS := $(shell go env GOOS)
SYS_GOARCH := $(shell go env GOARCH)
GO_MODULE_NAME ?= $(shell go list -m)

.PHONY: all
all: browser

.PHONY: plugins-release
plugins-release: $(PLUGIN_TARGETS)

# Rule to build Go plugins
$(BUILD_DIR)/%.wasm: $(PLUGIN_DIR)/%/main.go $(wildcard $(PLUGIN_DIR)/%/*.go) | $(BUILD_DIR)
	$(Q)echo "Building Go plugin $*..."
	$(Q)GOOS=wasip1 GOARCH=wasm tinygo build -buildmode=c-shared -o $@ ./$(PLUGIN_DIR)/$*/

# Rule to build Zig plugins
$(BUILD_DIR)/%.wasm: $(PLUGIN_DIR)/%/main.zig $(wildcard $(PLUGIN_DIR)/%/*.zig) | $(BUILD_DIR)
	$(Q)echo "Building Zig plugin $*..."
	$(Q)zig build-exe $< -target wasm32-freestanding -fno-entry -rdynamic -O ReleaseFast -femit-bin=$@

# Rule to build C plugins using Zig (bare WASM)
$(BUILD_DIR)/%.wasm: $(PLUGIN_DIR)/%/main.c $(wildcard $(PLUGIN_DIR)/%/*.h) | $(BUILD_DIR)
	$(Q)echo "Building C plugin $*..."
	$(Q)zig build-exe $< -target wasm32-freestanding -fno-entry -rdynamic -O ReleaseFast -femit-bin=$@

# Design token files
DESIGN_TOKEN_FILES := $(BUILD_DIR)/tokens/css/components.css $(BUILD_DIR)/tokens/css/variables.css $(BUILD_DIR)/tokens/css/atomic.css $(BUILD_DIR)/tokens/js/tokens.js

.PHONY: design-tokens
design-tokens: $(DESIGN_TOKEN_FILES)

# Rule to build design tokens
$(DESIGN_TOKEN_FILES): $(wildcard $(DESIGN_DIR)/tokens/**/*.json) $(DESIGN_DIR)/node_modules
	$(Q)echo "Building design tokens..."
	$(Q)mkdir -p $(BUILD_DIR)/tokens/css $(BUILD_DIR)/tokens/js
	$(Q)cd $(DESIGN_DIR) && bun run build --verbose && cp build/css/* ../$(BUILD_DIR)/tokens/css/ && cp build/js/* ../$(BUILD_DIR)/tokens/js

$(DESIGN_DIR)/node_modules:
	$(Q)cd $(DESIGN_DIR) && bun install 

.PHONY: browser
browser: design-tokens $(PLUGIN_TARGETS)
	$(Q)go build -o $(BUILD_DIR)/browser-server ./cmd/browser/server.go

.PHONY: browser-run
browser-run: browser $(PLUGIN_TARGETS)
	$(Q)echo "Starting GameCtl Browser IDE..."
	$(Q)$(BUILD_DIR)/browser-server -port 8080

# Ensure build directory exists
$(BUILD_DIR):
	$(Q)mkdir -p $@

.PHONY: clean
clean:
	$(Q)git ls-files -oi --exclude-standard | (grep -v '^\.idea' || exit 0) | xargs trash
	$(Q)rm -rf $(BUILD_DIR)
