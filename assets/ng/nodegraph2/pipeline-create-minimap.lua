-- Create Minimap - Pipeline Step 4
-- Calls minimap2 plugin to generate tilemap visualization from tree
-- Inputs: inputTreeId, mapId, direction
-- Outputs: mapId (success), error (failure)

---@type { awaitCall: fun(service: string, method: string, payload: string): string }
_G.host = host

---@type { encode: fun(value: any): string, decode: fun(text: string): any }
_G.json = json

---@type string[]
_G.inputs = inputs
---@type string[]
_G.outputs = outputs

local inputTreeId = inputs[1]
if inputTreeId == nil or inputTreeId == "" then
	inputTreeId = "progression"
end
local mapId = inputs[2]
if mapId == nil or mapId == "" then
	mapId = "new_map"
end
local direction = inputs[3]
if direction == nil or direction == "" then
	direction = "radial"
end

local payload = {
	treeId = inputTreeId,
	mapId = mapId,
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
	outputs[1] = mapId -- Return the map ID
	outputs[2] = "" -- No error
else
	outputs[1] = "" -- No map ID on error
	outputs[2] = response.error or "Unknown error"
end

