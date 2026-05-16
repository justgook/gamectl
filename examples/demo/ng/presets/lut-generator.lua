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

local function callImage(method, payload)
	local resultText = host.call("image/image::" .. string.gsub(method, "_", "-"), payload)
	local response, decodeErr = decodeJson(resultText, "image." .. method .. " response")
	if response == nil then
		return nil, decodeErr
	end
	if not response.ok then
		return nil, response.message or response.code or ("image." .. method .. " failed")
	end
	return response, nil
end

local function closeHandle(handle)
	if handle == nil or handle == 0 then return end
	callImage("close", { src = handle })
end

local function base64Encode(bytes)
	local binaryChunks = {}
	local chunkSize = 8192
	for i = 1, #bytes, chunkSize do
		local chunk = {}
		local endIdx = math.min(i + chunkSize - 1, #bytes)
		for j = i, endIdx do
			chunk[#chunk + 1] = bytes[j]
		end
		binaryChunks[#binaryChunks + 1] = string.char(table.unpack(chunk))
	end

	local pixelString = table.concat(binaryChunks)
	local base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	local encoded = {}

	for i = 1, #pixelString, 3 do
		local a, b, c = string.byte(pixelString, i, i + 2)
		local n = (a or 0) * 0x10000 + (b or 0) * 0x100 + (c or 0)
		encoded[#encoded + 1] = string.sub(base64chars, ((n >> 18) & 0x3F) + 1, ((n >> 18) & 0x3F) + 1)
		encoded[#encoded + 1] = string.sub(base64chars, ((n >> 12) & 0x3F) + 1, ((n >> 12) & 0x3F) + 1)
		encoded[#encoded + 1] = string.sub(base64chars, ((n >> 6) & 0x3F) + 1, ((n >> 6) & 0x3F) + 1)
		encoded[#encoded + 1] = string.sub(base64chars, (n & 0x3F) + 1, (n & 0x3F) + 1)
	end

	local base64 = table.concat(encoded)
	local padding = #pixelString % 3
	if padding == 1 then
		base64 = string.sub(base64, 1, -3) .. "=="
	elseif padding == 2 then
		base64 = string.sub(base64, 1, -2) .. "="
	end

	return base64
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
	if tileId < 0 then
		tileId = 0
	end
	local offset = (i - 1) * 4
	bytes[offset + 1] = tileId & 0xFF
	bytes[offset + 2] = (tileId >> 8) & 0xFF
	bytes[offset + 3] = (tileId >> 16) & 0xFF
	bytes[offset + 4] = 255
end

local created, createErr = callImage("create", {
	width = width,
	height = height,
	fill = { 0, 0, 0, 0 },
})
if created == nil or created.handle == nil then
	fail(createErr or "Failed to create image handle")
	return
end

local written, writeErr = callImage("write_pixels", {
	src = created.handle,
	width = width,
	height = height,
	pixelFormat = "rgba8",
	encoding = "base64",
	data = base64Encode(bytes),
})
if written == nil then
	closeHandle(created.handle)
	fail(writeErr or "Failed to write pixel data")
	return
end

local handle = written.handle or created.handle
if handle ~= created.handle then
	closeHandle(created.handle)
end

local metadata = {
	handle = handle,
	width = width,
	height = height,
	tileCount = #data,
	tilemapName = map,
	layerIndex = layerSelector,
	layerName = ((type(layer.props) == "table" and layer.props.name) or ("layer " .. tostring(layerSelector))),
}

outputs[1] = json.encode(metadata)
outputs[2] = ""
