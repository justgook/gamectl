#include "pdk.h"

// Math plugin implemented in C
// Demonstrates:
// - Basic arithmetic operations
// - Simple JSON-like input parsing
// - Number formatting for output
// - Error handling

// Simple utility functions for number parsing and formatting
static uint32_t parse_uint32(const uint8_t *str, uint32_t len) {
    uint32_t result = 0;
    for (uint32_t i = 0; i < len; i++) {
        if (str[i] >= '0' && str[i] <= '9') {
            result = result * 10 + (str[i] - '0');
        } else {
            break;
        }
    }
    return result;
}

static uint32_t uint32_to_str(uint32_t value, char *buffer) {
    if (value == 0) {
        buffer[0] = '0';
        return 1;
    }
    
    uint32_t len = 0;
    uint32_t temp = value;
    while (temp > 0) {
        temp /= 10;
        len++;
    }
    
    for (uint32_t i = len; i > 0; i--) {
        buffer[i - 1] = '0' + (value % 10);
        value /= 10;
    }
    
    return len;
}

// Simple function to find a value after a key in input like "a=5,b=3"
static uint32_t find_value_after_key(const uint8_t *input, uint32_t input_len, char key) {
    for (uint32_t i = 0; i < input_len - 2; i++) {
        if (input[i] == key && input[i + 1] == '=') {
            uint32_t start = i + 2;
            uint32_t end = start;
            while (end < input_len && input[end] >= '0' && input[end] <= '9') {
                end++;
            }
            return parse_uint32(input + start, end - start);
        }
    }
    return 0;
}

// Add two numbers
// Input format: "a=5,b=3" -> Output: "8"
__attribute__((export_name("add"))) uint32_t add_numbers(void) {
    uint32_t input_len;
    const uint8_t *input = pdk_input(&input_len);
    
    // Parse input
    uint32_t a = find_value_after_key(input, input_len, 'a');
    uint32_t b = find_value_after_key(input, input_len, 'b');
    
    // Calculate result
    uint32_t result = a + b;
    
    // Format output
    char output_buffer[32];
    uint32_t output_len = uint32_to_str(result, output_buffer);
    
    pdk_output((const uint8_t*)output_buffer, output_len);
    return 0;
}

// Multiply two numbers
// Input format: "a=5,b=3" -> Output: "15"
__attribute__((export_name("multiply"))) uint32_t multiply_numbers(void) {
    uint32_t input_len;
    const uint8_t *input = pdk_input(&input_len);
    
    // Parse input
    uint32_t a = find_value_after_key(input, input_len, 'a');
    uint32_t b = find_value_after_key(input, input_len, 'b');
    
    // Calculate result
    uint32_t result = a * b;
    
    // Format output
    char output_buffer[32];
    uint32_t output_len = uint32_to_str(result, output_buffer);
    
    pdk_output((const uint8_t*)output_buffer, output_len);
    return 0;
}

// Calculate power (a^b) using simple iteration
// Input format: "a=2,b=3" -> Output: "8"
__attribute__((export_name("power"))) uint32_t power_numbers(void) {
    uint32_t input_len;
    const uint8_t *input = pdk_input(&input_len);
    
    // Parse input
    uint32_t base = find_value_after_key(input, input_len, 'a');
    uint32_t exponent = find_value_after_key(input, input_len, 'b');
    
    // Calculate result
    uint32_t result = 1;
    for (uint32_t i = 0; i < exponent; i++) {
        result *= base;
    }
    
    // Format output
    char output_buffer[32];
    uint32_t output_len = uint32_to_str(result, output_buffer);
    
    pdk_output((const uint8_t*)output_buffer, output_len);
    return 0;
}

// Test function that demonstrates plugin-to-plugin communication
// Uses the random plugin to generate a number and then squares it
__attribute__((export_name("random_square"))) uint32_t random_square(void) {
    // Call random plugin to get a random number
    pdk_call_result_t rand_result = pdk_call_plugin_str("random", "intn", (const uint8_t*)"100", 3);
    
    if (rand_result.error != 0) {
        const char error_msg[] = "Error calling random plugin";
        pdk_output((const uint8_t*)error_msg, sizeof(error_msg) - 1);
        return 1;
    }
    
    // Parse the random number from output
    uint32_t random_num = parse_uint32(rand_result.output, rand_result.output_len);
    
    // Square it
    uint32_t result = random_num * random_num;
    
    // Format output as "random_num^2 = result"
    char output_buffer[64];
    uint32_t pos = 0;
    
    // Add random number
    pos += uint32_to_str(random_num, output_buffer + pos);
    output_buffer[pos++] = '^';
    output_buffer[pos++] = '2';
    output_buffer[pos++] = ' ';
    output_buffer[pos++] = '=';
    output_buffer[pos++] = ' ';
    
    // Add result
    pos += uint32_to_str(result, output_buffer + pos);
    
    pdk_output((const uint8_t*)output_buffer, pos);
    return 0;
}

// Information function
__attribute__((export_name("info"))) uint32_t info(void) {
    const char info_msg[] = "Math plugin v1.0 - provides add, multiply, power, random_square functions";
    pdk_output((const uint8_t*)info_msg, sizeof(info_msg) - 1);
    return 0;
}