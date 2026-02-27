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

# --- Odin plugin build settings ---
ODIN ?= odin
# Good default for “plugin-style” WASM (no JS glue required):
ODIN_WASM_TARGET ?= freestanding_wasm32
# Common choices: speed | size | none
ODIN_OPT ?= speed
# If you need linker tweaks (import memory, stack size, etc), set this:
ODIN_EXTRA_LINKER_FLAGS ?=

# ------------------------------------------------------------
# Per-plugin manifest support
# Each plugin may define: plugins/<name>/plugin.mk
#
# The manifest can set variables like:
#   ODIN_WASM_TARGET, ODIN_OPT, ODIN_EXTRA_LINKER_FLAGS
#   ZIG_WASM_TARGET, ZIG_MCPU, ZIG_OPT, ZIG_EXTRA_FLAGS
#   (and anything else you want)
#
# These are applied as *target-specific variables* only for that plugin's .wasm target.
# ------------------------------------------------------------

# Initialize manifest locals so --warn-undefined-variables doesn't fire
PLUGIN_ODIN_WASM_TARGET :=
PLUGIN_ODIN_OPT :=
PLUGIN_ODIN_EXTRA_LINKER_FLAGS :=
PLUGIN_ZIG_WASM_TARGET :=
PLUGIN_ZIG_MCPU :=
PLUGIN_ZIG_OPT :=
PLUGIN_ZIG_EXTRA_FLAGS :=
PLUGIN_C_SOURCES :=
PLUGIN_EXTRA_DEPS :=

