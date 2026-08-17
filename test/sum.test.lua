local PRESET = "examples/demo/ng/presets/sum.lua"

local function run(left, right)
	inputs = {
		[1] = left,
		[2] = right,
		active = { [1] = true, [2] = true },
	}
	outputs = {}
	assert(loadfile(PRESET))()
	return outputs[1]
end

assert(run(2, 3) == 5)
assert(run(-2.5, 1) == -1.5)
assert(run("10", "2.5") == 12.5)

local ok, message = pcall(run, nil, 1)
assert(not ok)
assert(tostring(message):find("left must be a number", 1, true))

ok, message = pcall(run, 1, "invalid")
assert(not ok)
assert(tostring(message):find("right must be a number", 1, true))
