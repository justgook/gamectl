GAME2_WASM_SUPPORT_OBJ := $(PLUGIN_DIR)/game2/env.o

PLUGIN_ODIN_WASM_TARGET := freestanding_wasm32
PLUGIN_ODIN_OPT := speed

PLUGIN_EXTRA_DEPS := \
	$(GAME2_WASM_SUPPORT_OBJ) \
	$(shell python3 -c 'from pathlib import Path; files = [str(p) for p in sorted(Path("plugins/game2").rglob("*.odin"))]; print(" ".join(files))') \
	$(shell python3 -c 'from pathlib import Path; print(" ".join(str(p) for p in sorted(Path("plugins/game2").rglob("*.glsl"))))')

$(GAME2_WASM_SUPPORT_OBJ): \
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