# Helper macro: attach manifest-defined variables to that plugin's wasm target
#
# How it works:
#   1. Set per-plugin namespaced vars to global defaults
#   2. -include the plugin's plugin.mk (which may set PLUGIN_ZIG_* etc.)
#   3. Override namespaced vars with any PLUGIN_* values that were set
#   4. Attach namespaced vars as target-specific variables
#   5. Clear PLUGIN_* locals so they don't leak to the next plugin
#
# NOTE: ifneq inside $(eval $(call ...)) doesn't work — Make expands
# conditionals at parse time, not eval time. Instead we use $(or ...)
# to pick the manifest value when non-empty, falling back to the default.
define APPLY_PLUGIN_MANIFEST
  # Load manifest if present (sets PLUGIN_ZIG_*, PLUGIN_ODIN_*, etc.)
  -include $(PLUGIN_DIR)/$(1)/plugin.mk

  # Resolve per-plugin values: manifest override or global default
  ODIN_WASM_TARGET_$(1) := $$(or $$(PLUGIN_ODIN_WASM_TARGET),$(ODIN_WASM_TARGET))
  ODIN_OPT_$(1)         := $$(or $$(PLUGIN_ODIN_OPT),$(ODIN_OPT))
  ODIN_EXTRA_LINKER_FLAGS_$(1) := $$(or $$(PLUGIN_ODIN_EXTRA_LINKER_FLAGS),$(ODIN_EXTRA_LINKER_FLAGS))

  ZIG_WASM_TARGET_$(1)  := $$(or $$(PLUGIN_ZIG_WASM_TARGET),wasm32-freestanding)
  ZIG_MCPU_$(1)         := $$(PLUGIN_ZIG_MCPU)
  ZIG_OPT_$(1)          := $$(or $$(PLUGIN_ZIG_OPT),ReleaseFast)
  ZIG_EXTRA_FLAGS_$(1)  := $$(PLUGIN_ZIG_EXTRA_FLAGS)
  ZIG_C_SOURCES_$(1)    := $$(if $$(strip $$(PLUGIN_C_SOURCES)),$$(PLUGIN_C_SOURCES),$(wildcard $(PLUGIN_DIR)/$(1)/main.c))
  ZIG_EXTRA_DEPS_$(1)   := $$(if $$(strip $$(PLUGIN_EXTRA_DEPS)),$$(PLUGIN_EXTRA_DEPS),$(wildcard $(PLUGIN_DIR)/$(1)/*.h))

  # Apply as target-specific vars for this plugin's .wasm output
  $(BUILD_DIR)/plugins/$(1).wasm: ODIN_WASM_TARGET := $$(ODIN_WASM_TARGET_$(1))
  $(BUILD_DIR)/plugins/$(1).wasm: ODIN_OPT := $$(ODIN_OPT_$(1))
  $(BUILD_DIR)/plugins/$(1).wasm: ODIN_EXTRA_LINKER_FLAGS := $$(ODIN_EXTRA_LINKER_FLAGS_$(1))
  $(BUILD_DIR)/plugins/$(1).wasm: ZIG_WASM_TARGET := $$(ZIG_WASM_TARGET_$(1))
  $(BUILD_DIR)/plugins/$(1).wasm: ZIG_MCPU := $$(ZIG_MCPU_$(1))
  $(BUILD_DIR)/plugins/$(1).wasm: ZIG_OPT := $$(ZIG_OPT_$(1))
  $(BUILD_DIR)/plugins/$(1).wasm: ZIG_EXTRA_FLAGS := $$(ZIG_EXTRA_FLAGS_$(1))
  $(BUILD_DIR)/plugins/$(1).wasm: ZIG_C_SOURCES := $$(ZIG_C_SOURCES_$(1))
  $$(if $$(strip $$(ZIG_C_SOURCES_$(1))),$(BUILD_DIR)/plugins/$(1).wasm: $$(ZIG_C_SOURCES_$(1)))
  $$(if $$(strip $$(ZIG_EXTRA_DEPS_$(1))),$(BUILD_DIR)/plugins/$(1).wasm: $$(ZIG_EXTRA_DEPS_$(1)))

  # Cleanup manifest locals so they don't leak into next plugin
  PLUGIN_ODIN_WASM_TARGET :=
  PLUGIN_ODIN_OPT :=
  PLUGIN_ODIN_EXTRA_LINKER_FLAGS :=
  PLUGIN_ZIG_WASM_TARGET :=
  PLUGIN_ZIG_MCPU :=
  PLUGIN_ZIG_OPT :=
  PLUGIN_ZIG_EXTRA_FLAGS :=
  PLUGIN_C_SOURCES :=
  PLUGIN_EXTRA_DEPS :=
endef

$(foreach p,$(PLUGINS),$(eval $(call APPLY_PLUGIN_MANIFEST,$(p))))


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
	$(Q)zig build-exe $< \
		-target $(ZIG_WASM_TARGET) \
		$(if $(strip $(ZIG_MCPU)),-mcpu $(ZIG_MCPU),) \
		-fno-entry \
		-rdynamic \
		-O $(ZIG_OPT) \
		$(ZIG_EXTRA_FLAGS) \
		-femit-bin=$@

$(BUILD_DIR)/plugins/%.wasm: $(PLUGIN_DIR)/%/index.js $(wildcard $(PLUGIN_DIR)/%/*.zig) | $(BUILD_DIR)/plugins
	$(Q)echo "nothing to do $*..."
	$(Q)touch $@


# Rule to build Odin plugins
$(BUILD_DIR)/plugins/%.wasm: $(PLUGIN_DIR)/%/main.odin $(wildcard $(PLUGIN_DIR)/%/*.odin) | $(BUILD_DIR)/plugins
	$(Q)echo "Building Odin plugin $*..."
	$(Q)$(ODIN) build ./$(PLUGIN_DIR)/$* \
		-target:$(ODIN_WASM_TARGET) \
		-o:$(ODIN_OPT) \
		--no-entry-point \
		-out:$@ \
		$(if $(ODIN_EXTRA_LINKER_FLAGS),-extra-linker-flags:"$(ODIN_EXTRA_LINKER_FLAGS)",)

# Rule to build C plugins using Zig (bare WASM)
$(BUILD_DIR)/plugins/%.wasm: | $(BUILD_DIR)/plugins
	$(Q)echo "Building C plugin $*..."
	$(Q)zig build-exe $(if $(strip $(ZIG_C_SOURCES)),$(ZIG_C_SOURCES),$<) \
		-target $(ZIG_WASM_TARGET) \
		$(if $(strip $(ZIG_MCPU)),-mcpu $(ZIG_MCPU),) \
		-fno-entry \
		-rdynamic \
		-O $(ZIG_OPT) \
		$(ZIG_EXTRA_FLAGS) \
		-femit-bin=$@

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
