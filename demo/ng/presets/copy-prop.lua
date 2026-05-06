-- Copy Prop
-- Copies top-level tilemap props from one map JSON file to another.
-- Inputs: from, to, prop
--   prop examples: "tileSize", ["tilesets", "tileSize"]
-- Outputs: to (success), error (failure)

local function fail(message)
	outputs[1] = ""
	outputs[2] = message
	error(message)
end

local fromPath = inputs[1]
if fromPath == nil or fromPath == "" then
	fail("from is required")
end

local toPath = inputs[2]
if toPath == nil or toPath == "" then
	fail("to is required")
end

local propText = inputs[3]
if propText == nil or propText == "" then
	fail("prop is required")
end

local okProp, prop = pcall(json.decode, propText)
if not okProp then
	fail('prop must be JSON, e.g. ["tilesets", "tileSize"]')
end

local propNames = {}
if type(prop) == "string" then
	propNames[1] = prop
elseif type(prop) == "table" then
	if prop[1] == "tilemap" and type(prop[2]) == "string" and prop[3] == nil then
		propNames[1] = prop[2]
	else
		for index, propName in ipairs(prop) do
			if type(propName) ~= "string" or propName == "" then
				fail("prop[" .. tostring(index) .. "] must be a non-empty string")
			end
			propNames[#propNames + 1] = propName
		end
	end
else
	fail("prop must be a string or JSON array of prop names")
end

if #propNames == 0 then
	fail("prop must contain at least one prop name")
end

local function readJson(path, label)
	local text = host.awaitCall("fs", "read", path)
	local ok, data = pcall(json.decode, text)
	if not ok or type(data) ~= "table" then
		fail("Failed to parse " .. label .. " JSON: " .. tostring(path))
	end
	return data
end

local fromMap = readJson(fromPath, "from")
local toMap = readJson(toPath, "to")

if type(fromMap.props) ~= "table" then
	fail("from map has no props")
end

if toMap.props == nil then
	toMap.props = {}
elseif type(toMap.props) ~= "table" then
	fail("to map props must be an object")
end

for _, propName in ipairs(propNames) do
	local value = fromMap.props[propName]
	if value == nil then
		fail("from map props has no key: " .. propName)
	end
	toMap.props[propName] = value
end

local encoded = json.encode(toMap)
host.awaitCall("fs", "write", toPath .. "\0" .. encoded)

outputs[1] = toPath
outputs[2] = ""
