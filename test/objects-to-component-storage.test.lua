local function run(objects, fields, defaults, defaults_active)
	inputs = {
		[1] = objects,
		[2] = fields,
		[3] = defaults,
		active = { [1] = true, [2] = true, [3] = defaults_active ~= false },
	}
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/objects-to-component-storage.lua"))()
	return outputs[1]
end

local defaults = {
	layer = 1,
	["repeat"] = { 0, 0 },
	parallax = { 0, 0 },
}
local storage = run({
	{ tilemap = "world", layer = 2 },
	{ tilemap = "background", ["repeat"] = { 1, 0 } },
}, { "tilemap", "layer", "repeat", "parallax" }, defaults)

assert(storage.entity_ids[1] == 0)
assert(storage.entity_ids[2] == 1)
assert(storage.components[1][1] == "world")
assert(storage.components[1][2] == 2)
assert(storage.components[1][3][1] == 0 and storage.components[1][3][2] == 0)
assert(storage.components[2][1] == "background")
assert(storage.components[2][2] == 1)
assert(storage.components[2][3][1] == 1 and storage.components[2][3][2] == 0)
assert(storage.components[2][4][1] == 0 and storage.components[2][4][2] == 0)

-- Table defaults are copied for each component.
assert(storage.components[1][4] ~= storage.components[2][4])
storage.components[1][4][1] = 9
assert(storage.components[2][4][1] == 0)
assert(defaults.parallax[1] == 0)

-- Objects missing any required field are filtered out, while source entity IDs are preserved.
local filtered = run({
	{ layer = 2 },
	{ tilemap = "world" },
	{ tilemap = "foreground", layer = 3 },
}, { "tilemap", "layer" }, { layer = 1 })
assert(#filtered.entity_ids == 2)
assert(filtered.entity_ids[1] == 1 and filtered.entity_ids[2] == 2)
assert(filtered.components[1][1] == "world" and filtered.components[1][2] == 1)
assert(filtered.components[2][1] == "foreground" and filtered.components[2][2] == 3)

-- Defaults may only name fields in the ordered component schema.
local ok, message = pcall(run, { { tilemap = "world" } }, { "tilemap" }, { layer = 1 })
assert(not ok)
assert(tostring(message):find("not listed in fields", 1, true))

-- With no defaults, every selected field is required and non-matching objects are filtered out.
filtered = run({
	{ tilemap = "world" },
	{ tilemap = "foreground", layer = 3 },
}, { "tilemap", "layer" }, nil, false)
assert(#filtered.entity_ids == 1)
assert(filtered.entity_ids[1] == 1)
assert(filtered.components[1][1] == "foreground" and filtered.components[1][2] == 3)
