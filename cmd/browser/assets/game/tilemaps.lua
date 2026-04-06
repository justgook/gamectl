local entityId = tonumber(inputs[1]) or 1
local ok, images = pcall(json.decode, inputs[2])
if not ok or type(images) ~= "table" then
	outputs[1] = ""
	outputs[2] = "Invalid images array JSON"
	return
end

local maxX, maxY = 0, 0
for _, r in ipairs(images) do
	maxX = math.max(maxX, r.x + r.width)
	maxY = math.max(maxY, r.y + r.height)
end

local components = {}
local entity_ids = {}

for _, image in ipairs(images) do
	local u1 = image.x / maxX
	local v1 = image.y / maxY
	local u2 = (image.x + image.width) / maxX
	local v2 = (image.y + image.height) / maxY

	table.insert(components, {
		pos = { 0, -0 },
		tile_size = { 16, 16 },
		tileset_uv = { 0, 0, 1, 1 },
		lut_uv = { u1, v1, u2, v2 },
	})

	entityId = entityId + 1
	table.insert(entity_ids, entityId)
end

outputs[2] = json.encode({
	entity_ids = entity_ids,
	components = components,
})

outputs[1] = tostring(entityId)
