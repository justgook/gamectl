local function isArray(value)
	if type(value) ~= "table" then
		return false, 0
	end

	local length = 0
	for key, _ in pairs(value) do
		if type(key) ~= "number" or key < 1 or key ~= math.floor(key) then
			return false, 0
		end
		if key > length then
			length = key
		end
	end

	for index = 1, length do
		if value[index] == nil then
			return false, 0
		end
	end

	return true, length
end

local function ensureParentDirs(path)
	local dir = string.match(path, "^(.*)/[^/]*$")
	if dir == nil or dir == "" then
		return
	end
	local current = ""
	for part in string.gmatch(dir, "[^/]+") do
		if current == "" then
			current = part
		else
			current = current .. "/" .. part
		end
		pcall(host.call, "fs/fs::create-dir", current)
	end
end

local function writeFile(path, content)
	if path == nil or path == "" then
		return nil, "path is required"
	end
	if type(path) ~= "string" then
		return nil, "path must be string"
	end

	if type(content) ~= "string" then
		content = json.encode(content)
	end

	ensureParentDirs(path)
	host.call("fs/fs::write-text", path, content)
	return path, ""
end

local path = inputs[1]
local content = inputs[2]

if type(path) == "table" then
	local okPaths, pathCount = isArray(path)
	local okContents, contentCount = isArray(content)
	if not okPaths then
		outputs[1] = nil
		outputs[2] = "path must be string or array"
	elseif not okContents then
		outputs[1] = nil
		outputs[2] = "text must be array when path is array"
	elseif pathCount ~= contentCount then
		outputs[1] = nil
		outputs[2] = "path and text arrays must have the same length"
	else
		local written = {}
		local err = ""
		for index, itemPath in ipairs(path) do
			local itemWritten, itemErr = writeFile(itemPath, content[index])
			if itemErr ~= "" then
				err = "item " .. tostring(index) .. ": " .. itemErr
				written = nil
				break
			end
			written[index] = itemWritten
		end
		outputs[1] = written
		outputs[2] = err
	end
else
	local written, err = writeFile(path, content)
	outputs[1] = written
	outputs[2] = err
end
