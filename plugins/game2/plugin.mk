PLUGIN_ODIN_WASM_TARGET := freestanding_wasm32
PLUGIN_ODIN_OPT := speed

PLUGIN_EXTRA_DEPS := \
	$(PLUGIN_DIR)/game2/env.o \
	$(PLUGIN_DIR)/game2/triangle-sapp.glsl.odin \
	$(wildcard $(PLUGIN_DIR)/game2/sokol/*/*.odin)

$(PLUGIN_DIR)/game2/env.o: \
	$(PLUGIN_DIR)/game2/env.c \
	$(PLUGIN_DIR)/game2/sokol/c/sokol_gfx.c \
	$(PLUGIN_DIR)/game2/sokol/c/sokol_defines.h \
	$(PLUGIN_DIR)/game2/sokol/c/sokol_gfx.h \
	plugins/game/web/wasm-include/gl_funcs.h \
	plugins/game/web/wasm-include/GLES3/gl3.h
	$(Q)echo "Building game2 wasm support object"
	$(Q)zig cc -c \
		-target wasm32-freestanding \
		-O2 -DNDEBUG \
		-I plugins/game/web/wasm-include \
		-o $@ \
		$(PLUGIN_DIR)/game2/env.c
