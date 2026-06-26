-- Wrap Object
-- Wraps one decoded Lua value in an object.
--
-- Inputs:
--   value: any non-nil decoded Lua value, commonly an array
--   key: optional non-empty string field name
--
-- If key is omitted, the field name is inferred from the single active named input other than
-- "key". This lets a renamed input port such as "defs" produce { defs = value }.
--
-- Output:
--   object: { [key] = value }
--
-- This preset works on already-decoded Lua values. It does not JSON-decode inputs and does not
-- JSON-encode outputs. Use json_decode/json_encode nodes at graph boundaries when needed.

local function infer_key()
	local candidates = {}
	for key, active in pairs(inputs.active) do
		if type(key) == "string" and key ~= "key" and active then
			candidates[#candidates + 1] = key
		end
	end
	table.sort(candidates)

	if #candidates ~= 1 then
		error("key is required unless exactly one non-key named input is active")
	end
	return candidates[1]
end

local key = inputs[2]
if key == nil or key == "" then
	key = infer_key()
end
if type(key) ~= "string" or key == "" then
	error("key must be a non-empty string")
end

local value = inputs[key]
if value == nil then
	value = inputs[1]
end
if value == nil then
	error("value is required")
end

outputs[1] = {
	[key] = value,
}
