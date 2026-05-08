.ONESHELL:
.SHELLFLAGS := -eu -c
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
CP ?= cp -f

.DEFAULT_GOAL := all

BUILD_DIR ?= build.nosync
SOKOL_SHDC ?= ./sokol-shdc

triangle-sapp.glsl.h: triangle-sapp.glsl
	$(Q)if [ -x "$(SOKOL_SHDC)" ]; then \
		"$(SOKOL_SHDC)" --input triangle-sapp.glsl --output triangle-sapp.glsl.h --slang glsl430:metal_macos:glsl300es; \
	elif command -v sokol-shdc >/dev/null 2>&1; then \
		sokol-shdc --input triangle-sapp.glsl --output triangle-sapp.glsl.h --slang glsl430:metal_macos:glsl300es; \
	elif [ -f triangle-sapp.glsl.h ]; then \
		echo "Using existing triangle-sapp.glsl.h (sokol-shdc not found)"; \
	else \
		echo "sokol-shdc not found and triangle-sapp.glsl.h is missing"; \
		exit 1; \
	fi

.PHONY: all
all: build

.PHONY: build
build: triangle-sapp.glsl.h | $(BUILD_DIR)
	$(Q)echo "Building native app"
	$(Q)zig build-exe \
		osx/sokol_impl.m osx/main.c osx/asset_io_osx.c main.c \
		-framework Metal -framework MetalKit \
		-framework Cocoa -framework QuartzCore -framework Foundation \
		-femit-bin=$(BUILD_DIR)/triangle

.PHONY: web
web: $(BUILD_DIR)/web/triangle.wasm $(BUILD_DIR)/web/index.html $(BUILD_DIR)/web/gl-bridge.js

$(BUILD_DIR)/web/triangle.wasm: triangle-sapp.glsl.h web/main.c main.c | $(BUILD_DIR)/web
	$(Q)echo "Building web wasm"
	$(Q)zig build-exe \
		web/main.c web/asset_io_web.c main.c \
		-target wasm32-freestanding \
		-fno-entry \
		-rdynamic \
		-O ReleaseFast \
		-I web/wasm-include \
		-femit-bin=$@

$(BUILD_DIR)/web/index.html: web/index.html | $(BUILD_DIR)/web
	$(Q)$(CP) $< $@

$(BUILD_DIR)/web/gl-bridge.js: ../../cmd/browser/util/gl-bridge.js | $(BUILD_DIR)/web
	$(Q)$(CP) $< $@

$(BUILD_DIR):
	$(Q)$(MKDIR_P) $(BUILD_DIR)

$(BUILD_DIR)/web: | $(BUILD_DIR)
	$(Q)$(MKDIR_P) $(BUILD_DIR)/web

.PHONY: serve
serve: web
	$(Q)python3 -m http.server 8812 --directory $(BUILD_DIR)/web

.PHONY: clean
clean:
	$(Q)rm -rf $(BUILD_DIR)
