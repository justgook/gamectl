host = {
	call = function(_plugin, width, height, _format, bytes)
		return { width = width, height = height, first = bytes[1] }
	end,
}

local function tilemap(...)
	local layers = {}
	for index, data in ipairs({ ... }) do
		layers[index] = { width = #data, data = data }
	end
	return { layers = layers }
end

local function run(inputValues)
	inputs = inputValues
	outputs = {}
	assert(loadfile("examples/demo/ng/presets/lut-generator.lua"))()
	return outputs[1]
end

local allLayers = run({ tilemap({ 1 }, { 2, 3 }) })
assert(#allLayers == 2)
assert(allLayers[1].first == 1)
assert(allLayers[2].first == 2)

local selectedLayer = run({ tilemap({ 1 }, { 2, 3 }), 2 })
assert(selectedLayer.first == 2)

local allMapsAndLayers = run({
	{
		tilemap({ 1 }, { 2 }),
		tilemap({ 3 }, { 4 }),
	},
})
assert(#allMapsAndLayers == 2)
assert(#allMapsAndLayers[1] == 2)
assert(#allMapsAndLayers[2] == 2)
assert(allMapsAndLayers[1][1].first == 1)
assert(allMapsAndLayers[1][2].first == 2)
assert(allMapsAndLayers[2][1].first == 3)
assert(allMapsAndLayers[2][2].first == 4)

local selectedLayersByMap = run({
	{
		tilemap({ 1 }, { 2 }),
		tilemap({ 3 }, { 4 }),
	},
	{ 2, 1 },
})
assert(selectedLayersByMap[1].first == 2)
assert(selectedLayersByMap[2].first == 3)
