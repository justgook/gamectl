-- Create Minimap - Pipeline Step 4
-- Calls minimap.comp to generate tilemap visualization from tree
-- Inputs: tree, map, direction (legacy/ignored)
-- Outputs: map (success), error (failure)

---@type { call: fun(target: string, ...): any }
_G.host = host

---@type { encode: fun(value: any): string, decode: fun(text: string): any }
_G.json = json

---@type string[]
_G.inputs = inputs
---@type string[]
_G.outputs = outputs

local treePath = inputs[1]
if treePath == nil or treePath == "" then
	treePath = "progression.tree.json"
end

local mapPath = inputs[2]
if mapPath == nil or mapPath == "" then
	mapPath = "minimap.map.json"
end

local function fail(message)
	outputs[1] = ""
	outputs[2] = tostring(message)
end

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

local function mapToEntries(map)
	local entries = {}
	local keys = {}
	for key, _ in pairs(map or {}) do
		keys[#keys + 1] = tostring(key)
	end
	table.sort(keys)
	for _, key in ipairs(keys) do
		entries[#entries + 1] = { key, tostring(map[key] or "") }
	end
	return entries
end

local function entriesToMap(entries)
	local map = {}
	for _, entry in ipairs(entries or {}) do
		map[tostring(entry[1])] = tostring(entry[2] or "")
	end
	return map
end

local function treeToWit(tree)
	local witTree = {}
	for index, node in ipairs(tree) do
		witTree[index] = {
			["parent-id"] = node.parent,
			data = mapToEntries(node.data),
		}
	end
	return witTree
end

local function tileMapFromWit(witTileMap)
	local tileMap = {
		layers = {},
		props = entriesToMap(witTileMap.props),
	}
	for index, layer in ipairs(witTileMap.layers or {}) do
		tileMap.layers[index] = {
			width = layer.width,
			data = layer.data or {},
			props = entriesToMap(layer.props),
		}
	end
	return tileMap
end

local okRead, treeText = pcall(host.call, "fs/fs::read-text", treePath)
if not okRead then
	fail("Failed to read tree: " .. tostring(treeText))
	return
end

local okDecode, tree = pcall(json.decode, treeText)
if not okDecode then
	fail("Failed to parse tree JSON: " .. tostring(tree))
	return
end

local okGen, witTileMap = pcall(host.call, "minimap/minimap::gen", treeToWit(tree))
if not okGen then
	fail("minimap generation failed: " .. tostring(witTileMap))
	return
end

ensureParentDirs(mapPath)
local okWrite, writeErr = pcall(host.call, "fs/fs::write-text", mapPath, json.encode(tileMapFromWit(witTileMap)))
if not okWrite then
	fail("Failed to write tilemap: " .. tostring(writeErr))
	return
end

outputs[1] = mapPath
outputs[2] = ""
