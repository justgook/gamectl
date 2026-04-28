-- Assign Biomes - Pipeline Step 2
-- Calls biomes plugin to assign biome names to tree nodes
-- Inputs: treeId, biomesQuery
-- Outputs: treeId (success), error (failure)

local treeId = inputs[1]
if treeId == nil or treeId == "" then
	treeId = "progression"
end
local biomesQuery = inputs[2]
if biomesQuery == nil or biomesQuery == "" then
	biomesQuery = "SELECT name FROM biomes ORDER BY RANDOM()"
end

local payload = {
	treeId = treeId,
	biomesQuery = biomesQuery,
}

local resultText = host.awaitCall("biomes", "gen", json.encode(payload))
local ok, response = pcall(json.decode, resultText)
if not ok then
	outputs[1] = ""
	outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
	return
end

if response.success then
	outputs[1] = treeId -- Return the tree ID
	outputs[2] = "" -- No error
else
	outputs[1] = "" -- No tree ID on error
	outputs[2] = response.error or "Unknown error"
end

