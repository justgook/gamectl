package world


UV :: [4]f32
// GAME_DATA :: #config(GAME_DATA, "../../build.nosync/game.bin")
// GAME_ATLAS :: #config(GAME_DATA, "../../build.nosync/atlas.qoi")

// Constants for subpixel precision
SUBPIXEL_BITS :: 6 // 64 subpixels per pixel
UNIT :: 1 << SUBPIXEL_BITS

@(require_results)
to_pixel :: proc(#any_int subpixel: int) -> int {
	return subpixel >> SUBPIXEL_BITS
}

@(require_results)
to_pixelf :: proc {
	to_pixelf_int,
	to_pixelf_int_2,
	// to_pixelf_i32,
	to_pixelf_i32_2,
}

@(require_results)
to_pixelf_int :: proc(#any_int subpixel: int) -> f32 {
	return f32(subpixel >> SUBPIXEL_BITS)
}

// @(require_results)
// to_pixelf_i32 :: proc(subpixel: i32) -> f32 {
// 	return f32(subpixel >> SUBPIXEL_BITS)
// }

@(require_results)
to_pixelf_int_2 :: proc(subpixel: [2]int) -> [2]f32 {
	return [2]f32{f32(subpixel.x >> SUBPIXEL_BITS), f32(subpixel.y >> SUBPIXEL_BITS)}
}
//
@(require_results)
to_pixelf_i32_2 :: proc(subpixel: [2]i32) -> [2]f32 {
	return [2]f32{f32(subpixel.x >> SUBPIXEL_BITS), f32(subpixel.y >> SUBPIXEL_BITS)}
}
