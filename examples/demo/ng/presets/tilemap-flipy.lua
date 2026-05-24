local tilemap = inputs[1]
if tilemap == nil or tilemap == "" then
	error("tilemap input is required")
end
if type(tilemap) ~= "table" then
	error("tilemap input must be a table")
end

local layers = tilemap.layers
if type(layers) ~= "table" then
	error("tilemap.layers must be a table")
end

local function deep_copy(value)
	if type(value) ~= "table" then
		return value
	end

	local copied = {}
	for key, item in pairs(value) do
		copied[deep_copy(key)] = deep_copy(item)
	end
	return copied
end

local function flip_layer_y(layer, layerIndex)
	if type(layer) ~= "table" then
		error("tilemap layer " .. tostring(layerIndex) .. " must be a table")
	end

	local width = math.floor(tonumber(layer.width) or 0)
	if width <= 0 then
		error("tilemap layer " .. tostring(layerIndex) .. " width must be greater than zero")
	end

	local data = layer.data
	if type(data) ~= "table" then
		error("tilemap layer " .. tostring(layerIndex) .. " data must be a table")
	end
	if (#data % width) ~= 0 then
		error("tilemap layer " .. tostring(layerIndex) .. " data length must be divisible by width")
	end

	local height = #data / width
	local flipped = {}
	for y = 0, height - 1 do
		local sourceY = height - 1 - y
		for x = 0, width - 1 do
			flipped[y * width + x + 1] = data[sourceY * width + x + 1]
		end
	end

	local result = deep_copy(layer)
	result.data = flipped
	return result
end

local result = deep_copy(tilemap)
local resultLayers = deep_copy(layers)
for index, layer in ipairs(layers) do
	resultLayers[index] = flip_layer_y(layer, index)
end
result.layers = resultLayers

outputs[1] = result
