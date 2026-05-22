-- Tilemap to Collision Segments
-- Converts one tilemap layer into merged exterior collision edge segments.
-- Inputs: map, layerIndex, solidTileId
-- Outputs: segments
--
-- Coordinate contract:
-- - tile units
-- - origin at top-left
-- - x grows right, y grows down
-- - tile (x, y) occupies [x, y] to [x + 1, y + 1]
--
-- Segment contract:
-- - each segment is { x1, y1, x2, y2 }
-- - segments are oriented clockwise for outer contours in y-down coordinates
-- - equivalently, the solid tile area is on the right-hand side of each segment

local tilemap = inputs[1]
if tilemap == nil or tilemap == "" then
	error("map is required")
end

local layerSelector = tonumber(inputs[2]) or 1
if layerSelector < 1 then
	error("layer index must be 1 or greater")
end
layerSelector = math.floor(layerSelector)

local solidTileId = tonumber(inputs[3])
if solidTileId == nil then
	error("solid tile id is required")
end
solidTileId = math.floor(solidTileId)

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

local function is_solid_at(x, y)
	if x < 0 or x >= width or y < 0 or y >= height then
		return false
	end

	local index = y * width + x + 1
	local tileId = tonumber(data[index])
	if tileId == nil then
		error("Tile id at index " .. tostring(index) .. " is not numeric")
	end

	return math.floor(tileId) == solidTileId
end

local segments = {}

local function add_segment(x1, y1, x2, y2)
	segments[#segments + 1] = { x1, y1, x2, y2 }
end

-- Horizontal edges.
-- Top edges are left-to-right; bottom edges are right-to-left.
for y = 0, height - 1 do
	local topStart = nil
	local bottomStart = nil

	for x = 0, width do
		local hasTopEdge = x < width and is_solid_at(x, y) and not is_solid_at(x, y - 1)
		local hasBottomEdge = x < width and is_solid_at(x, y) and not is_solid_at(x, y + 1)

		if hasTopEdge and topStart == nil then
			topStart = x
		elseif (not hasTopEdge or x == width) and topStart ~= nil then
			add_segment(topStart, y, x, y)
			topStart = nil
		end

		if hasBottomEdge and bottomStart == nil then
			bottomStart = x
		elseif (not hasBottomEdge or x == width) and bottomStart ~= nil then
			add_segment(x, y + 1, bottomStart, y + 1)
			bottomStart = nil
		end
	end
end

-- Vertical edges.
-- Left edges are bottom-to-top; right edges are top-to-bottom.
for x = 0, width - 1 do
	local leftStart = nil
	local rightStart = nil

	for y = 0, height do
		local hasLeftEdge = y < height and is_solid_at(x, y) and not is_solid_at(x - 1, y)
		local hasRightEdge = y < height and is_solid_at(x, y) and not is_solid_at(x + 1, y)

		if hasLeftEdge and leftStart == nil then
			leftStart = y
		elseif (not hasLeftEdge or y == height) and leftStart ~= nil then
			add_segment(x, y, x, leftStart)
			leftStart = nil
		end

		if hasRightEdge and rightStart == nil then
			rightStart = y
		elseif (not hasRightEdge or y == height) and rightStart ~= nil then
			add_segment(x + 1, rightStart, x + 1, y)
			rightStart = nil
		end
	end
end

outputs[1] = segments
