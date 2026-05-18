local okImage, image = pcall(json.decode, inputs[1] or "")
if not okImage or type(image) ~= "table" then
	outputs[1] = ""
	outputs[2] = "Invalid image JSON"
	return
end

local resource = image.resource or image.image
if resource == nil and image["$resource"] ~= nil then
	resource = image
end
if type(resource) ~= "table" then
	outputs[1] = ""
	outputs[2] = "image resource is required"
	return
end

local function decodeResult(text, label)
	local ok, response = pcall(json.decode, text)
	if not ok or type(response) ~= "table" then
		return nil, "Failed to parse " .. label .. " response: " .. tostring(text):sub(1, 100)
	end
	if response.err ~= nil then
		return nil, tostring(response.err)
	end
	return response.ok, nil
end

local transformedText = host.call("image/image::transform", resource, { "vertical" })
local transformed, transformErr = decodeResult(transformedText, "image.transform")
if transformed == nil then
	outputs[1] = ""
	outputs[2] = transformErr or "image.transform failed"
	return
end

outputs[1] = json.encode({
	image = transformed,
	resource = transformed,
	width = image.width,
	height = image.height,
	path = image.path,
	tileCount = image.tileCount,
	tilemapName = image.tilemapName,
	layerIndex = image.layerIndex,
	layerName = image.layerName,
	x = image.x,
	y = image.y,
	id = image.id,
	packed = image.packed,
})
outputs[2] = ""
