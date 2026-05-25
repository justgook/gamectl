-- Assign Biomes - Pipeline Step 2
-- Calls biomes plugin to assign biome names to tree nodes
-- Inputs: src, biomesQuery
-- Outputs: src (success), error (failure)

local src = inputs[1]
if src == nil or src == "" then
	src = "progression.tree.json"
end
local biomesQuery = inputs[2]
if biomesQuery == nil or biomesQuery == "" then
	biomesQuery = "SELECT name FROM biomes ORDER BY RANDOM()"
end

local payload = {
	src = src,
	biomesQuery = biomesQuery,
}

local resultText = host.call("biomes/biomes::gen", payload)
local ok, response = pcall(json.decode, resultText)
if not ok then
	outputs[1] = ""
	outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
	return
end

if response.success then
	outputs[1] = src -- Return the tree source path
	outputs[2] = "" -- No error
else
	outputs[1] = "" -- No source path on error
	outputs[2] = response.error or "Unknown error"
end

