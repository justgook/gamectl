BUILD_DIR ?= ../../build.nosync
PLUGIN_BUILD_DIR ?= $(BUILD_DIR)/plugins
WASI_P2_CC ?= wasm32-wasip2-clang

run: $(PLUGIN_BUILD_DIR)/adder.wasm components/calculator/calculator.component.wasm
	cargo run -- \
		--plug $(PLUGIN_BUILD_DIR)/adder.wasm \
		--plug components/calculator/calculator.component.wasm \
		--invoke 'docs:calculator/calculate@0.1.0.eval-expression(add, 23, 3)'

$(PLUGIN_BUILD_DIR)/adder.wasm:
	$(MAKE) -C ../.. BUILD_DIR="$(abspath $(BUILD_DIR))" "$(abspath $@)"

components/calculator/calculator.component.wasm: components/calculator/component.c components/calculator/calculator.c components/calculator/calculator_component_type.o
	$(WASI_P2_CC) -o $@ -mexec-model=reactor $?

components/calculator/calculator.h:
	wit-bindgen c wit -w docs:calculator/calculator@0.1.0
