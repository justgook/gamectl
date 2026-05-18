local map = inputs[1]
if map == nil or map == "" then
	outputs[1] = ""
	outputs[2] = "map is required"
	return
end

local layerSelector = tonumber(inputs[2]) or 1
if layerSelector < 1 then
	outputs[1] = ""
	outputs[2] = "layer index must be 1 or greater"
	return
end
layerSelector = math.floor(layerSelector)

local function fail(message)
	outputs[1] = ""
	outputs[2] = message
end

local function decodeJson(text, label)
	local ok, value = pcall(json.decode, text)
	if not ok then
		return nil, "Failed to parse " .. label
	end
	return value, nil
end

local function decodeResult(text, label)
	local response, decodeErr = decodeJson(text, label .. " response")
	if response == nil then return nil, decodeErr end
	if response.err ~= nil then return nil, tostring(response.err) end
	return response.ok, nil
end

local function callImage(method, ...)
	return decodeResult(host.call("image/image::" .. string.gsub(method, "_", "-"), ...), "image." .. method)
end

local tilemapText = host.call("fs/fs::read-text", map)
local tilemapJson, tilemapErr = decodeJson(tilemapText or "", "tilemap JSON")
if tilemapJson == nil then
	fail(tilemapErr)
	return
end

local layers = tilemapJson.layers
if type(layers) ~= "table" or #layers == 0 then
	fail("Tilemap has no layers")
	return
end

local layer = layers[layerSelector]
if type(layer) ~= "table" then
	fail("Layer not found at index " .. tostring(layerSelector))
	return
end

local width = math.floor(tonumber(layer.width) or 0)
local data = layer.data
if type(data) ~= "table" then
	fail("Layer data is missing")
	return
end

if width <= 0 or (#data % width) ~= 0 then
	fail("Invalid layer dimensions")
	return
end

local height = #data / width
if height <= 0 then
	fail("Invalid layer dimensions")
	return
end

local bytes = {}
for i = 1, #data do
	local tileId = math.floor(tonumber(data[i]) or 0)
	if tileId < 0 then tileId = 0 end
	local offset = (i - 1) * 4
	bytes[offset + 1] = tileId & 0xFF
	bytes[offset + 2] = (tileId >> 8) & 0xFF
	bytes[offset + 3] = (tileId >> 16) & 0xFF
	bytes[offset + 4] = 255
end

local image, writeErr = callImage("write_pixels", width, height, "rgba8", bytes)
if image == nil then
	fail(writeErr or "Failed to write pixel data")
	return
end

local metadata = {
	image = image,
	resource = image,
	width = width,
	height = height,
	tileCount = #data,
	tilemapName = map,
	layerIndex = layerSelector,
	layerName = ((type(layer.props) == "table" and layer.props.name) or ("layer " .. tostring(layerSelector))),
}

outputs[1] = json.encode(metadata)
outputs[2] = ""
