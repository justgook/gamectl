local PRESET = "examples/demo/ng/presets/array-at.lua"

local function run(array, index, arrayActive, indexActive)
	inputs = {
		[1] = array,
		[2] = index,
		active = {
			[1] = arrayActive ~= false,
			[2] = indexActive ~= false,
		},
	}
	outputs = {
		active = { [1] = true },
	}
	assert(loadfile(PRESET))()
	return outputs[1], outputs.active[1]
end

local value, active = run({ "first", "second", "last" }, 1)
assert(value == "first")
assert(active == true)

value, active = run({ "first", "second", "last" }, 3)
assert(value == "last")
assert(active == true)

value, active = run({ "first", "second", "last" }, -1)
assert(value == "last")
assert(active == true)

value, active = run({ "first", "second", "last" }, -3)
assert(value == "first")
assert(active == true)

value, active = run({ "first", "second", "last" }, 4)
assert(value == nil)
assert(active == false)

value, active = run({ "first", "second", "last" }, -4)
assert(value == nil)
assert(active == false)

value, active = run({}, -1)
assert(value == nil)
assert(active == false)

local ok, message = pcall(run, { "first" }, 0)
assert(not ok)
assert(tostring(message):find("index must be a non-zero integer", 1, true))

ok, message = pcall(run, { "first" }, 1.5)
assert(not ok)
assert(tostring(message):find("index must be a non-zero integer", 1, true))

ok, message = pcall(run, { "first" }, "1")
assert(not ok)
assert(tostring(message):find("index must be a non-zero integer", 1, true))

ok, message = pcall(run, { [1] = "first", [3] = "third" }, 1)
assert(not ok)
assert(tostring(message):find("array item '2' is nil", 1, true))

ok, message = pcall(run, { "first" }, 1, false, true)
assert(not ok)
assert(tostring(message):find("array is not connected", 1, true))

ok, message = pcall(run, { "first" }, 1, true, false)
assert(not ok)
assert(tostring(message):find("index is not connected", 1, true))
