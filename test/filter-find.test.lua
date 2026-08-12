local function run(path, items, filter)
	inputs = { items, filter, active = { [1] = true, [2] = true } }
	outputs = { active = { [1] = true } }
	assert(loadfile(path))()
	return outputs
end

local FILTER = "examples/demo/ng/presets/filter.lua"
local FIND = "examples/demo/ng/presets/find.lua"

-- Scalar inequality filters a primitive array.
local nonzero = run(FILTER, { 0, 1, -2, 0, 3 }, "!=0")
assert(#nonzero[1] == 3)
assert(nonzero[1][1] == 1)
assert(nonzero[1][2] == -2)
assert(nonzero[1][3] == 3)

local function assert_values(actual, expected)
	assert(#actual == #expected, "array lengths differ")
	for index, value in ipairs(expected) do
		assert(actual[index] == value, "array item " .. tostring(index) .. " differs")
	end
end

local function assert_error(fragment, callback)
	local ok, message = pcall(callback)
	assert(not ok, "expected an error containing '" .. fragment .. "'")
	assert(tostring(message):find(fragment, 1, true), tostring(message))
end

-- String tests work on scalar strings.
assert_values(run(FILTER, { "home", "homepage", "at-home", "work" }, "^=home")[1], { "home", "homepage" })
assert_values(run(FILTER, { "home", "homepage", "at-home", "work" }, "$=home")[1], { "home", "at-home" })
assert_values(run(FILTER, { "say hello", "hello", "goodbye" }, "*=hello")[1], { "say hello", "hello" })

-- Numeric comparison operators use numeric operands and values.
local numbers = { 5, 10, 11, 20 }
assert_values(run(FILTER, numbers, ">10")[1], { 11, 20 })
assert_values(run(FILTER, numbers, "<10")[1], { 5 })
assert_values(run(FILTER, numbers, ">=10")[1], { 10, 11, 20 })
assert_values(run(FILTER, numbers, "<=10")[1], { 5, 10 })

-- A field prefix applies a test to that direct object property.
local objects = {
	{ name = "home", score = 10 },
	{ name = "homepage", score = 15 },
	{ name = "work from home", score = 20 },
	{ name = "work", score = 12 },
}
local names_containing_home = run(FILTER, objects, "name*=home")[1]
assert_values(names_containing_home, { objects[1], objects[2], objects[3] })

-- Arrays of tests use AND semantics.
local combined = run(FILTER, objects, { "name*=home", "score>=10", "score<20" })[1]
assert_values(combined, { objects[1], objects[2] })

-- Find uses the same matcher and returns only the first match.
assert(run(FIND, numbers, ">10")[1] == 11)
assert(run(FIND, objects, { "name*=home", "score>=15" })[1] == objects[2])
local missing = run(FIND, numbers, ">100")
assert(missing[1] == nil)
assert(missing.active[1] == false)

-- Existing recursive partial-object filters remain supported.
local nested = {
	{ id = 1, stats = { element = "fire", hp = 10 } },
	{ id = 2, stats = { element = "ice", hp = 20 } },
}
assert_values(run(FILTER, nested, { stats = { element = "fire" } })[1], { nested[1] })
assert(run(FIND, nested, { stats = { element = "ice" } })[1] == nested[2])

-- Operators reject values of the wrong type instead of coercing them.
for _, operator in ipairs({ "^=", "$=", "*=" }) do
	assert_error("requires a string value", function()
		run(FILTER, { 10 }, operator .. "1")
	end)
end
for _, operator in ipairs({ ">", "<", ">=", "<=" }) do
	assert_error("requires numeric values", function()
		run(FILTER, { "10" }, operator .. "1")
	end)
end
assert_error("requires an object item", function()
	run(FILTER, { "home" }, "name*=home")
end)
