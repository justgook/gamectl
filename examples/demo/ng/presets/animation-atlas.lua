-- Animation Atlas
-- Builds world.Animation_Atlas-compatible data from Aseprite animation metadata and packed rects.
--
-- Inputs:
--   atlas: object with frames and defs arrays. This is commonly produced by wrapping Aseprite
--          rects as "frames" and copying Aseprite info.animations to "defs".
--   rects: packed rect tree from Pack Rects output. Used to derive uv_index from final UV order.
--
-- Output:
--   atlas: { defs = AnimDef[], frames = AnimFrame[] }

local atlas = inputs[1]
if type(atlas) ~= "table" then
	error("atlas must be an object")
end

local packed_rects = inputs[2]
if type(packed_rects) ~= "table" then
	error("rects must be a packed rect tree")
end

local input_frames = atlas.frames
if type(input_frames) ~= "table" then
	error("atlas.frames must be an array")
end

local input_defs = atlas.defs
if type(input_defs) ~= "table" then
	error("atlas.defs must be an array")
end

local function is_rect(value)
	return type(value) == "table" and (value.width ~= nil or value.height ~= nil or value.id ~= nil)
end

local anim_rects = {}
local flat_index = 0

local function collect_anim_rects(node, path)
	if type(node) ~= "table" then
		error("rect tree item at " .. path .. " must be an array or rect object")
	end

	if is_rect(node) then
		if node.animation ~= nil then
			anim_rects[#anim_rects + 1] = {
				rect = node,
				uv_index = flat_index,
			}
		end
		flat_index = flat_index + 1
		return
	end

	for index, child in ipairs(node) do
		collect_anim_rects(child, path .. "[" .. tostring(index) .. "]")
	end
end

collect_anim_rects(packed_rects, "rects")

local function optional_vec2_i32(value, label)
	if value == nil then
		return {0, 0}
	end
	if type(value) ~= "table" then
		error(label .. " must be [x, y]")
	end
	local x = tonumber(value[1])
	local y = tonumber(value[2])
	if x == nil or y == nil then
		error(label .. " must contain numeric x/y")
	end
	return {math.floor(x), math.floor(y)}
end

local function frame_duration(frame, rect, label)
	local duration = frame.duration
	if duration == nil then
		duration = rect.duration
	end
	if duration == nil then
		local duration_ms = frame.duration_ms or rect.duration_ms
		if duration_ms ~= nil then
			duration = tonumber(duration_ms) / 1000.0
		end
	end
	if duration == nil then
		duration = 0.1
	end
	duration = tonumber(duration)
	if duration == nil or duration <= 0 then
		error(label .. " duration must be positive")
	end
	return duration
end

local out_defs = {}
local out_frames = {}

for def_index, def in ipairs(input_defs) do
	if type(def) ~= "table" then
		error("defs[" .. tostring(def_index) .. "] must be an object")
	end

	local rect_start = tonumber(def.rect_start)
	local frame_count = tonumber(def.frame_count or def.rect_count)
	if rect_start == nil then
		local frame_start = tonumber(def.frame_start)
		if frame_start == nil then
			error("defs[" .. tostring(def_index) .. "] requires rect_start or frame_start")
		end
		rect_start = math.floor(frame_start) + 1
	end
	if frame_count == nil then
		error("defs[" .. tostring(def_index) .. "] requires frame_count or rect_count")
	end

	rect_start = math.floor(rect_start)
	frame_count = math.floor(frame_count)
	if rect_start < 1 then
		error("defs[" .. tostring(def_index) .. "] rect_start must be one-based")
	end
	if frame_count < 0 then
		error("defs[" .. tostring(def_index) .. "] frame_count must be non-negative")
	end
	if rect_start + frame_count - 1 > #anim_rects then
		error("defs[" .. tostring(def_index) .. "] frame range exceeds animation rect count")
	end

	local repeat_count = tonumber(def["repeat"])
	if repeat_count == nil then
		repeat_count = 0
	end
	repeat_count = math.floor(repeat_count)
	if repeat_count < 0 then
		error("defs[" .. tostring(def_index) .. "] repeat must be non-negative")
	end

	local frame_start = #out_frames
	for frame_offset = 0, frame_count - 1 do
		local source_index = rect_start + frame_offset
		local source_frame = input_frames[source_index]
		if type(source_frame) ~= "table" then
			error("frames[" .. tostring(source_index) .. "] must be an object")
		end
		local packed = anim_rects[source_index]
		local label = "frames[" .. tostring(source_index) .. "]"

		out_frames[#out_frames + 1] = {
			uv_index = packed.uv_index,
			offset = optional_vec2_i32(source_frame.offset or packed.rect.offset, label .. ".offset"),
			duration = frame_duration(source_frame, packed.rect, label),
			flip = math.floor(tonumber(source_frame.flip or packed.rect.flip or 0) or 0),
		}
	end

	out_defs[#out_defs + 1] = {
		frame_start = frame_start,
		frame_count = frame_count,
		["repeat"] = repeat_count,
	}
end

outputs[1] = {
	defs = out_defs,
	frames = out_frames,
}
