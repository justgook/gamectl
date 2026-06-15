-- Tilemap Remap Tiles
-- Remaps tile ids in one tilemap layer.
--
-- Inputs: tilemap, layer, from, to
--   layer: 1-based layer index or layer props.name
--   from: tile id, comma-separated tile ids, JSON array of tile ids, or "*"
--         "*" means every nonzero tile.
--   to: destination tile id
-- Outputs: tilemap

local function fail(message)
	error("tilemap-remap-tiles: " .. message)
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

local function require_integer(value, label)
	local number = tonumber(value)
	if type(number) ~= "number" or number ~= math.floor(number) then
		fail(label .. " must be an integer")
	end
	return number
end

local function select_layer(tilemap, selector)
	local layers = tilemap.layers
	if type(layers) ~= "table" or #layers == 0 then
		fail("tilemap.layers must be a non-empty table")
	end

	if selector == nil or selector == "" then
		selector = 1
	end

	local numeric = tonumber(selector)
	if numeric ~= nil then
		local index = require_integer(numeric, "layer")
		if index < 1 or index > #layers then
			fail("layer index out of range: " .. tostring(index))
		end
		return index, layers[index]
	end

	local name = tostring(selector)
	for index, layer in ipairs(layers) do
		if type(layer) == "table" and type(layer.props) == "table" and tostring(layer.props.name or "") == name then
			return index, layer
		end
	end
	fail("layer name not found: " .. name)
end

local function parse_from(value)
	if value == nil or value == "" then
		fail("from input is required")
	end

	if tostring(value) == "*" then
		return "nonzero", nil
	end

	local values = {}
	local seen = {}

	local function add(item, label)
		local tile = require_integer(item, label)
		if tile < 0 then
			fail(label .. " must be greater than or equal to zero")
		end
		if seen[tile] == nil then
			seen[tile] = true
			values[#values + 1] = tile
		end
	end

	if type(value) == "table" then
		for index, item in ipairs(value) do
			add(item, "from[" .. tostring(index) .. "]")
		end
	elseif type(value) == "string" then
		local text = value:match("^%s*(.-)%s*$")
		local first = text:match("^%s*(.)")
		if first == "[" then
			local ok, decoded = pcall(json.decode, text)
			if not ok or type(decoded) ~= "table" then
				fail("from JSON array is invalid")
			end
			for index, item in ipairs(decoded) do
				add(item, "from[" .. tostring(index) .. "]")
			end
		elseif text:find(",", 1, true) ~= nil then
			local partIndex = 0
			for part in text:gmatch("[^,]+") do
				partIndex = partIndex + 1
				add(part:match("^%s*(.-)%s*$"), "from part " .. tostring(partIndex))
			end
		else
			add(text, "from")
		end
	else
		add(value, "from")
	end

	if #values == 0 then
		fail("from must contain at least one tile id")
	end

	return "set", seen
end

local tilemap = inputs[1]
if type(tilemap) ~= "table" then
	fail("tilemap input must be a table")
end

local layerIndex, layer = select_layer(tilemap, inputs[2])
if type(layer) ~= "table" then
	fail("selected layer must be a table")
end

local width = require_integer(layer.width, "layer.width")
if width <= 0 then
	fail("layer.width must be greater than zero")
end
if type(layer.data) ~= "table" then
	fail("selected layer.data must be a table")
end
if (#layer.data % width) ~= 0 then
	fail("selected layer.data length must be divisible by layer.width")
end

local fromMode, fromSet = parse_from(inputs[3])
local toTile = require_integer(inputs[4], "to")
if toTile < 0 then
	fail("to must be greater than or equal to zero")
end

local outputData = {}
local changed = 0
for index, tile in ipairs(layer.data) do
	local tileId = require_integer(tile, "layer.data[" .. tostring(index) .. "]")
	local shouldRemap = false
	if fromMode == "nonzero" then
		shouldRemap = tileId ~= 0
	else
		shouldRemap = fromSet[tileId] == true
	end

	if shouldRemap then
		outputData[index] = toTile
		if tileId ~= toTile then
			changed = changed + 1
		end
	else
		outputData[index] = tile
	end
end

local result = deep_copy(tilemap)
result.layers[layerIndex] = deep_copy(result.layers[layerIndex])
result.layers[layerIndex].data = outputData

outputs[1] = result
outputs[2] = {
	layer = layerIndex,
	from = inputs[3],
	to = toTile,
	changed = changed,
}
