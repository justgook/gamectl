local entityId = tonumber(inputs[1]) or 1
entityId = entityId + 1
outputs[1] = json.encode({ entity_ids = { entityId }, components = { { -6400, -6400 } } })
outputs[2] = tostring(entityId)
