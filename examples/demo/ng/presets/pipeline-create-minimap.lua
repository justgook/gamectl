-- Create Minimap - Pipeline Step 4
-- Calls minimap2 plugin to generate tilemap visualization from tree
-- Inputs: tree, map, direction
-- Outputs: map (success), error (failure)

---@type { awaitCall: fun(service: string, method: string, payload: string): string }
_G.host = host

---@type { encode: fun(value: any): string, decode: fun(text: string): any }
_G.json = json

---@type string[]
_G.inputs = inputs
---@type string[]
_G.outputs = outputs

local tree = inputs[1]
if tree == nil or tree == "" then
	tree = "progression.tree.json"
end
local map = inputs[2]
if map == nil or map == "" then
	map = "/minimap.map.json"
end
local direction = inputs[3]
if direction == nil or direction == "" then
	direction = "radial"
end

local payload = {
	tree = tree,
	map = map,
	direction = direction,
}

local resultText = host.awaitCall("minimap2", "gen", json.encode(payload))
local ok, response = pcall(json.decode, resultText)
if not ok then
	outputs[1] = ""
	outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
	return
end

if response.success then
	outputs[1] = map -- Return the map source path
	outputs[2] = "" -- No error
else
	outputs[1] = "" -- No map source path on error
	outputs[2] = response.error or "Unknown error"
end

