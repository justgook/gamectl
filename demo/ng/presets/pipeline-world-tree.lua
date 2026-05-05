-- World Tree Generator - Pipeline Step 1
-- Calls treegen plugin to generate procedural tree
-- Inputs: nodeCount, maxDepth, maxBranching, rootBranches, src
-- Outputs: src (success), error (failure)

---@type { awaitCall: fun(service: string, method: string, payload: string): string }
_G.host = host

---@type { encode: fun(value: any): string }
_G.json = json

---@type string[]
_G.inputs = inputs

local nodeCount = inputs[1]
if nodeCount == nil or nodeCount == "" then
	nodeCount = "10"
end
local maxDepth = inputs[2]
if maxDepth == nil or maxDepth == "" then
	maxDepth = "0"
end
local maxBranching = inputs[3]
if maxBranching == nil or maxBranching == "" then
	maxBranching = "0"
end
local rootBranches = inputs[4]
if rootBranches == nil or rootBranches == "" then
	rootBranches = "0"
end
local src = inputs[5]
if src == nil or src == "" then
	src = "progression.tree.json"
end

local payload = {
	src = src,
	nodeCount = tonumber(nodeCount) or 10,
	maxDepth = tonumber(maxDepth) or 0,
	maxBranching = tonumber(maxBranching) or 0,
	rootBranches = tonumber(rootBranches) or 0,
}

---@type { awaitCall: fun(service: string, method: string, payload: string): string }
_G.host = host
---@type { encode: fun(value: any): string }
_G.json = json

local resultText = host.awaitCall("treegen", "gen", json.encode(payload))
local ok, response = pcall(json.decode, resultText)
if not ok then
	---@type string
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
