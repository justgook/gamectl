.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
MAKEFLAGS += --no-builtin-rules --warn-undefined-variables

ODIN ?= odin
ZIG ?= zig
PYTHON3 ?= python3
CURL ?= curl -L --fail
SHA256 ?= shasum -a 256
BUILD_DIR ?= build.nosync
TOOLS_DIR ?= $(BUILD_DIR)/tools
SOKOL_DIR ?= sokol
WEB_DIR ?= $(BUILD_DIR)/web
WASM_BIN ?= $(WEB_DIR)/station-demo.wasm
WASM_INCLUDE_DIR ?= web/wasm-include
CONTENT_PACK ?= ../content/generated/power.rspk
FIXTURE_PACK ?= $(BUILD_DIR)/test-fixtures/station.rspk

# Immutable upstream revisions, recorded in THIRD_PARTY.md.
SOKOL_ODIN_REV := 9ea6ec125f002180d6cc6e7a009087ca0a019da4
SOKOL_TOOLS_REV := 11d0cf678105d614d675e6d9bd2aaf3eeff12f8c
SOKOL_ODIN_URL := https://github.com/floooh/sokol-odin/archive/$(SOKOL_ODIN_REV).tar.gz
SOKOL_TOOLS_URL := https://github.com/floooh/sokol-tools-bin/archive/$(SOKOL_TOOLS_REV).tar.gz
SOKOL_ODIN_SHA256 := 0eebee1d50bb08f1bf44f5458d8c32d61e4c2069d73a2eddb9feeb7c04d185ba
SOKOL_TOOLS_SHA256 := c18bc3d9a52d63f385fcff9d04461e0f1c58f84102a0386acf59b6747655d17d

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)
ifeq ($(UNAME_S),Darwin)
  ifeq ($(UNAME_M),arm64)
    SHDC_PLATFORM := osx_arm64
  else
    SHDC_PLATFORM := osx
  endif
else ifeq ($(UNAME_S),Linux)
  ifeq ($(UNAME_M),aarch64)
    SHDC_PLATFORM := linux_arm64
  else
    SHDC_PLATFORM := linux
  endif
else
  $(error Unsupported host for pinned sokol-shdc: $(UNAME_S)/$(UNAME_M))
endif
SHDC := $(TOOLS_DIR)/sokol-shdc/$(SHDC_PLATFORM)/sokol-shdc

.DEFAULT_GOAL := help
.PHONY: help deps fixture test check wasm web serve clean
help:
	@printf '%s\n' 'make test | check | web | serve | clean'

deps: $(SOKOL_DIR)/gfx/gfx.odin $(SHDC)

$(BUILD_DIR):
	@mkdir -p $@

$(SOKOL_DIR)/gfx/gfx.odin: | $(BUILD_DIR)
	@echo 'Fetching pinned sokol-odin $(SOKOL_ODIN_REV)'
	@tmp='$(BUILD_DIR)/sokol-odin'; rm -rf "$$tmp" '$(SOKOL_DIR)'; mkdir -p "$$tmp" '$(SOKOL_DIR)' THIRD_PARTY_LICENSES
	@$(CURL) '$(SOKOL_ODIN_URL)' -o "$$tmp.tar.gz"
	@printf '%s  %s\n' '$(SOKOL_ODIN_SHA256)' "$$tmp.tar.gz" | $(SHA256) -c -
	@tar -xzf "$$tmp.tar.gz" -C "$$tmp"; root=$$(find "$$tmp" -mindepth 1 -maxdepth 1 -type d | head -1); cp -R "$$root/sokol/." '$(SOKOL_DIR)/'; cp "$$root/LICENSE" THIRD_PARTY_LICENSES/sokol-odin.txt
	@find '$(SOKOL_DIR)' -name '*.odin' -exec perl -0pi -e 's@(\s*)(foreign import [A-Za-z0-9_]+ \{ )"env\.o" \}@$$1// GAMS station demo modification: link local ../../env.o instead of upstream env.o.$$1$$2"../../env.o" }@g' {} +
	@rm -rf "$$tmp" "$$tmp.tar.gz"

$(SHDC): | $(BUILD_DIR)
	@echo 'Fetching pinned sokol-tools-bin $(SOKOL_TOOLS_REV)'
	@tmp='$(BUILD_DIR)/sokol-tools'; rm -rf "$$tmp" '$(TOOLS_DIR)/sokol-shdc'; mkdir -p "$$tmp" '$(TOOLS_DIR)/sokol-shdc' THIRD_PARTY_LICENSES
	@$(CURL) '$(SOKOL_TOOLS_URL)' -o "$$tmp.tar.gz"
	@printf '%s  %s\n' '$(SOKOL_TOOLS_SHA256)' "$$tmp.tar.gz" | $(SHA256) -c -
	@tar -xzf "$$tmp.tar.gz" -C "$$tmp"; root=$$(find "$$tmp" -mindepth 1 -maxdepth 1 -type d | head -1); cp -R "$$root/bin/." '$(TOOLS_DIR)/sokol-shdc/'; cp "$$root/LICENSE" THIRD_PARTY_LICENSES/sokol-tools-bin.txt; chmod +x '$@'
	@rm -rf "$$tmp" "$$tmp.tar.gz"

room.glsl.odin: room.glsl $(SHDC)
	@$(SHDC) -i room.glsl -o $@ -l glsl300es:metal_macos -f sokol_odin

station.rspk: $(CONTENT_PACK)
	@cp '$<' '$@'

fixture: $(FIXTURE_PACK)
$(FIXTURE_PACK): tools/make_fixture.py CONTRACT.md | $(BUILD_DIR)
	@mkdir -p '$(@D)'
	@$(PYTHON3) tools/make_fixture.py '$@'

test: station.rspk
	@$(ODIN) test station -all-packages
	@$(ODIN) test content -all-packages

check: deps room.glsl.odin station.rspk
	@$(ODIN) check . -target:freestanding_wasm32 --no-entry-point

env.o: env.c $(SOKOL_DIR)/c/sokol_gfx.c $(WASM_INCLUDE_DIR)/gl_funcs.h $(WASM_INCLUDE_DIR)/GLES3/gl3.h
	@$(ZIG) cc -c -target wasm32-freestanding -O2 -DNDEBUG -I $(WASM_INCLUDE_DIR) -o $@ env.c

wasm: deps room.glsl.odin env.o station.rspk | $(WEB_DIR)
	@$(ODIN) build . -target:freestanding_wasm32 -o:speed --no-entry-point -out:'$(WASM_BIN)'

$(WEB_DIR):
	@mkdir -p $@

web: wasm
	@cp web/index.html web/gl-bridge.js station.rspk '$(WEB_DIR)/'
	@echo 'Built $(WEB_DIR)'

serve: web
	@$(PYTHON3) -m http.server 8814 --directory '$(WEB_DIR)'

clean:
	@rm -rf '$(BUILD_DIR)' '$(SOKOL_DIR)' env.o room.glsl.odin station.rspk
