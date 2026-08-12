host = {
	call = function(plugin, path)
		assert(plugin == "image/image::open")
		return { path = path }
	end,
}

local function run(value)
	inputs = { value }
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/image-open.lua"))()
	return outputs[1]
end

local single = run("one.png")
assert(single.path == "one.png")

local nested = run({
	{ "one.png", "two.png" },
	{
		{ "three.png" },
		"four.png",
	},
})
assert(nested[1][1].path == "one.png")
assert(nested[1][2].path == "two.png")
assert(nested[2][1][1].path == "three.png")
assert(nested[2][2].path == "four.png")

local empty = run({})
assert(#empty == 0)

local function assertFails(value, expected)
	local ok, message = pcall(run, value)
	assert(not ok)
	assert(tostring(message):find(expected, 1, true), tostring(message))
end

assertFails(nil, "path is required")
assertFails({ "one.png", 2 }, "path[2] must be a string")
assertFails({ [1] = "one.png", [3] = "three.png" }, "must be a dense array")
assertFails({ [1] = "one.png", name = "two.png" }, "must not mix array and object keys")
