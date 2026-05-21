local rects = inputs[1]
local images = inputs[2]

local atlasWidth = 0
local atlasHeight = 0
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
