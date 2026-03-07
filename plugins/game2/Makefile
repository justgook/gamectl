.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

ifdef V
Q=
else
Q=@
MAKEFLAGS += --no-print-directory
endif

MKDIR_P ?= mkdir -p
RM_RF ?= rm -rf
CP ?= cp -f
CURL ?= curl -L
TAR ?= tar
PYTHON3 ?= python3

.DEFAULT_GOAL := help

BUILD_DIR ?= build.nosync
TOOLS_DIR ?= tools
TMP_DIR ?= $(BUILD_DIR)/tmp
SOKOL_DIR ?= sokol
SOKOL_SHDC_DIR ?= $(TOOLS_DIR)/sokol-shdc
WEB_DIR ?= $(BUILD_DIR)/web
ROOT_BUILD_DIR ?= ../../build.nosync
PLUGIN_WASM ?= $(ROOT_BUILD_DIR)/plugins/game2.wasm

SOKOL_ODIN_URL ?= https://github.com/floooh/sokol-odin/archive/refs/heads/master.tar.gz
SOKOL_TOOLS_URL ?= https://github.com/floooh/sokol-tools-bin/archive/refs/heads/master.tar.gz

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Darwin)
  ifeq ($(UNAME_M),arm64)
    SOKOL_SHDC_BIN := $(SOKOL_SHDC_DIR)/osx_arm64/sokol-shdc
  else
    SOKOL_SHDC_BIN := $(SOKOL_SHDC_DIR)/osx/sokol-shdc
  endif
else ifeq ($(UNAME_S),Linux)
  ifeq ($(UNAME_M),aarch64)
    SOKOL_SHDC_BIN := $(SOKOL_SHDC_DIR)/linux_arm64/sokol-shdc
  else
    SOKOL_SHDC_BIN := $(SOKOL_SHDC_DIR)/linux/sokol-shdc
  endif
else
  $(error Unsupported platform $(UNAME_S)/$(UNAME_M) for sokol-shdc download)
endif

.PHONY: help
help:
	$(Q)printf '%s\n' \
	  'Targets:' \
	  '  deps            Download/update sokol-odin bindings and sokol-shdc' \
	  '  sokol-bindings  Download/update local sokol-odin bindings' \
	  '  sokol-tools     Download/update local sokol-shdc binaries' \
	  '  plugin          Build embeddable freestanding game2.wasm via root Makefile' \
	  '  web             Build standalone freestanding web bundle' \
	  '  serve           Serve standalone web bundle on :8812' \
	  '  shaders         Regenerate Odin shader bindings' \
	  '  clean           Remove local build output'

.PHONY: deps
deps: sokol-bindings sokol-tools

.PHONY: sokol-bindings
sokol-bindings: $(SOKOL_DIR)/gfx/gfx.odin $(SOKOL_DIR)/app/app.odin $(SOKOL_DIR)/glue/glue.odin $(SOKOL_DIR)/log/log.odin

$(SOKOL_DIR)/gfx/gfx.odin $(SOKOL_DIR)/app/app.odin $(SOKOL_DIR)/glue/glue.odin $(SOKOL_DIR)/log/log.odin: | $(TMP_DIR)
	$(Q)echo "Downloading sokol-odin bindings"
	$(Q)tmp_root="$(TMP_DIR)/sokol-odin-download"; \
	archive="$$tmp_root.tar.gz"; \
	$(RM_RF) "$$tmp_root" "$$archive" "$(SOKOL_DIR)"; \
	$(MKDIR_P) "$$tmp_root"; \
	$(CURL) "$(SOKOL_ODIN_URL)" -o "$$archive"; \
	$(TAR) -xzf "$$archive" -C "$$tmp_root"; \
	set -- "$$tmp_root"/*; \
	root_dir="$$1"; \
	$(MKDIR_P) "$(SOKOL_DIR)"; \
	cp -R "$$root_dir/sokol/." "$(SOKOL_DIR)/"; \
	$(PYTHON3) -c 'from pathlib import Path; [p.write_text(p.read_text().replace("\"env.o\"", "\"../../env.o\"")) for p in Path("$(SOKOL_DIR)").glob("*/*.odin") if "\"env.o\"" in p.read_text()]'; \
	$(RM_RF) "$$tmp_root" "$$archive"

.PHONY: sokol-tools
sokol-tools: $(SOKOL_SHDC_BIN)

$(SOKOL_SHDC_BIN): | $(TMP_DIR)
	$(Q)echo "Downloading sokol-shdc"
	$(Q)tmp_root="$(TMP_DIR)/sokol-tools-download"; \
	archive="$$tmp_root.tar.gz"; \
	$(RM_RF) "$$tmp_root" "$$archive" "$(SOKOL_SHDC_DIR)"; \
	$(MKDIR_P) "$$tmp_root" "$(SOKOL_SHDC_DIR)"; \
	$(CURL) "$(SOKOL_TOOLS_URL)" -o "$$archive"; \
	$(TAR) -xzf "$$archive" -C "$$tmp_root"; \
	set -- "$$tmp_root"/*; \
	root_dir="$$1"; \
	cp -R "$$root_dir/bin/." "$(SOKOL_SHDC_DIR)/"; \
	chmod +x "$(SOKOL_SHDC_DIR)"/osx/sokol-shdc 2>/dev/null || true; \
	chmod +x "$(SOKOL_SHDC_DIR)"/osx_arm64/sokol-shdc 2>/dev/null || true; \
	chmod +x "$(SOKOL_SHDC_DIR)"/linux/sokol-shdc 2>/dev/null || true; \
	chmod +x "$(SOKOL_SHDC_DIR)"/linux_arm64/sokol-shdc 2>/dev/null || true; \
	$(RM_RF) "$$tmp_root" "$$archive"

.PHONY: shaders
shaders: $(SOKOL_SHDC_BIN) triangle-sapp.glsl
	$(Q)echo "Generating Odin shader bindings"
	$(Q)"$(SOKOL_SHDC_BIN)" -i triangle-sapp.glsl -o triangle-sapp.glsl.odin -l glsl300es:metal_macos -f sokol_odin 

$(TMP_DIR):
	$(Q)$(MKDIR_P) "$(TMP_DIR)"

$(WEB_DIR):
	$(Q)$(MKDIR_P) "$(WEB_DIR)"

.PHONY: plugin
plugin:
	$(Q)$(MAKE) -C ../.. build.nosync/plugins/game2.wasm

.PHONY: web
web: plugin | $(WEB_DIR)
	$(Q)echo "Building standalone web bundle"
	$(Q)$(CP) "$(PLUGIN_WASM)" "$(WEB_DIR)/game2.wasm"
	$(Q)$(CP) web/index.html "$(WEB_DIR)/index.html"
	$(Q)$(CP) ../../cmd/browser/util/gl-bridge.js "$(WEB_DIR)/gl-bridge.js"

.PHONY: serve
serve: web
	$(Q)python3 -m http.server 8812 --directory "$(WEB_DIR)"

.PHONY: clean
clean:
	$(Q)$(RM_RF) "$(BUILD_DIR)"
