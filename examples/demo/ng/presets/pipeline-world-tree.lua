-- World Tree Generator - Pipeline Step 1
-- Calls treegen plugin to generate procedural tree
-- Inputs: nodeCount, maxDepth, maxBranching, rootBranches, src
-- Outputs: src (success), error (failure)

---@type { call: fun(target: string, ...): any }
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

---@type { call: fun(target: string, ...): any }
_G.host = host
---@type { encode: fun(value: any): string }
_G.json = json

local function ensureParentDirs(path)
	local dir = string.match(path, "^(.*)/[^/]*$")
	if dir == nil or dir == "" then
		return
	end
	local current = ""
	for part in string.gmatch(dir, "[^/]+") do
		if current == "" then
			current = part
		else
			current = current .. "/" .. part
		end
		pcall(host.call, "fs/fs::create-dir", current)
	end
end

local generatedTree = host.call("tree-generator/tree-generator::gen", {
	["node-count"] = payload.nodeCount,
	["max-depth"] = payload.maxDepth,
	["max-branching"] = payload.maxBranching,
	["root-branches"] = payload.rootBranches,
})

local tree = {}
for index, node in ipairs(generatedTree) do
	local data = {}
	for _, entry in ipairs(node.data or {}) do
		data[tostring(entry[1])] = tostring(entry[2] or "")
	end
	tree[index] = {
		parent = node["parent-id"],
		data = data,
	}
end

ensureParentDirs(src)
host.call("fs/fs::write-text", src, json.encode(tree))
outputs[1] = src -- Return the tree source path
outputs[2] = "" -- No error
