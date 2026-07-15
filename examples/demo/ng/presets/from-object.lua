-- fromObject
-- Extracts properties from an object or an array of objects.
--
-- Input:
--   object: object table, or array of object tables
--
-- Each active output reads the property path with the same name as the output port.
-- Dot-separated names traverse nested objects (for example, "words.spawn_x").
-- If the input is an array, each output receives an array of that path from every object.

local value = inputs[1]
if not inputs.active[1] then
	error("object is not connected")
end
if value == nil then
	error("object is nil")
end
if type(value) ~= "table" then
	error("object must be a table")
end

local function array_length(t)
	local count = 0
	for key, _ in pairs(t) do
		if type(key) ~= "number" or key ~= math.floor(key) or key < 1 then
			return nil
		end
		if key > count then
			count = key
		end
	end
	for index = 1, count do
		if t[index] == nil then
			return nil
		end
	end
	return count
end

local function validate_property_path(propertyPath)
	if propertyPath:sub(1, 1) == "."
		or propertyPath:sub(-1) == "."
		or propertyPath:find("..", 1, true) ~= nil
	then
		error("output property path '" .. propertyPath .. "' is invalid")
	end
end

local function extract_object_path(object, propertyPath)
	local current = object
	for propertyName in propertyPath:gmatch("[^.]+") do
		if type(current) ~= "table" then
			error("property path '" .. propertyPath .. "' cannot traverse '" .. propertyName .. "'")
		end
		current = current[propertyName]
		if current == nil then
			return nil
		end
	end
	return current
end

local outputIds = {}
for key, isActive in pairs(outputs.active) do
	if type(key) == "number" and isActive then
		outputIds[#outputIds + 1] = key
	end
end
table.sort(outputIds)

local count = array_length(value)
for _, outputId in ipairs(outputIds) do
	local propertyName = outputs.names[outputId]
	if type(propertyName) ~= "string" or propertyName == "" then
		error("output '" .. tostring(outputId) .. "' must have a non-empty name")
	end
	validate_property_path(propertyName)

	if count ~= nil then
		local result = {}
		for index = 1, count do
			local itemValue = extract_object_path(value[index], propertyName)
			if itemValue == nil then
				error("array item '" .. tostring(index) .. "' property path '" .. propertyName .. "' is nil")
			end
			result[index] = itemValue
		end
		outputs[outputId] = result
	else
		local itemValue = extract_object_path(value, propertyName)
		if itemValue == nil then
			outputs.active[outputId] = false
			outputs.active[propertyName] = false
		else
			outputs[outputId] = itemValue
		end
	end
end
