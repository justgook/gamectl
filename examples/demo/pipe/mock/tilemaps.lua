local entityId = inputs[1]
local images = inputs[2]

local maxX, maxY = 0, 0
for _, r in ipairs(images) do
	maxX = math.max(maxX, r.x + r.width)
	maxY = math.max(maxY, r.y + r.height)
end

local tilemap_comps = {}
local position_comps = {}
local entity_ids = {}

for _, image in ipairs(images) do
	local u1 = image.x / maxX
	local v1 = image.y / maxY
	local u2 = (image.x + image.width) / maxX
	local v2 = (image.y + image.height) / maxY

	table.insert(tilemap_comps, {
		pos = { 0, -0 },
		tile_size = { 16, 16 },
		tileset_uv = { 0, 0, 1, 1 },
		lut_uv = { u1, v1, u2, v2 },
	})

	table.insert(position_comps, { 0,  -32*64 })
	entityId = entityId + 1
	table.insert(entity_ids, entityId)
end

outputs[1] = entityId
outputs[2] = {
	entity_ids = entity_ids,
	components = tilemap_comps,
}

outputs[3] = {
	entity_ids = entity_ids,
	components = position_comps,
}
