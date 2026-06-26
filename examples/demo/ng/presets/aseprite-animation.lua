local path = inputs[1]
if type(path) ~= "string" or path == "" then
	error("aseprite-animation: file path is required")
end

local animationNames = inputs[2]
if type(animationNames) ~= "table" then
	error("aseprite-animation: animation_names must be an array")
end
if #animationNames == 0 then
	error("aseprite-animation: at least one animation name is required")
end

local requested = {}
for index, name in ipairs(animationNames) do
	if type(name) ~= "string" or name == "" then
		error("aseprite-animation: animation name " .. tostring(index) .. " must be a non-empty string")
	end
	requested[name] = true
end

local function field(value, kebab, snake)
	local result = value[kebab]
	if result ~= nil then return result end
	return value[snake]
end

local function repeatCount(tag)
	local value = tag["repeat"]
	if value == nil or value == false or value == "" then
		return 0
	end
	local count = tonumber(value)
	if count == nil then
		error("aseprite-animation: tag " .. tostring(tag.name or "") .. " repeat must be numeric")
	end
	count = math.floor(count)
	if count < 0 then
		error("aseprite-animation: tag " .. tostring(tag.name or "") .. " repeat must be non-negative")
	end
	return count
end

local function frameSequence(fromFrame, toFrame, direction)
	local result = {}
	if direction == "reverse" then
		for frame = toFrame, fromFrame, -1 do
			result[#result + 1] = frame
		end
	elseif direction == "ping-pong" then
		for frame = fromFrame, toFrame do
			result[#result + 1] = frame
		end
		for frame = toFrame - 1, fromFrame + 1, -1 do
			result[#result + 1] = frame
		end
	elseif direction == "ping-pong-reverse" then
		for frame = toFrame, fromFrame, -1 do
			result[#result + 1] = frame
		end
		for frame = fromFrame + 1, toFrame - 1 do
			result[#result + 1] = frame
		end
	else
		for frame = fromFrame, toFrame do
			result[#result + 1] = frame
		end
	end
	return result
end

local doc = host.call("aseprite/aseprite::open", path)
local docInfo = host.call("aseprite/aseprite::info", doc)
local framesInfo = host.call("aseprite/aseprite::frames", doc)
local tags = host.call("aseprite/aseprite::tags", doc)

if type(docInfo) ~= "table" then
	error("aseprite-animation: aseprite info must be a table")
end
if type(framesInfo) ~= "table" then
	error("aseprite-animation: aseprite frames must be an array")
end
if type(tags) ~= "table" then
	error("aseprite-animation: aseprite tags must be an array")
end

local width = tonumber(docInfo.width) or 0
local height = tonumber(docInfo.height) or 0
if width <= 0 or height <= 0 then
	error("aseprite-animation: document width and height must be positive")
end

local tagsByName = {}
for _, tag in ipairs(tags) do
	local name = tostring(tag.name or "")
	if name ~= "" then
		tagsByName[name] = tag
	end
end

local rects = {}
local images = {}
local animations = {}

for _, animationName in ipairs(animationNames) do
	local tag = tagsByName[animationName]
	if tag == nil then
		error("aseprite-animation: missing tag " .. animationName)
	end

	local fromFrame = tonumber(field(tag, "from-frame", "from_frame"))
	local toFrame = tonumber(field(tag, "to-frame", "to_frame"))
	if fromFrame == nil or toFrame == nil then
		error("aseprite-animation: tag " .. animationName .. " is missing from-frame/to-frame")
	end
	fromFrame = math.floor(fromFrame)
	toFrame = math.floor(toFrame)
	if fromFrame < 0 or toFrame < fromFrame or toFrame >= #framesInfo then
		error("aseprite-animation: tag " .. animationName .. " frame range is out of bounds")
	end

	local direction = tostring(tag.direction or "forward")
	local sequence = frameSequence(fromFrame, toFrame, direction)
	local rectStart = #rects + 1

	for _, frameIndex in ipairs(sequence) do
		local pixels = host.call("aseprite/aseprite::render-frame", doc, frameIndex)
		if type(pixels) ~= "table" then
			error("aseprite-animation: render-frame returned non-table for frame " .. tostring(frameIndex))
		end
		local pixelsWidth = tonumber(pixels.width) or 0
		local pixelsHeight = tonumber(pixels.height) or 0
		if pixelsWidth ~= width or pixelsHeight ~= height then
			error("aseprite-animation: rendered frame dimensions do not match document dimensions")
		end
		if type(pixels.data) ~= "table" then
			error("aseprite-animation: rendered frame data must be an array")
		end
		if #pixels.data ~= width * height * 4 then
			error("aseprite-animation: rendered frame data length does not match dimensions")
		end

		local image = host.call("image/image::from-pixels", width, height, "rgba8", pixels.data)
		local frameInfo = framesInfo[frameIndex + 1]
		if type(frameInfo) ~= "table" then
			error("aseprite-animation: missing frame info for frame " .. tostring(frameIndex))
		end
		local durationMs = tonumber(field(frameInfo, "duration-ms", "duration_ms")) or 0
		if durationMs <= 0 then
			error("aseprite-animation: frame " .. tostring(frameIndex) .. " duration must be positive")
		end

		local rectId = #rects + 1
		rects[rectId] = {
			id = rectId,
			animation = animationName,
			frame = frameIndex,
			width = width,
			height = height,
			duration_ms = durationMs,
		}
		images[rectId] = image
	end

	local rectCount = #rects - rectStart + 1
	animations[#animations + 1] = {
		name = animationName,
		from_frame = fromFrame,
		to_frame = toFrame,
		direction = direction,
		rect_start = rectStart,
		rect_count = rectCount,
		frame_start = rectStart - 1,
		frame_count = rectCount,
		["repeat"] = repeatCount(tag),
	}
end

outputs[1] = rects
outputs[2] = images
outputs[3] = {
	path = path,
	width = width,
	height = height,
	animations = animations,
	frame_count = #rects,
}
