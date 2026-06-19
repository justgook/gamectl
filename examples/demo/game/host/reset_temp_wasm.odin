#+build freestanding

package host

reset_frame_temp_allocator :: proc() {
	reset_frame_temp_allocator_host()
}
