PLUGIN_WASM_COMPONENT := 1
PLUGIN_WIT_WORLD := gams:director-compiler/director-compiler-plugin@1.0.0
PLUGIN_COMPONENT_NAME := director_compiler_plugin

DIRECTOR_COMPILER_PATH := $(PLUGIN_PATH)
DIRECTOR_COMPILER_ODIN_OBJ := $(BUILD_DIR)/obj/plugins/$(PLUGIN_NAME)/director_compiler_core.o.wasm

PLUGIN_COMPONENT_SOURCES := \
  $(DIRECTOR_COMPILER_PATH)/component.c \
  $(DIRECTOR_COMPILER_ODIN_OBJ)

PLUGIN_COMPONENT_EXTRA_DEPS := \
  $(DIRECTOR_COMPILER_PATH)/plugin.mk \
  $(DIRECTOR_COMPILER_PATH)/component.c \
  $(wildcard $(DIRECTOR_COMPILER_PATH)/*.odin) \
  $(DIRECTOR_COMPILER_ODIN_OBJ)

$(BUILD_DIR)/obj/plugins/$(PLUGIN_NAME):
	$(Q)mkdir -p $@

$(DIRECTOR_COMPILER_ODIN_OBJ): $(wildcard $(DIRECTOR_COMPILER_PATH)/*.odin) | $(BUILD_DIR)/obj/plugins/$(PLUGIN_NAME)
	$(Q)rm -f "$@" "$(patsubst %.wasm,%.obj,$@)"
	$(Q)$(ODIN) build ./$(DIRECTOR_COMPILER_PATH) \
		-target:wasi_wasm32 \
		-build-mode:obj \
		--no-entry-point \
		-o:$(ODIN_OPT) \
		-out:$@
	$(Q)if [ -f "$(patsubst %.wasm,%.obj,$@)" ]; then \
		mv "$(patsubst %.wasm,%.obj,$@)" "$@"; \
	fi
	$(Q)test -f "$@"
