-- Copy Prop
-- Copies values from arbitrary paths in one decoded value to arbitrary paths in another decoded value.
-- Inputs: from, to, src, target
--   src examples: props.tileSize, ["props.tilesets", "props.tileSize"], ["0.test", "0.arr.3.test"]
--   target examples: props.tileSize, ["props.tilesets", "props.tileSize"], ["prop1", "prop2"]
-- Numeric path segments are zero-based array indexes.
-- Outputs: to (success), error (failure)

local function fail(message)
	outputs[1] = ""
	outputs[2] = message
	error(message)
end

local fromData = inputs[1]
if fromData == nil or fromData == "" then
	fail("from is required")
end
if type(fromData) ~= "table" then
	fail("from must be an object/array")
end

local toData = inputs[2]
if toData == nil or toData == "" then
	fail("to is required")
end
if type(toData) ~= "table" then
	fail("to must be an object/array")
end

local srcValue = inputs[3]
if srcValue == nil or srcValue == "" then
	fail("src is required")
end

local targetValue = inputs[4]
if targetValue == nil or targetValue == "" then
	fail("target is required")
end

local function normalizePathList(value, name)
	local paths = {}
	if type(value) == "string" then
		paths[1] = value
	elseif type(value) == "table" then
		for index, path in ipairs(value) do
			if type(path) ~= "string" or path == "" then
				fail(name .. "[" .. tostring(index) .. "] must be a non-empty string")
			end
			paths[#paths + 1] = path
		end
	else
		fail(name .. " must be a string or array of path strings")
	end

	if #paths == 0 then
		fail(name .. " must contain at least one path")
	end
	return paths
end

local srcPaths = normalizePathList(srcValue, "src")
local targetPaths = normalizePathList(targetValue, "target")

if #srcPaths ~= #targetPaths then
	fail("src and target must contain the same number of paths")
end

local function parsePath(path, label)
	local parts = {}
	for part in string.gmatch(path, "[^%.]+") do
		parts[#parts + 1] = part
	end
	if #parts == 0 then
		fail(label .. " path must not be empty")
	end
	return parts
end

local function pathKey(part)
	if string.match(part, "^%d+$") then
		return tonumber(part) + 1
	end
	return part
end

local function getPath(root, path)
	local parts = parsePath(path, "src")
	local current = root
	for _, part in ipairs(parts) do
		if type(current) ~= "table" then
			fail("src path parent is not an object/array: " .. path)
		end
		current = current[pathKey(part)]
		if current == nil then
			fail("src path not found: " .. path)
		end
	end
	return current
end

local function setPath(root, path, value)
	local parts = parsePath(path, "target")
	local current = root
	for index = 1, #parts - 1 do
		if type(current) ~= "table" then
			fail("target path parent is not an object/array: " .. path)
		end
		local key = pathKey(parts[index])
		if current[key] == nil then
			current[key] = {}
		elseif type(current[key]) ~= "table" then
			fail("target path parent already exists and is not an object/array: " .. path)
		end
		current = current[key]
	end

	if type(current) ~= "table" then
		fail("target path parent is not an object/array: " .. path)
	end
	current[pathKey(parts[#parts])] = value
end

for index, srcPath in ipairs(srcPaths) do
	setPath(toData, targetPaths[index], getPath(fromData, srcPath))
end

outputs[1] = toData
outputs[2] = ""
