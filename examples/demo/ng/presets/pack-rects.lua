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

for index, rect in ipairs(rects) do
	local packedRect = response.rects[index]
	rect.x = packedRect.x or 0
	rect.y = packedRect.y or 0
	rect.packed = packedRect.packed == true
end

outputs[1] = rects
