-- Assign Minimap Shapes - Pipeline Step
-- Reads a tree JSON file, assigns random readable minimap masks to each node,
-- and writes the updated tree JSON.
-- Inputs: tree, out
-- Outputs: out (success), error (failure)

local function fail(message)
	outputs[1] = ""
	outputs[2] = message
end

local treePath = inputs[1]
if treePath == nil or treePath == "" then
	treePath = "progression.tree.json"
end

local outPath = inputs[2]
if outPath == nil or outPath == "" then
	outPath = treePath
end

local ROOM_SHAPES = {
	"#",
	"##",
	"#/#",
	"##/#.",
	"##/.#",
	"##/##",
	"##/##/##",
	"###/###",
	"##/#./#.",
	"##/.#/.#",
	"#../###",
	"..#/###",
	"###/.#.",
	".#./###",
}

local function readJson(path, label)
	local text = host.awaitCall("fs", "read", path)
	local ok, data = pcall(json.decode, text)
	if not ok or type(data) ~= "table" then
		fail("Failed to parse " .. label .. " JSON: " .. tostring(path))
		return nil
	end
	return data
end

local function randomIndex(count)
	return math.random(count)
end

local tree = readJson(treePath, "tree")
if tree == nil then
	return
end

if #tree == 0 then
	fail("tree must contain at least one node")
	return
end

for index, node in ipairs(tree) do
	if type(node) ~= "table" then
		fail("tree node " .. tostring(index) .. " must be an object")
		return
	end
	if node.data == nil then
		node.data = {}
	elseif type(node.data) ~= "table" then
		fail("tree node " .. tostring(index) .. " data must be an object")
		return
	end

	local shapeIndex = randomIndex(#ROOM_SHAPES)
	if shapeIndex == nil then
		return
	end
	node.data.minimap = ROOM_SHAPES[shapeIndex]
end

host.awaitCall("fs", "write", outPath .. "\0" .. json.encode(tree))

outputs[1] = outPath
outputs[2] = ""
