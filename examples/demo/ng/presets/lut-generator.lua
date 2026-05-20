local tilemap = inputs[1]
if tilemap == nil or tilemap == "" then
	error("map is required")
end

local layerSelector = tonumber(inputs[2]) or 1
if layerSelector < 1 then
	error("layer index must be 1 or greater")
end

layerSelector = math.floor(layerSelector)

local layers = tilemap.layers
if type(layers) ~= "table" or #layers == 0 then
	error("Tilemap has no layers")
end

local layer = layers[layerSelector]
if type(layer) ~= "table" then
	error("Layer not found at index " .. tostring(layerSelector))
end

local width = math.floor(tonumber(layer.width) or 0)
local data = layer.data
if type(data) ~= "table" then
	error("Layer data is missing")
end

if width <= 0 or (#data % width) ~= 0 then
	error("Invalid layer dimensions")
end

local height = #data / width
if height <= 0 then
	error("Invalid layer dimensions")
end

local bytes = {}
for i = 1, #data do
	local tileId = math.floor(tonumber(data[i]) or 0)
	if tileId < 0 then
		tileId = 0
	end
	local offset = (i - 1) * 4
	bytes[offset + 1] = tileId & 0xFF
	bytes[offset + 2] = (tileId >> 8) & 0xFF
	bytes[offset + 3] = (tileId >> 16) & 0xFF
	bytes[offset + 4] = 255
end

local image, writeErr = host.call("image/image::write-pixels", width, height, "rgba8", bytes)
if image == nil then
	error(writeErr or "Failed to write pixel data")
end

-- host.call("image/image::save", image, "tmp/lut1.qoi", "qoi")

outputs[1] = image
