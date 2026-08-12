local function run(value, propertyPath)
	inputs = {
		[1] = value,
		active = { [1] = true },
	}
	outputs = {
		active = { [1] = true },
		names = { [1] = propertyPath },
	}
	assert(loadfile("examples/demo/ng/presets/from-object.lua"))()
	return outputs[1]
end

local nested = run({
	{
		layers = {
			{ data = { 1, 2, 3 } },
			{ data = { 3, 2, 1 } },
		},
	},
	{
		layers = {
			{ data = { 1, 2, 3 } },
			{ data = { 3, 2, 1 } },
		},
	},
}, "layers.data")

assert(#nested == 2)
for objectIndex = 1, 2 do
	assert(#nested[objectIndex] == 2)
	assert(nested[objectIndex][1][1] == 1)
	assert(nested[objectIndex][1][2] == 2)
	assert(nested[objectIndex][1][3] == 3)
	assert(nested[objectIndex][2][1] == 3)
	assert(nested[objectIndex][2][2] == 2)
	assert(nested[objectIndex][2][3] == 1)
end

local nestedArrays = run({
	groups = {
		{
			{ item = { value = "a" } },
			{ item = { value = "b" } },
		},
		{
			{ item = { value = "c" } },
		},
	},
}, "groups.item.value")

assert(nestedArrays[1][1] == "a")
assert(nestedArrays[1][2] == "b")
assert(nestedArrays[2][1] == "c")

local objectValue = run({ words = { spawn_x = 12 } }, "words.spawn_x")
assert(objectValue == 12)
