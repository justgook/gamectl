local function run(value)
	inputs = {
		[1] = value,
		active = { [1] = true },
	}
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/unique-values.lua"))()
	return outputs[1]
end

local nested = run({
	{ 1, 1, 2 },
	{ 2, { 3, 3, 1, 1 } },
})
assert(#nested == 2)
assert(#nested[1] == 2)
assert(nested[1][1] == 1)
assert(nested[1][2] == 2)
assert(#nested[2] == 2)
assert(nested[2][1] == 2)
assert(#nested[2][2] == 2)
assert(nested[2][2][1] == 3)
assert(nested[2][2][2] == 1)

local values = run({ 3, 1, 3, 2, 1 })
assert(#values == 3)
assert(values[1] == 3)
assert(values[2] == 1)
assert(values[3] == 2)

local structuralArrays = run({ { 1, 1, 2 }, { 1, 2 }, { 2, 1 } })
assert(#structuralArrays == 2)
assert(structuralArrays[1][1] == 1)
assert(structuralArrays[1][2] == 2)
assert(structuralArrays[2][1] == 2)
assert(structuralArrays[2][2] == 1)

local mixedTypes = run({ 1, "1", true, 1, "1", false, true })
assert(#mixedTypes == 4)
assert(mixedTypes[1] == 1)
assert(mixedTypes[2] == "1")
assert(mixedTypes[3] == true)
assert(mixedTypes[4] == false)

local input = { { 1, 1 } }
local output = run(input)
assert(#input[1] == 2)
assert(#output[1] == 1)

local ok, message = pcall(run, { named = 1 })
assert(not ok)
assert(tostring(message):find("must contain only positive integer keys", 1, true))
