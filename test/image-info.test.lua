host = {
	call = function(plugin, image)
		assert(plugin == "image/image::info")
		return { source = image }
	end,
}

local function run(value)
	inputs = { value }
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/image-info.lua"))()
	return outputs[1]
end

local single = run(7)
assert(single.source == 7)

local resource = { resource = { ["$resource"] = "image" } }
assert(run(resource).source == resource)

local nested = run({
	{ 1, 2 },
	{
		{ 3 },
		{ 4, 5 },
	},
})
assert(nested[1][1].source == 1)
assert(nested[1][2].source == 2)
assert(nested[2][1][1].source == 3)
assert(nested[2][2][1].source == 4)
assert(nested[2][2][2].source == 5)

local empty = run({})
assert(#empty == 0)

local function assertFails(value, expected)
	local ok, message = pcall(run, value)
	assert(not ok)
	assert(tostring(message):find(expected, 1, true), tostring(message))
end

assertFails({ [1] = 1, [3] = 3 }, "must be a dense array")
assertFails({ [1] = 1, image = 2 }, "must not mix array and object keys")
assertFails({ { 1 }, 0 }, "image[2] is required")
