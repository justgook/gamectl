local entityId = tonumber(inputs[1]) or 1
entityId = entityId + 1
outputs[1] = json.encode({
	entity_ids = { 2 },
	components = {
		{ pos = { 0, -0 }, tile_size = { 16, 16 }, tileset_uv = { 0, 0, 1, 1 }, lut_uv = { 0, 0, 1, 1 } },
	},
})
outputs[2] = tostring(entityId)
