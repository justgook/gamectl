local function isArray(value)
	if type(value) ~= "table" then
		return false
	end

	local length = 0
	for key, _ in pairs(value) do
		if type(key) ~= "number" or key < 1 or key ~= math.floor(key) then
			return false
		end
		if key > length then
			length = key
		end
	end

	for index = 1, length do
		if value[index] == nil then
			return false
		end
	end

	return true
end

local function asArray(value, label)
	if value == nil or value == "" then
		error(label .. " is required")
	end
	if type(value) ~= "table" then
		error(label .. " must be a table or array")
	end
	if isArray(value) then
		return value
	end
	return { value }
end

local rects = asArray(inputs[1], "rects input")
local images = asArray(inputs[2], "images input")

local atlasWidth = tonumber(inputs[3]) or 0
local atlasHeight = tonumber(inputs[4]) or 0
local imageCount = 0

for _, rect in ipairs(rects) do
	local width = rect.width
	local height = rect.height
	if width <= 0 or height <= 0 then
		error("Image width and height must be positive")
	end

	local x = rect.x
	local y = rect.y
	if x + width > atlasWidth then
		atlasWidth = x + width
	end
	if y + height > atlasHeight then
		atlasHeight = y + height
	end
	imageCount = imageCount + 1
end

if imageCount == 0 then
	error("No images to build atlas from")
end

if #images ~= imageCount then
	error("images input length must match rects input length")
end

local atlas = host.call("image/image::create", atlasWidth, atlasHeight, json.null)

for index, rect in ipairs(rects) do
	local src = images[index]

	local blitted = host.call("image/image::blit", atlas, src, {
		x = math.floor(tonumber(rect.x) or 0),
		y = math.floor(tonumber(rect.y) or 0),
	})
	if blitted == nil then
		error("image.blit failed")
	end
	atlas = blitted
end

outputs[1] = atlas
