
run: components/calculator/calculator.component.wasm components/adder/adder.component.wasm
	cargo run -- \
         --plug components/adder/adder.component.wasm \
        --plug components/calculator/calculator.component.wasm \
        --invoke 'docs:calculator/calculate@0.1.0.eval-expression(add, 23, 3)'

components/calculator/calculator.component.wasm: components/calculator/component.c components/calculator/calculator.c components/calculator/calculator_component_type.o
	~/Repos/wasi-sdk/bin/wasm32-wasip2-clang -o $@ -mexec-model=reactor $? 
components/adder/adder.component.wasm: components/adder/component.c components/adder/adder.c components/adder/adder_component_type.o
	~/Repos/wasi-sdk/bin/wasm32-wasip2-clang -o $@ -mexec-model=reactor $?
components/calculator/calculator.h:
	wit-bindgen c wit -w docs:calculator/calculator@0.1.0

