local function run(value, originalIDs, newIDs)
	inputs = {
		[1] = value,
		[2] = originalIDs,
		[3] = newIDs,
		active = { [1] = true, [2] = true, [3] = true },
	}
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/remap-values.lua"))()
	return outputs[1]
end

local tilemap = {
	props = { tileSize = "16", unchangedNumber = 89 },
	layers = {
		{ width = 4, data = { 0, 89, 111, 7 } },
		{ width = 4, data = { 111, 89, 0, 89 } },
	},
}

local result = run(tilemap, { 89, 111 }, { 3, 4 })
assert(result.layers[1].data[1] == 0)
assert(result.layers[1].data[2] == 3)
assert(result.layers[1].data[3] == 4)
assert(result.layers[1].data[4] == 7)
assert(result.layers[2].data[1] == 4)
assert(result.layers[2].data[2] == 3)
-- The operation is generic and therefore also remaps matching values outside layer data.
assert(result.props.unchangedNumber == 3)
assert(tilemap.layers[1].data[2] == 89)
assert(tilemap.props.unchangedNumber == 89)

local strictTypes = run({ 89, "89" }, { 89 }, { 3 })
assert(strictTypes[1] == 3)
assert(strictTypes[2] == "89")

local ok, message = pcall(run, {}, { 89 }, { 3, 4 })
assert(not ok)
assert(tostring(message):find("must have equal lengths", 1, true))

ok, message = pcall(run, {}, { 89, 89 }, { 3, 4 })
assert(not ok)
assert(tostring(message):find("contains duplicate value", 1, true))
