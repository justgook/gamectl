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

local function joinPath(dir, name)
	if dir == "" then
		return name
	end
	return dir .. "/" .. name
end

local function splitPattern(pattern)
	if pattern == nil or pattern == "" then
		error("pattern is required")
	end
	if type(pattern) ~= "string" then
		error("pattern must be string")
	end
	if string.sub(pattern, 1, 1) == "/" then
		error("pattern must be relative")
	end

	pattern = string.gsub(pattern, "^%./", "")
	if pattern == "" then
		error("pattern is required")
	end
	if string.sub(pattern, -1) == "/" then
		error("pattern must not end with /")
	end

	local segments = {}
	for segment in string.gmatch(pattern, "([^/]+)") do
		segments[#segments + 1] = segment
	end
	if table.concat(segments, "/") ~= pattern then
		error("pattern must not contain empty path segments")
	end
	return segments
end

local magic = {
	["^"] = true,
	["$"] = true,
	["("] = true,
	[")"] = true,
	["%"] = true,
	["."] = true,
	["["] = true,
	["]"] = true,
	["+"] = true,
	["-"] = true,
}

local function segmentToLuaPattern(segment)
	local parts = { "^" }
	for index = 1, #segment do
		local char = string.sub(segment, index, index)
		if char == "*" then
			parts[#parts + 1] = ".*"
		elseif char == "?" then
			parts[#parts + 1] = "."
		elseif magic[char] then
			parts[#parts + 1] = "%" .. char
		else
			parts[#parts + 1] = char
		end
	end
	parts[#parts + 1] = "$"
	return table.concat(parts)
end

local function segmentMatches(patternSegment, name)
	return string.match(name, segmentToLuaPattern(patternSegment)) ~= nil
end

local function listDir(path)
	return host.call("fs/fs::list", path)
end

local function addPath(paths, seen, path)
	if seen[path] then
		return
	end
	seen[path] = true
	paths[#paths + 1] = path
end

local function walk(dir, segments, segmentIndex, paths, seen)
	local segment = segments[segmentIndex]
	if segment == nil then
		addPath(paths, seen, dir)
		return
	end

	if segment == "**" then
		walk(dir, segments, segmentIndex + 1, paths, seen)

		local entries = listDir(dir)
		for _, entry in ipairs(entries) do
			if entry.type == "directory" then
				walk(joinPath(dir, entry.name), segments, segmentIndex, paths, seen)
			end
		end
		return
	end

	local entries = listDir(dir)
	local isLastSegment = segmentIndex == #segments
	for _, entry in ipairs(entries) do
		if segmentMatches(segment, entry.name) then
			local path = joinPath(dir, entry.name)
			if isLastSegment then
				addPath(paths, seen, path)
			elseif entry.type == "directory" then
				walk(path, segments, segmentIndex + 1, paths, seen)
			end
		end
	end
end

local function globOne(pattern, paths, seen)
	local segments = splitPattern(pattern)
	walk("", segments, 1, paths, seen)
end

local pattern = inputs[1]
local paths = {}
local seen = {}

if type(pattern) == "table" then
	local okArray = isArray(pattern)
	if not okArray then
		error("pattern must be string or array")
	end

	for index, itemPattern in ipairs(pattern) do
		local ok, err = pcall(globOne, itemPattern, paths, seen)
		if not ok then
			local message = string.gsub(tostring(err), "^.-:%d+:%s*", "", 1)
			error("item " .. tostring(index) .. ": " .. message)
		end
	end
else
	globOne(pattern, paths, seen)
end

table.sort(paths)
outputs[1] = paths
