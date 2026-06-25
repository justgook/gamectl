local rects = inputs[1]
if rects == nil then
	error("rects input is required")
end

local width = inputs[2]
if width == nil or width == "" then
	width = "1"
end

local height = inputs[3]
if height == nil or height == "" then
	height = "1"
end

local padding = inputs[4]
if padding == nil or padding == "" then
	padding = "0"
end

local autoSize = inputs[5]
if autoSize == nil or autoSize == "" then
	autoSize = "true"
end

local autoSizeBool = autoSize == true or autoSize == "true" or autoSize == "1" or autoSize == 1
local requestRects = {}

for index, rect in ipairs(rects) do
	if type(rect) ~= "table" then
		error("Rect item must be an object")
	end

	local rectId = tonumber(rect.id) or index
	local rectWidth = tonumber(rect.width) or 0
	local rectHeight = tonumber(rect.height) or 0
	if rectWidth <= 0 or rectHeight <= 0 then
		error("Rect width and height must be positive")
	end

	requestRects[#requestRects + 1] = {
		id = rectId,
		width = rectWidth,
		height = rectHeight,
	}
	rect.id = rectId
end

local request = {
	width = tonumber(width) or 1,
	height = tonumber(height) or 1,
	padding = tonumber(padding) or 0,
	["auto-size"] = autoSizeBool,
	rects = requestRects,
}

local response = host.call("pack/pack::pack", request)
if type(response) ~= "table" then
	error("pack-rects: pack response must be a table")
end
if type(response.rects) ~= "table" then
	error("pack-rects: pack response rects must be an array")
end

local atlasWidth = tonumber(response.width) or 0
local atlasHeight = tonumber(response.height) or 0
if atlasWidth <= 0 or atlasHeight <= 0 then
	error("pack-rects: response atlas width and height must be positive")
end

local uvs = {}
for index, rect in ipairs(rects) do
	local packedRect = response.rects[index]
	if type(packedRect) ~= "table" then
		error("pack-rects: missing packed rect " .. tostring(index))
	end
	if packedRect.packed ~= true then
		error("pack-rects: rect " .. tostring(index) .. " was not packed")
	end

	local x = tonumber(packedRect.x)
	local y = tonumber(packedRect.y)
	local rectWidth = tonumber(packedRect.width) or tonumber(rect.width) or 0
	local rectHeight = tonumber(packedRect.height) or tonumber(rect.height) or 0
	if x == nil or y == nil then
		error("pack-rects: packed rect " .. tostring(index) .. " is missing x/y")
	end
	if rectWidth <= 0 or rectHeight <= 0 then
		error("pack-rects: packed rect " .. tostring(index) .. " width and height must be positive")
	end

	rect.x = x
	rect.y = y
	rect.width = rectWidth
	rect.height = rectHeight
	rect.packed = true

	uvs[index] = {
		x / atlasWidth,
		y / atlasHeight,
		(x + rectWidth) / atlasWidth,
		(y + rectHeight) / atlasHeight,
	}
end

outputs[1] = rects
outputs[2] = uvs
