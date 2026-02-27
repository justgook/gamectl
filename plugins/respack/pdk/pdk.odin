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
