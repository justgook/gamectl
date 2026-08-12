host = {
	call = function(_plugin, width, height, _format, bytes)
		return { width = width, height = height, first = bytes[1] }
	end,
}

local function run(values, widths)
	inputs = { values, widths }
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/lut-generator.lua"))()
	return outputs[1]
end

local lut = run({ 1, 2, 3, 4, 5, 6 }, 3)
assert(lut.width == 3)
assert(lut.height == 2)
assert(lut.first == 1)

local nested = run({
	{ 1, 2 },
	{
		{ 3, 4, 5, 6 },
		{ 7 },
	},
}, {
	2,
	{
		2,
		1,
	},
})
assert(nested[1].width == 2)
assert(nested[1].height == 1)
assert(nested[1].first == 1)
assert(nested[2][1].width == 2)
assert(nested[2][1].height == 2)
assert(nested[2][1].first == 3)
assert(nested[2][2].first == 7)

local function assertFails(values, widths, expected)
	local ok, message = pcall(run, values, widths)
	assert(not ok)
	assert(tostring(message):find(expected, 1, true), tostring(message))
end

assertFails({}, 1, "must not be empty")
assertFails({ 1, { 2 } }, { 1, 1 }, "must contain only integers or only nested arrays")
assertFails({ 1, "2" }, 2, "must contain only integers or only nested arrays")
assertFails({ 1, 2.5 }, 2, "must be an integer")
assertFails({ [1] = 1, [3] = 3 }, 3, "must be a dense array")
assertFails({ 1, 2 }, nil, "width must be a positive integer")
assertFails({ 1, 2 }, 0, "width must be a positive integer")
assertFails({ 1, 2 }, 1.5, "width must be a positive integer")
assertFails({ 1, 2, 3 }, 2, "value count must be divisible by width")
assertFails({ { 1 }, { 2 } }, 1, "widths must be an array")
assertFails({ { 1 }, { 2 } }, { 1 }, "values and widths must have matching lengths")
assertFails({ 1, 2 }, { 2 }, "width must be a positive integer")
