local entityId = tonumber(inputs[1]) or 1
entityId = entityId + 1
outputs[2] = json.encode({ entity_ids = { 2, 3 }, components = { { -16400, -16400 }, { -16400, -16400 } } })
outputs[1] = tostring(entityId)
