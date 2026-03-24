package pdk

import mem "core:mem"

foreign import env_mod "env"

@(default_calling_convention = "c")
foreign env_mod {
	alloc :: proc(size: u64) -> u32 ---
	free :: proc(ptr: u32) ---
	input_ptr :: proc() -> u32 ---
	input_len :: proc() -> u32 ---
	set_output :: proc(ptr: u32, len: u32) ---
	plugin_call :: proc(module_ptr: u32, module_len: u32, func_ptr: u32, func_len: u32, input_ptr: u32, input_len: u32) -> u32 ---
	plugin_call_return :: proc() -> i32 ---
	plugin_call_output_ptr :: proc() -> u32 ---
	plugin_call_output_len :: proc() -> u32 ---
}

// input_bytes returns a read-only slice over the current call input buffer.
// The slice is valid for the duration of the call.
input_bytes :: proc() -> []u8 {
	len := int(input_len())
	if len == 0 {
		return []u8{}
	}
	ptr := cast(^u8)uintptr(input_ptr())
	return mem.slice_ptr(ptr, len)
}

// output_bytes copies the provided data into host-managed memory.
output_bytes :: proc(data: []u8) {
	count := len(data)
	if count == 0 {
		set_output(0, 0)
		return
	}
	ptr := alloc(u64(count))
	dst := mem.slice_ptr(cast(^u8)uintptr(ptr), count)
	copy(dst, data)
	set_output(ptr, u32(count))
}

output_string :: proc(msg: string) {
	bytes := transmute([]byte)msg
	output_bytes(bytes)
}

fs_read :: proc(path: string) -> ([]u8, string) {
	if path == "" {
		return nil, "path empty"
	}
	status, output, err := call("fs", "read", transmute([]u8)path)
	if err != "" {
		return nil, err
	}
	if status != 0 {
		return nil, string(output)
	}
	return output, ""
}

call :: proc(module_name, function_name: string, input: []u8) -> (i32, []u8, string) {
	module_len := len(module_name)
	func_len := len(function_name)
	input_len_value := len(input)

	module_ptr: u32
	if module_len > 0 {
		module_ptr = alloc(u64(module_len))
		module_bytes := mem.slice_ptr(cast(^u8)uintptr(module_ptr), module_len)
		copy(module_bytes, transmute([]u8)module_name)
	}

	func_ptr: u32
	if func_len > 0 {
		func_ptr = alloc(u64(func_len))
		func_bytes := mem.slice_ptr(cast(^u8)uintptr(func_ptr), func_len)
		copy(func_bytes, transmute([]u8)function_name)
	}

	input_ptr_value: u32
	if input_len_value > 0 {
		input_ptr_value = alloc(u64(input_len_value))
		input_bytes := mem.slice_ptr(cast(^u8)uintptr(input_ptr_value), input_len_value)
		copy(input_bytes, input)
	}

	transport_code := plugin_call(
		module_ptr,
		u32(module_len),
		func_ptr,
		u32(func_len),
		input_ptr_value,
		u32(input_len_value),
	)

	if module_ptr != 0 {
		free(module_ptr)
	}
	if func_ptr != 0 {
		free(func_ptr)
	}
	if input_ptr_value != 0 {
		free(input_ptr_value)
	}

	if transport_code != 0 {
		return 0, nil, "plugin call failed"
	}

	result_code := plugin_call_return()
	result_len := int(plugin_call_output_len())
	if result_len <= 0 {
		return result_code, []u8{}, ""
	}
	result_ptr := cast(^u8)uintptr(plugin_call_output_ptr())
	return result_code, mem.slice_ptr(result_ptr, result_len), ""
}

fs_write :: proc(path: string, data: []u8) -> (bool, string) {
	if path == "" {
		return false, "path empty"
	}
	input_len_value := len(path) + 1 + len(data)
	input_ptr_value := alloc(u64(input_len_value))
	input := mem.slice_ptr(cast(^u8)uintptr(input_ptr_value), input_len_value)
	copy(input[:len(path)], transmute([]u8)path)
	input[len(path)] = 0
	copy(input[len(path)+1:], data)

	status, output, err := call("fs", "write", input)
	free(input_ptr_value)
	if err != "" {
		return false, err
	}
	if status != 0 {
		return false, string(output)
	}
	return true, ""
}
