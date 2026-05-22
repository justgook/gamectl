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
ODIN ?= odin
ZIG ?= zig
ODIN_BUILD_FLAGS ?=
VET_PACKAGES ?= main,host,world,logic,grid,shape,sprite,tilemap,qoi

.DEFAULT_GOAL := help

BUILD_DIR ?= build.nosync
TOOLS_DIR ?= tools
TMP_DIR ?= $(BUILD_DIR)/tmp
SOKOL_DIR ?= sokol
SOKOL_SHDC_DIR ?= $(TOOLS_DIR)/sokol-shdc
WEB_DIR ?= $(BUILD_DIR)/web
NATIVE_DIR ?= $(BUILD_DIR)/native
NATIVE_BIN ?= $(NATIVE_DIR)/game2
WASM_BIN ?= $(WEB_DIR)/game2.wasm
WASM_INCLUDE_DIR ?= web/wasm-include
ODIN_WASM_TARGET ?= freestanding_wasm32
ODIN_WASM_OPT ?= speed
SOKOL_NATIVE_PROFILE ?= debug
SOKOL_MACOS_DEPLOYMENT_TARGET ?= 14.0

SHADER_SOURCES := $(shell find . -name '*.glsl' -print | LC_ALL=C sort | sed 's#^\./##' | tr '\n' ' ')

SOKOL_ODIN_URL ?= https://github.com/floooh/sokol-odin/archive/refs/heads/master.tar.gz
SOKOL_TOOLS_URL ?= https://github.com/floooh/sokol-tools-bin/archive/refs/heads/master.tar.gz

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Darwin)
  ifeq ($(UNAME_M),arm64)
    SOKOL_SHDC_BIN := $(SOKOL_SHDC_DIR)/osx_arm64/sokol-shdc
    SOKOL_NATIVE_ARCH := arm64
  else
    SOKOL_SHDC_BIN := $(SOKOL_SHDC_DIR)/osx/sokol-shdc
    SOKOL_NATIVE_ARCH := x64
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

SOKOL_NATIVE_LIBS := \
	$(SOKOL_DIR)/log/sokol_log_macos_$(SOKOL_NATIVE_ARCH)_metal_$(SOKOL_NATIVE_PROFILE).a \
	$(SOKOL_DIR)/gfx/sokol_gfx_macos_$(SOKOL_NATIVE_ARCH)_metal_$(SOKOL_NATIVE_PROFILE).a \
	$(SOKOL_DIR)/app/sokol_app_macos_$(SOKOL_NATIVE_ARCH)_metal_$(SOKOL_NATIVE_PROFILE).a \
	$(SOKOL_DIR)/glue/sokol_glue_macos_$(SOKOL_NATIVE_ARCH)_metal_$(SOKOL_NATIVE_PROFILE).a

NATIVE_EXTRA_LINKER_FLAGS :=
ODIN_NATIVE_ENV :=

ifeq ($(UNAME_S),Darwin)
  ODIN_NATIVE_ENV := PATH="$(dir $(shell xcrun -f clang)):$${PATH}"
  NATIVE_EXTRA_LINKER_FLAGS += \
	-framework Cocoa \
	-framework Foundation \
	-framework QuartzCore \
	-framework Metal \
	-framework AppKit \
	-framework CoreGraphics \
	-framework CoreFoundation \
	-lobjc
endif

.PHONY: help
help:
	$(Q)printf '%s\n' \
	  'Usage: make <target>' \
	  '' \
	  'Targets:' \
	  '  help            Show this help message' \
	  '  deps            Download/update sokol-odin bindings and sokol-shdc' \
	  '  sokol-bindings  Download/update local sokol-odin bindings' \
	  '  sokol-tools     Download/update local sokol-shdc binaries' \
	  '  lint            Run Odin checks with warnings as errors' \
	  '  wasm            Build standalone freestanding game2.wasm' \
	  '  native          Build native game2 executable' \
	  '  native-release  Build optimized native game2 executable' \
	  '  native-run      Build and run native game2 executable' \
	  '  web             Build standalone freestanding web bundle' \
	  '  serve           Serve standalone web bundle on :8812' \
	  '  shaders         Regenerate Odin shader bindings recursively' \
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
	find "$(SOKOL_DIR)" -name '*.odin' -print | while IFS= read -r file; do \
		perl -0pi -e 's/"env\.o"/"..\/..\/env.o"/g' "$$file"; \
	done; \
	if [ -f "$(SOKOL_DIR)/build_clibs_macos.sh" ]; then \
		perl -0pi -e 's/MACOSX_DEPLOYMENT_TARGET=10\.13/MACOSX_DEPLOYMENT_TARGET=$(SOKOL_MACOS_DEPLOYMENT_TARGET)/g' "$(SOKOL_DIR)/build_clibs_macos.sh"; \
	fi; \
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
shaders: $(SOKOL_SHDC_BIN) $(SHADER_SOURCES)
	$(Q)echo "Generating Odin shader bindings"
	$(Q)for src in $(SHADER_SOURCES); do \
		case "$$src" in \
			*/*) \
				dir=$${src%/*}; \
				file=$${src##*/}; \
				base=$${file%.glsl}; \
				out="$$dir/gen__$$base.odin"; \
				;; \
			*) \
				out="$$src.odin"; \
				;; \
		esac; \
		"$(SOKOL_SHDC_BIN)" -i "$$src" -o "$$out" -l glsl300es:metal_macos -f sokol_odin; \
	done

