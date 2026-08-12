local function run(length, increment, start, incrementActive, startActive)
	inputs = {
		[1] = length,
		[2] = increment,
		[3] = start,
		active = {
			[1] = true,
			[2] = incrementActive == true,
			[3] = startActive == true,
		},
	}
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/int-array.lua"))()
	return outputs[1]
end

local defaults = run(4)
assert(#defaults == 4)
assert(defaults[1] == 1)
assert(defaults[2] == 2)
assert(defaults[3] == 3)
assert(defaults[4] == 4)

local stepped = run(4, 3, 10, true, true)
assert(stepped[1] == 10)
assert(stepped[2] == 13)
assert(stepped[3] == 16)
assert(stepped[4] == 19)

local descending = run(3, -2, 5, true, true)
assert(descending[1] == 5)
assert(descending[2] == 3)
assert(descending[3] == 1)

local repeated = run(3, 0, 7, true, true)
assert(repeated[1] == 7)
assert(repeated[2] == 7)
assert(repeated[3] == 7)

assert(#run(0) == 0)

local ok, message = pcall(run, -1)
assert(not ok)
assert(tostring(message):find("length must be greater than or equal to zero", 1, true))

ok, message = pcall(run, 2.5)
assert(not ok)
assert(tostring(message):find("length must be an integer", 1, true))
