package ui

import "core:math"

// Frame is a monotonically increasing frame counter since game start.
// Animation periods are expressed in frames, not seconds/milliseconds.
Frame :: u64

@(require_results)
phase :: proc(period_frames: u64, frame: Frame) -> f32 {
	assert(period_frames > 0)
	return f32(u64(frame) % period_frames) / f32(period_frames)
}

@(require_results)
wave :: proc(lo, hi: f32, period_frames: u64, frame: Frame) -> f32 {
	return lo + (hi - lo) * (1.0 + math.cos(2.0 * math.PI * phase(period_frames, frame))) / 2.0
}

@(require_results)
zigzag :: proc(lo, hi: f32, period_frames: u64, frame: Frame) -> f32 {
	return lo + (hi - lo) * math.abs(2.0 * phase(period_frames, frame) - 1.0)
}
