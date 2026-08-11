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

local function itemAt(value, index)
	if type(value) == "table" and isArray(value) then
		return value[index]
	end
	return value
end

local function generateLayerLut(layers, layerSelector, label)
	local layer = layers[layerSelector]
	if type(layer) ~= "table" then
		error(label .. " layer not found at index " .. tostring(layerSelector))
	end

	local width = math.floor(tonumber(layer.width) or 0)
	local data = layer.data
	if type(data) ~= "table" then
		error(label .. " layer data is missing")
	end

	if width <= 0 or (#data % width) ~= 0 then
		error(label .. " invalid layer dimensions")
	end

	local height = #data / width
	if height <= 0 then
		error(label .. " invalid layer dimensions")
	end

	local bytes = {}
	for i = 1, #data do
		local tileId = math.floor(tonumber(data[i]) or 0)
		if tileId < 0 then
			tileId = 0
		end
		local offset = (i - 1) * 4
		bytes[offset + 1] = tileId % 256
		bytes[offset + 2] = math.floor(tileId / 256) % 256
		bytes[offset + 3] = math.floor(tileId / 65536) % 256
		bytes[offset + 4] = 255
	end

	local image, writeErr = host.call("image/image::from-pixels", width, height, "rgba8", bytes)
	if image == nil then
		error(writeErr or (label .. " failed to create image from pixel data"))
	end

	return image
end

local function generateLut(tilemap, layerInput, label)
	if tilemap == nil or tilemap == "" then
		error(label .. " map is required")
	end
	if type(tilemap) ~= "table" then
		error(label .. " map must be a table")
	end

	local layers = tilemap.layers
	if type(layers) ~= "table" or #layers == 0 then
		error(label .. " tilemap has no layers")
	end

	if layerInput == nil or layerInput == "" then
		local images = {}
		for layerIndex = 1, #layers do
			images[layerIndex] = generateLayerLut(layers, layerIndex, label)
		end
		return images
	end

	local layerSelector = tonumber(layerInput)
	if layerSelector == nil then
		error(label .. " layer index must be numeric")
	end
	if layerSelector < 1 then
		error(label .. " layer index must be 1 or greater")
	end

	layerSelector = math.floor(layerSelector)
	return generateLayerLut(layers, layerSelector, label)
end

local tilemap = inputs[1]
local layerInput = inputs[2]
if type(tilemap) == "table" and isArray(tilemap) then
	local images = {}
	for index, item in ipairs(tilemap) do
		images[index] = generateLut(item, itemAt(layerInput, index), "map[" .. tostring(index) .. "]")
	end
	outputs[1] = images
else
	outputs[1] = generateLut(tilemap, layerInput, "map input")
end
