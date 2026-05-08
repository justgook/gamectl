-- run.lua
--
-- Compiles a browser view-ng raw node-array graph into one Lua program.
--
-- Compiler input:
--   _G.input or input: JSON string containing the graph returned by view-ng.getGraph().
--
-- Compiler output:
--   output: generated Lua source code as a string. The lua plugin JSON-encodes this
--   global, so callers should JSON.parse(lua.run(...).output) to get the source.
--
-- Generated program conventions:
--   * code-node scripts execute with `inputs` and `outputs` tables in scope
--   * branch activity is available as `inputs.active[portId]`
--   * outgoing branch activity is controlled with `outputs.active[portId]`
--   * code-node scripts may also use `_G.inputs` and `_G.outputs`
--   * final graph results are written to global `output`
--   * optional progress is provided by emitting an injected `__ng_progress` hook

local NG = {
	NODE_GOAL = 1,
	NODE_CODE = 2,
	NODE_CALL = 3,
	NODE_VALUE = 4,
}

local graphJson = _G.input or input
if type(graphJson) ~= "string" or graphJson == "" then
	error("run.lua requires graph JSON in _G.input or input")
end

local graph = json.decode(graphJson)
if type(graph) ~= "table" then
	error("run.lua graph JSON must decode to an array")
end

local progressSource = _G.ngProgressSource or ngProgressSource or ""
if type(progressSource) ~= "string" then
	error("run.lua ngProgressSource must be a string")
end

local function assertInteger(value, label)
	if type(value) ~= "number" or value ~= math.floor(value) then
		error(label .. " must be an integer")
	end
	return value
end

local function nodeLabel(node)
	return "node " .. tostring(node and node.id or "?")
end

local function portLabel(node, port, direction)
	return nodeLabel(node) .. " " .. direction .. " " .. tostring(port and port.id or "?")
end

local nodesById = {}
for index, node in ipairs(graph) do
	if type(node) ~= "table" then
		error("graph entry " .. tostring(index) .. " must be an object")
	end
	local id = assertInteger(node.id, "graph entry " .. tostring(index) .. ".id")
	if nodesById[id] then
		error("duplicate node id: " .. tostring(id))
	end
	nodesById[id] = node
end

local function getNode(nodeId)
	local node = nodesById[nodeId]
	if not node then
		error("missing node: " .. tostring(nodeId))
	end
	return node
end

local function getInputs(node)
	return node.inputs or {}
end

local function getOutputs(node)
	return node.outputs or {}
end

local function hasOutput(node, outputId)
	for _, outputPort in ipairs(getOutputs(node)) do
		if outputPort.id == outputId then
			return true
		end
	end
	return false
end

local function isConnectedInput(inputPort)
	return inputPort.srcNodeId ~= nil
		and inputPort.srcOutputId ~= nil
		and inputPort.srcNodeId ~= 0
		and inputPort.srcOutputId ~= 0
end


local function validateGraph()
	for _, node in ipairs(graph) do
		assertInteger(node.id, nodeLabel(node) .. ".id")
		assertInteger(node.kind, nodeLabel(node) .. ".kind")

		local inputIds = {}
		for _, inputPort in ipairs(getInputs(node)) do
			local inputId = assertInteger(inputPort.id, portLabel(node, inputPort, "input") .. ".id")
			if inputPort.name == "active" then
				error(portLabel(node, inputPort, "input") .. ".name uses reserved name 'active'")
			end
			if inputIds[inputId] then
				error(nodeLabel(node) .. " has duplicate input id " .. tostring(inputId))
			end
			inputIds[inputId] = true

			if isConnectedInput(inputPort) then
				local srcNodeId =
					assertInteger(inputPort.srcNodeId, portLabel(node, inputPort, "input") .. ".srcNodeId")
				local srcOutputId =
					assertInteger(inputPort.srcOutputId, portLabel(node, inputPort, "input") .. ".srcOutputId")
				local srcNode = getNode(srcNodeId)
				if not hasOutput(srcNode, srcOutputId) then
					error(
						portLabel(node, inputPort, "input")
							.. " references missing source output "
							.. tostring(srcNodeId)
							.. "."
							.. tostring(srcOutputId)
					)
				end
			end
		end

		local outputIds = {}
		for _, outputPort in ipairs(getOutputs(node)) do
			local outputId = assertInteger(outputPort.id, portLabel(node, outputPort, "output") .. ".id")
			if outputPort.name == "active" then
				error(portLabel(node, outputPort, "output") .. ".name uses reserved name 'active'")
			end
			if outputIds[outputId] then
				error(nodeLabel(node) .. " has duplicate output id " .. tostring(outputId))
			end
			outputIds[outputId] = true
		end
	end
