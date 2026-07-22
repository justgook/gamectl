-- Objects to Component Storage
-- Projects World Object properties into ECS component storage while preserving each
-- object's zero-based source index as its entity id.
--
-- Inputs:
--   objects: dense array of objects
--   fields:
--     - non-empty array of direct field names: every object becomes an array component
--       whose values follow the requested field order
--     - non-empty direct field name: objects containing that field become components
--       whose values are the field values themselves
--
-- Output:
--   storage: { entity_ids = { ... }, components = { ... } }

local function dense_array_length(value, label)
	if type(value) ~= "table" then
		error(label .. " must be an array")
	end

	local length = 0
	for key, _ in pairs(value) do
		if type(key) ~= "number" or key ~= math.floor(key) or key < 1 then
			error(label .. " must contain only positive integer keys")
		end
		if key > length then
			length = key
		end
	end

	for index = 1, length do
		if value[index] == nil then
			error(label .. " item '" .. tostring(index) .. "' is nil")
		end
	end

	return length
end

if not inputs.active[1] then
	error("objects is not connected")
end
local objects = inputs[1]
local object_count = dense_array_length(objects, "objects")

if not inputs.active[2] then
	error("fields is not connected")
end
local fields = inputs[2]
local property = nil
if type(fields) == "string" then
	if fields == "" then
		error("fields must be a non-empty field name or array of field names")
	end
	property = fields
elseif type(fields) == "table" then
	local field_count = dense_array_length(fields, "fields")
	if field_count == 0 then
		error("fields must contain at least one field name")
	end

	local seen_fields = {}
	for field_index, field in ipairs(fields) do
		if type(field) ~= "string" or field == "" then
			error("fields item '" .. tostring(field_index) .. "' must be a non-empty string")
		end
		if seen_fields[field] then
			error("fields contains duplicate field '" .. field .. "'")
		end
		seen_fields[field] = true
	end
else
	error("fields must be a non-empty field name or array of field names")
end

local storage = {
	entity_ids = {},
	components = {},
}

for object_index = 1, object_count do
	local object = objects[object_index]
	if type(object) ~= "table" then
		error("objects item '" .. tostring(object_index) .. "' must be an object")
	end

	if property ~= nil then
		local component = object[property]
		if component ~= nil then
			storage.entity_ids[#storage.entity_ids + 1] = object_index - 1
			storage.components[#storage.components + 1] = component
		end
	else
		local component = {}
		for field_index, field in ipairs(fields) do
			local field_value = object[field]
			if field_value == nil then
				error("objects item '" .. tostring(object_index) .. "' field '" .. field .. "' is nil")
			end
			component[field_index] = field_value
		end

		storage.entity_ids[#storage.entity_ids + 1] = object_index - 1
		storage.components[#storage.components + 1] = component
	end
end

outputs[1] = storage
