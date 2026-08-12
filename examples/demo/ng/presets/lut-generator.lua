-- LUT Generator
-- Converts arrays of integers into one-pixel-high RGBA LUT images.
-- Nested arrays are preserved; each leaf array of integers becomes an image.

local function fail(message)
	error("lut-generator: " .. message)
end

local function arrayLength(value, label)
	if type(value) ~= "table" then
		fail(label .. " must be an array")
	end

	local length = 0
	for key, _ in pairs(value) do
		if type(key) ~= "number" or key < 1 or key ~= math.floor(key) then
			fail(label .. " must be a dense array")
		end
		length = math.max(length, key)
	end

	if length == 0 then
		fail(label .. " must not be empty")
	end

	for index = 1, length do
		if value[index] == nil then
			fail(label .. " must be a dense array")
		end
	end

	return length
end

local function generateLut(values, label)
	local bytes = {}
	for index, value in ipairs(values) do
		if type(value) ~= "number" or value ~= math.floor(value) then
			fail(label .. "[" .. tostring(index) .. "] must be an integer")
		end

		local tileId = math.max(0, value)
		local offset = (index - 1) * 4
		bytes[offset + 1] = tileId % 256
		bytes[offset + 2] = math.floor(tileId / 256) % 256
		bytes[offset + 3] = math.floor(tileId / 65536) % 256
		bytes[offset + 4] = 255
	end

	local image, writeErr = host.call("image/image::from-pixels", #values, 1, "rgba8", bytes)
	if image == nil then
		fail(writeErr or (label .. " failed to create image from pixel data"))
	end
	return image
end

local function convert(value, label)
	local length = arrayLength(value, label)
	local itemType = type(value[1])

	if itemType == "number" then
		for index = 2, length do
			if type(value[index]) ~= "number" then
				fail(label .. " must contain only integers or only nested arrays")
			end
		end
		return generateLut(value, label)
	end

	if itemType == "table" then
		local result = {}
		for index = 1, length do
			if type(value[index]) ~= "table" then
				fail(label .. " must contain only integers or only nested arrays")
			end
			result[index] = convert(value[index], label .. "[" .. tostring(index) .. "]")
		end
		return result
	end

	fail(label .. "[1] must be an integer or a nested array")
end

outputs[1] = convert(inputs[1], "input")