end

local function findGoalNodes()
	local goals = {}
	for _, node in ipairs(graph) do
		if node.kind == NG.NODE_GOAL then
			goals[#goals + 1] = node
		end
	end
	return goals
end

local function luaVar(nodeId, outputId)
	return ("n%d_o%d"):format(nodeId, outputId)
end

local function luaActiveVar(nodeId, outputId)
	return ("n%d_o%d_active"):format(nodeId, outputId)
end

local function luaString(value)
	return string.format("%q", tostring(value or ""))
end

local function luaLiteral(value)
	local valueType = type(value)
	if valueType == "nil" then
		return "nil"
	elseif valueType == "string" then
		return luaString(value)
	elseif valueType == "number" then
		return tostring(value)
	elseif valueType == "boolean" then
		return value and "true" or "false"
	end
	error("cannot emit Lua literal for " .. valueType)
end

local function bytesToString(bytes)
	local chars = {}
	for index, byte in ipairs(bytes) do
		if type(byte) ~= "number" then
			error("fs.read output byte " .. tostring(index) .. " must be a number")
		end
		chars[index] = string.char(byte)
	end
	return table.concat(chars)
end

local function unwrapFsReadOutput(raw, path)
	-- The expected PDK shape is raw fs.read bytes as a Lua string. Keep support
	-- for a wrapped JSON result too, because some host bridges expose plugin
	-- result envelopes while sync-call plumbing is evolving.
	local ok, decoded = pcall(json.decode, raw)
	if not ok or type(decoded) ~= "table" or decoded.returnCode == nil or decoded.output == nil then
		return raw
	end

	if tonumber(decoded.returnCode) ~= 0 then
		error("fs.read failed for " .. path .. ": " .. tostring(decoded.output))
	end

	if type(decoded.output) == "string" then
		return decoded.output
	end
	if type(decoded.output) == "table" then
		return bytesToString(decoded.output)
	end

	error("fs.read returned unsupported output for " .. path)
end

local function readTextFile(path)
	if type(path) ~= "string" or path == "" then
		error("code node is missing codePath")
	end
	return unwrapFsReadOutput(host.call("fs", "read", path), path)
end

local needed = {}
local function markNeededNode(nodeId)
	if needed[nodeId] then
		return
	end
	local node = getNode(nodeId)
	needed[nodeId] = true
	for _, inputPort in ipairs(getInputs(node)) do
		if isConnectedInput(inputPort) then
			markNeededNode(inputPort.srcNodeId)
		end
	end
end

local function collectNeededNodes(goalNodes)
	if #goalNodes == 0 then
		error("graph has no goal nodes to run")
	end
	for _, goal in ipairs(goalNodes) do
		markNeededNode(goal.id)
	end
end

local visiting = {}
local visited = {}
local ordered = {}
local function visit(nodeId)
	if visited[nodeId] then
		return
	end
	if visiting[nodeId] then
		error("cycle detected at node: " .. tostring(nodeId))
	end

	visiting[nodeId] = true
	local node = getNode(nodeId)
	for _, inputPort in ipairs(getInputs(node)) do
		if isConnectedInput(inputPort) and needed[inputPort.srcNodeId] then
			visit(inputPort.srcNodeId)
		end
	end
	visiting[nodeId] = nil
	visited[nodeId] = true
	ordered[#ordered + 1] = node
end

local function orderNeededNodes()
	for _, node in ipairs(graph) do
		if needed[node.id] then
			visit(node.id)
		end
	end
end

local lines = {}
local function emit(line)
	lines[#lines + 1] = line or ""
end

local function emitOutputDeclarations(node)
	for _, outputPort in ipairs(getOutputs(node)) do
		emit(("local %s = nil"):format(luaVar(node.id, outputPort.id)))
		emit(("local %s = false"):format(luaActiveVar(node.id, outputPort.id)))
	end
end

local function emitProgressHelpers()
	if progressSource ~= "" then
		emit(progressSource)
		emit("")
	end
	emit("if type(__ng_progress) ~= \"function\" then")
	emit("  function __ng_progress(method, nodeId, message)")
	emit("  end")
	emit("end")
	emit("")
	emit("local function __ng_node_start(nodeId)")
	emit("  __ng_progress(\"nodeStart\", nodeId)")
	emit("end")
	emit("")
	emit("local function __ng_node_done(nodeId)")
	emit("  __ng_progress(\"nodeDone\", nodeId)")
	emit("end")
	emit("")
	emit("local function __ng_node_error(nodeId, message)")
	emit("  __ng_progress(\"nodeError\", nodeId, message)")
	emit("end")
	emit("")
	emit("local function __ng_goal_start(goalId)")
	emit("  __ng_progress(\"goalStart\", goalId)")
	emit("end")
	emit("")
	emit("local function __ng_goal_done(goalId)")
	emit("  __ng_progress(\"goalDone\", goalId)")
	emit("end")
	emit("")
	emit("local function __ng_active_value(active, value)")
	emit("  if active then")
	emit("    return value")
	emit("  end")
	emit("  return nil")
	emit("end")
	emit("")
end

local function nodeActiveExpr(node)
	local activeExprs = {}
	for _, inputPort in ipairs(getInputs(node)) do
		if isConnectedInput(inputPort) then
			activeExprs[#activeExprs + 1] = luaActiveVar(inputPort.srcNodeId, inputPort.srcOutputId)
		end
	end
	if #activeExprs == 0 then
		return "true"
	end
	return table.concat(activeExprs, " or ")
end

local function emitInactiveOutputs(node, indent)
	indent = indent or ""
	for _, outputPort in ipairs(getOutputs(node)) do
		emit(("%s%s = nil"):format(indent, luaVar(node.id, outputPort.id)))
		emit(("%s%s = false"):format(indent, luaActiveVar(node.id, outputPort.id)))
	end
end

local function emitValueAssignments(node, indent)
	indent = indent or ""
	for _, outputPort in ipairs(getOutputs(node)) do
		emit(("%s%s = %s"):format(indent, luaVar(node.id, outputPort.id), luaLiteral(outputPort.value)))
		emit(("%s%s = true"):format(indent, luaActiveVar(node.id, outputPort.id)))
	end
end

local function emitValueNode(node)
	emit(("-- value node %d: %s"):format(node.id, node.name or ""))
	emit(("local __ng_node_%d_active = %s"):format(node.id, nodeActiveExpr(node)))
	emit(("if __ng_node_%d_active then"):format(node.id))
	emit(("  __ng_node_start(%d)"):format(node.id))
	emitValueAssignments(node, "  ")
	emit(("  __ng_node_done(%d)"):format(node.id))
	emit("else")
	emitInactiveOutputs(node, "  ")
	emit("end")
	emit("")
end

local function emitInputAssignments(node)
	for _, inputPort in ipairs(getInputs(node)) do
		local activeExpr = "false"
		if isConnectedInput(inputPort) then
			local sourceActive = luaActiveVar(inputPort.srcNodeId, inputPort.srcOutputId)
			local sourceValue = luaVar(inputPort.srcNodeId, inputPort.srcOutputId)
			activeExpr = sourceActive
			emit(("  if %s then"):format(sourceActive))
			emit(("    inputs[%d] = %s"):format(inputPort.id, sourceValue))
			if inputPort.name and inputPort.name ~= "" then
				emit(("    inputs[%s] = %s"):format(luaString(inputPort.name), sourceValue))
			end
			emit("  else")
			emit(("    inputs[%d] = nil"):format(inputPort.id))
			if inputPort.name and inputPort.name ~= "" then
				emit(("    inputs[%s] = nil"):format(luaString(inputPort.name)))
			end
			emit("  end")
		else
			emit(("  inputs[%d] = nil"):format(inputPort.id))
			if inputPort.name and inputPort.name ~= "" then
				emit(("  inputs[%s] = nil"):format(luaString(inputPort.name)))
			end
		end
		emit(("  inputs.active[%d] = %s"):format(inputPort.id, activeExpr))
		if inputPort.name and inputPort.name ~= "" then
			emit(("  inputs.active[%s] = %s"):format(luaString(inputPort.name), activeExpr))
		end
	end
end

local function emitUserCode(source)
	for line in tostring(source):gmatch("([^\n]*)\n?") do
		if line == "" then
			emit("")
		else
			emit("  " .. line)
		end
	end
end

local function emitOutputDefaults(node)
	for _, outputPort in ipairs(getOutputs(node)) do
		emit(("  outputs.active[%d] = true"):format(outputPort.id))
		if outputPort.name and outputPort.name ~= "" then
			emit(("  outputs.active[%s] = true"):format(luaString(outputPort.name)))
		end
	end
end

local function emitOutputAssignments(node)
	for _, outputPort in ipairs(getOutputs(node)) do
		local outVar = luaVar(node.id, outputPort.id)
		local activeVar = luaActiveVar(node.id, outputPort.id)
		emit(("  %s = outputs[%d]"):format(outVar, outputPort.id))
		if outputPort.name and outputPort.name ~= "" then
			emit(("  %s = outputs.active[%d] ~= false and outputs.active[%s] ~= false"):format(activeVar, outputPort.id, luaString(outputPort.name)))
			emit(("  -- output %s -> %s"):format(luaString(outputPort.name), outVar))
		else
			emit(("  %s = outputs.active[%d] ~= false"):format(activeVar, outputPort.id))
		end
	end
end

local function emitCodeNode(node)
	local source = readTextFile(node.codePath)

	emit(("-- code node %d: %s"):format(node.id, node.name or ""))
	emit(("local __ng_node_%d_active = %s"):format(node.id, nodeActiveExpr(node)))
	emit(("if __ng_node_%d_active then"):format(node.id))
	emit(("  __ng_node_start(%d)"):format(node.id))
	emit("  local __ng_ok, __ng_err = xpcall(function()")
	emit("  local inputs = { active = {} }")
	emit("  local outputs = { active = {} }")
	emit("  _G.inputs = inputs")
	emit("  _G.outputs = outputs")
	emitInputAssignments(node)
	emitOutputDefaults(node)
	emit("")
	emit("  -- begin user code: " .. node.codePath)
	emitUserCode(source)
	emit("  -- end user code")
	emit("")
	emitOutputAssignments(node)
	emit("  end, function(err) return tostring(err) end)")
	emit("  if not __ng_ok then")
	emit(("    __ng_node_error(%d, __ng_err)"):format(node.id))
	emit("    error(__ng_err)")
	emit("  end")
	emit(("  __ng_node_done(%d)"):format(node.id))
	emit("else")
	emitInactiveOutputs(node, "  ")
	emit("end")
	emit("")
end

local function emitNode(node)
	if node.kind == NG.NODE_VALUE then
		emitValueNode(node)
	elseif node.kind == NG.NODE_CODE then
		emitCodeNode(node)
	elseif node.kind == NG.NODE_GOAL then
		-- Goal nodes are emitted in the final output block.
	elseif node.kind == NG.NODE_CALL then
		error("call/import nodes are not implemented yet: " .. tostring(node.id))
	else
		error("unknown node kind " .. tostring(node.kind) .. " at node " .. tostring(node.id))
	end
end

local function emitFinalOutput(goalNodes)
	emit("output = {")
	for _, goal in ipairs(goalNodes) do
		emit(("  [%s] = {"):format(luaString(goal.name ~= "" and goal.name or ("goal_" .. tostring(goal.id)))))
		emit(("    id = %d,"):format(goal.id))
		emit("    inputs = {")
		for _, inputPort in ipairs(getInputs(goal)) do
			local valueExpr = "nil"
			if isConnectedInput(inputPort) then
				valueExpr = ("__ng_active_value(%s, %s)"):format(luaActiveVar(inputPort.srcNodeId, inputPort.srcOutputId), luaVar(inputPort.srcNodeId, inputPort.srcOutputId))
			end
			local key = inputPort.name ~= "" and inputPort.name or tostring(inputPort.id)
			emit(("      [%s] = %s,"):format(luaString(key), valueExpr))
		end
		emit("    },")
		emit("    active = {")
		for _, inputPort in ipairs(getInputs(goal)) do
			local activeExpr = "false"
			if isConnectedInput(inputPort) then
				activeExpr = luaActiveVar(inputPort.srcNodeId, inputPort.srcOutputId)
			end
			local key = inputPort.name ~= "" and inputPort.name or tostring(inputPort.id)
			emit(("      [%s] = %s,"):format(luaString(key), activeExpr))
		end
		emit("    },")
		emit("  },")
		emit(("  -- goal %d complete"):format(goal.id))
		emit(("  -- __ng_goal_done(%d) is called after output construction"):format(goal.id))
	end
	emit("}")
	for _, goal in ipairs(goalNodes) do
		emit(("__ng_goal_start(%d)"):format(goal.id))
		emit(("__ng_goal_done(%d)"):format(goal.id))
	end
end

validateGraph()
local goalNodes = findGoalNodes()
collectNeededNodes(goalNodes)
orderNeededNodes()

emit("-- Generated Lua file")
emit("-- Do not edit manually")
emit("")
emitProgressHelpers()

for _, node in ipairs(ordered) do
	emitOutputDeclarations(node)
end
emit("")

for _, node in ipairs(ordered) do
	emitNode(node)
end

emitFinalOutput(goalNodes)

output = table.concat(lines, "\n")
