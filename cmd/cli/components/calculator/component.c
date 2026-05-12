#include "calculator.h"
uint32_t exports_docs_calculator_calculate_eval_expression(
    exports_docs_calculator_calculate_op_t op, uint32_t x, uint32_t y) {
  return docs_adder_add_add(x, y);
}