$(TMP_DIR):
	$(Q)$(MKDIR_P) "$(TMP_DIR)"

$(WEB_DIR):
	$(Q)$(MKDIR_P) "$(WEB_DIR)"

$(NATIVE_DIR):
	$(Q)$(MKDIR_P) "$(NATIVE_DIR)"


.PHONY: wasm-support
wasm-support: env.o

env.o: env.c sokol/c/sokol_gfx.c sokol/c/sokol_defines.h sokol/c/sokol_gfx.h $(WASM_INCLUDE_DIR)/gl_funcs.h $(WASM_INCLUDE_DIR)/GLES3/gl3.h
	$(Q)echo "Building game2 wasm support object"
	$(Q)$(ZIG) cc -c \
		-target wasm32-freestanding \
		-O2 -DNDEBUG \
		-I $(WASM_INCLUDE_DIR) \
		-o $@ \
		env.c

.PHONY: wasm
wasm: deps shaders wasm-support | $(WEB_DIR)
	$(Q)echo "Building standalone game2 wasm"
	$(Q)$(ODIN) build . \
		-target:$(ODIN_WASM_TARGET) \
		-o:$(ODIN_WASM_OPT) \
		--no-entry-point \
		-out:"$(WASM_BIN)"

.PHONY: native-libs
native-libs: $(SOKOL_NATIVE_LIBS)

$(SOKOL_NATIVE_LIBS): $(SOKOL_DIR)/build_clibs_macos.sh $(SOKOL_DIR)/c/sokol.c
	$(Q)echo "Building native sokol libraries"
	$(Q)chmod +x "$(SOKOL_DIR)/build_clibs_macos.sh"
	$(Q)cd "$(SOKOL_DIR)" && ./build_clibs_macos.sh

.PHONY: native
native: sokol-bindings shaders native-libs | $(NATIVE_DIR)
	$(Q)echo "Building native game2"
	$(Q)$(ODIN_NATIVE_ENV) $(ODIN) build . $(ODIN_BUILD_FLAGS) -out:"$(NATIVE_BIN)" -debug \
		$(if $(strip $(NATIVE_EXTRA_LINKER_FLAGS)),-extra-linker-flags:'$(NATIVE_EXTRA_LINKER_FLAGS)',)

.PHONY: native-run
native-run: native
	$(Q)"$(NATIVE_BIN)"

.PHONY: native-release
native-release:
	$(Q)$(MAKE) native SOKOL_NATIVE_PROFILE=release NATIVE_BIN="$(NATIVE_DIR)/game2-release" ODIN_BUILD_FLAGS="-o:speed"

.PHONY: web
web: wasm | $(WEB_DIR)
	$(Q)echo "Building standalone web bundle"
	$(Q)$(CP) web/index.html "$(WEB_DIR)/index.html"
	$(Q)$(CP) web/gl-bridge.js "$(WEB_DIR)/gl-bridge.js"

.PHONY: serve
serve: web
	$(Q)$(PYTHON3) -m http.server 8812 --directory "$(WEB_DIR)"

# fmt.tprintf("-vet-packages:%s", vet_packages),
# 				-vet-unused-procedures \
# 		-strict-target-features \

.PHONY: lint
lint:
	$(Q)$(ODIN_NATIVE_ENV) $(ODIN) check . \
		-disallow-do \
		-strict-style \
		-vet-cast \
		-vet-packages:$(VET_PACKAGES) \
		-vet-semicolon \
		-vet-shadowing \
		-vet-style \
		-vet-unused \
		-vet-unused-imports \
		-vet-unused-procedures \
		-vet-unused-variables \
		-vet-using-param \
		-vet-using-stmt \
		-warnings-as-errors 

.PHONY: clean
clean:
	$(Q)$(RM_RF) "$(BUILD_DIR)"
	$(Q)rm -f env.o
