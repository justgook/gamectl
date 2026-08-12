-- Find
-- Returns the first object in a dense array that recursively matches a partial object filter.
-- The output is inactive when no item matches. Inputs and output are already-decoded Lua values.

local function array_length(value, label)
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

local function require_object(value, label)
	if type(value) ~= "table" then
		error(label .. " must be an object")
	end
	for key, _ in pairs(value) do
		if type(key) ~= "string" then
			error(label .. " must contain only string keys")
		end
	end
end

local function matches(value, expected)
	if type(expected) ~= "table" then
		return value == expected
	end
	if type(value) ~= "table" then
		return false
	end

	for key, nested_expected in pairs(expected) do
		if not matches(value[key], nested_expected) then
			return false
		end
	end
	return true
end

if not inputs.active[1] then
	error("items is not connected")
end
if not inputs.active[2] then
	error("filter is not connected")
end

local items = inputs[1]
local filter = inputs[2]
local count = array_length(items, "items")
require_object(filter, "filter")

for index = 1, count do
	local item = items[index]
	require_object(item, "items[" .. tostring(index) .. "]")
	if matches(item, filter) then
		outputs[1] = item
		return
	end
end

outputs.active[1] = false
