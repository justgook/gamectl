host = {
	call = function(_plugin, width, height, _format, bytes)
		return { width = width, height = height, first = bytes[1] }
	end,
}

local function run(value)
	inputs = { value }
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/lut-generator.lua"))()
	return outputs[1]
end

local lut = run({ 1, 2, 3 })
assert(lut.width == 3)
assert(lut.height == 1)
assert(lut.first == 1)

local nested = run({
	{ 1 },
	{
		{ 2, 3 },
		{ 4 },
	},
})
assert(nested[1].first == 1)
assert(nested[2][1].width == 2)
assert(nested[2][1].first == 2)
assert(nested[2][2].first == 4)

local function assertFails(value, expected)
	local ok, message = pcall(run, value)
	assert(not ok)
	assert(tostring(message):find(expected, 1, true), tostring(message))
end

assertFails({}, "must not be empty")
assertFails({ 1, { 2 } }, "must contain only integers or only nested arrays")
assertFails({ 1, "2" }, "must contain only integers or only nested arrays")
assertFails({ 1, 2.5 }, "must be an integer")
assertFails({ [1] = 1, [3] = 3 }, "must be a dense array")
