json = { null = {} }

host = {
	call = function(plugin, ...)
		local args = { ... }
		if plugin == "image/image::create" then
			return { width = args[1], height = args[2], sources = {} }
		end
		if plugin == "image/image::blit-many" then
			local atlas = args[1]
			for _, operation in ipairs(args[2]) do
				atlas.sources[#atlas.sources + 1] = operation.src
			end
			return atlas
		end
		error("unexpected plugin call: " .. plugin)
	end,
}

local function run(rects, images, width, height)
	inputs = { rects, images, width, height }
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/image-atlas.lua"))()
	return outputs[1]
end

local imageResource = { resource = { ["$resource"] = "image" } }
local atlas = run(
	{
		{ { x = 0, y = 0, width = 2, height = 3 } },
		{
			{ x = 2, y = 0, width = 4, height = 1 },
			{ { x = 0, y = 3, width = 1, height = 2 } },
		},
	},
	{
		{ "one" },
		{
			imageResource,
			{ "three" },
		},
	}
)
assert(atlas.width == 6)
assert(atlas.height == 5)
assert(#atlas.sources == 3)
assert(atlas.sources[1] == "one")
assert(atlas.sources[2] == imageResource)
assert(atlas.sources[3] == "three")

local single = run({ x = 0, y = 0, width = 1, height = 1 }, "single")
assert(single.sources[1] == "single")

local function assertFails(rects, images, expected)
	local ok, message = pcall(run, rects, images)
	assert(not ok)
	assert(tostring(message):find(expected, 1, true), tostring(message))
end

assertFails({ { x = 0, y = 0, width = 1, height = 1 } }, { "one", "two" }, "structures must match")
assertFails({ { x = 0, y = 0, width = 1, height = 1 } }, "one", "structures must match")
assertFails({ [1] = { x = 0, y = 0, width = 1, height = 1 }, [3] = {} }, { "one" }, "dense array")
