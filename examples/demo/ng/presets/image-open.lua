local function isArray(value)
	if type(value) ~= "table" then
		return false
	end

	local length = 0
	for key, _ in pairs(value) do
		if type(key) ~= "number" or key < 1 or key ~= math.floor(key) then
			return false
		end
		if key > length then
			length = key
		end
	end

	for index = 1, length do
		if value[index] == nil then
			return false
		end
	end

	return true
end

local function openImage(path, label)
	if path == nil or path == "" then
		error(label .. " is required")
	end
	if type(path) ~= "string" then
		error(label .. " must be a string")
	end

	return host.call("image/image::open", path)
end

local path = inputs[1]
if type(path) == "table" then
	if not isArray(path) then
		error("path input must be a string or array of strings")
	end

	local images = {}
	for index, itemPath in ipairs(path) do
		images[index] = openImage(itemPath, "path[" .. tostring(index) .. "]")
	end
	outputs[1] = images
else
	outputs[1] = openImage(path, "path input")
end
