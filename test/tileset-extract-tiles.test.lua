local function source(name, width, height)
	return { kind = "source", name = name, width = width, height = height }
end

json = { null = {} }

host = {
	call = function(method, ...)
		local args = { ... }
		if method == "image/image::info" then
			local image = args[1]
			return { width = image.width, height = image.height }
		end
		if method == "image/image::crop" then
			local image = args[1]
			local rect = args[2]
			return {
				kind = "tile",
				source = image.name,
				x = rect.x0,
				y = rect.y0,
				width = rect.x1 - rect.x0,
				height = rect.y1 - rect.y0,
			}
		end
		if method == "image/image::create" then
			return { kind = "atlas", width = args[1], height = args[2], slots = {} }
		end
		if method == "image/image::blit" then
			local atlas = args[1]
			local tile = args[2]
			local at = args[3]
			local result = { kind = "atlas", width = atlas.width, height = atlas.height, slots = {} }
			for index, slot in ipairs(atlas.slots) do
				result.slots[index] = slot
			end
			result.slots[#result.slots + 1] = {
				source = tile.source,
				sourceX = tile.x,
				sourceY = tile.y,
				x = at.x,
				y = at.y,
			}
			return result
		end
		error("unexpected host call: " .. method)
	end,
}

local function run(images, tileSize, tileIDs)
	inputs = {
		[1] = images,
		[2] = tileSize,
		[3] = tileIDs,
		active = { [1] = true, [2] = true, [3] = true },
	}
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/tileset-extract-tiles.lua"))()
	return outputs[1]
end

-- A has 16 tiles (4x4), so global tile 17 starts B.
local atlas = run({ source("A", 64, 64), source("B", 160, 160) }, 16, { 1, 10, 85 })
assert(atlas.width == 32)
assert(atlas.height == 32)
assert(#atlas.slots == 3)
assert(atlas.slots[1].source == "A" and atlas.slots[1].sourceX == 0 and atlas.slots[1].sourceY == 0)
assert(atlas.slots[2].source == "A" and atlas.slots[2].sourceX == 16 and atlas.slots[2].sourceY == 32)
-- Global 85 is local tile 69 in B: zero-based index 68 in a 10-column source.
assert(atlas.slots[3].source == "B" and atlas.slots[3].sourceX == 128 and atlas.slots[3].sourceY == 96)
assert(atlas.slots[1].x == 0 and atlas.slots[1].y == 0)
assert(atlas.slots[2].x == 16 and atlas.slots[2].y == 0)
assert(atlas.slots[3].x == 0 and atlas.slots[3].y == 16)

-- Keep the atlas near-square, but omit a completely empty trailing row.
local compactAtlas = run({ source("A", 64, 64) }, 16, { 1, 2, 3, 4, 5 })
assert(compactAtlas.width == 48)
assert(compactAtlas.height == 32)
assert(compactAtlas.slots[5].x == 16 and compactAtlas.slots[5].y == 16)

local ok, message = pcall(run, { source("invalid", 65, 64) }, 16, { 1 })
assert(not ok)
assert(tostring(message):find("must both be divisible by tileSize 16", 1, true))

ok, message = pcall(run, { source("A", 64, 64) }, 16, { 17 })
assert(not ok)
assert(tostring(message):find("exceeds available global tile range 1%-16"))
