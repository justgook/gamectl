local arrayMetatable = {}
json = {
  null = {},
  array = function() return setmetatable({}, arrayMetatable) end,
  object = function() return {} end,
  is_array = function(value) return getmetatable(value) == arrayMetatable or #value > 0 end,
}

local graph
json.decode = function(text)
  if text == "graph" then return graph end
  error("unexpected json input " .. tostring(text))
end

fs = { read_text = function(path)
  if path == "state-source.lua" then return "outputs[1] = _G.stateItems\noutputs[2] = 0" end
  if path == "state-initializer.lua" then return "_G.stateInitializerCount = (_G.stateInitializerCount or 0) + 1\noutputs[1] = inputs[1]" end
  if path == "state-step.lua" then return "outputs[1] = inputs[1] + inputs[2]\nif _G.stateInactiveSecond and inputs[3] == 2 then outputs.active[1] = false end" end
  if path == "state-nil.lua" then return "outputs[1] = nil" end
  if path == "state-control.lua" then return "outputs[1] = _G.stateSkipFirst and inputs[1] == 1\noutputs[2] = false" end
  error("unexpected code path " .. tostring(path))
end }

local function stateGraph(includeControl)
  local child = {
    { id = 20, kind = 8, name = "items", inputs = {}, outputs = {
      { id = 1, name = "Item" }, { id = 2, name = "Index" }, { id = 3, name = "Array" },
    } },
    { id = 21, kind = 10, name = "initial", inputs = {}, outputs = { { id = 1, name = "Value" } } },
    { id = 22, kind = 2, name = "Initialize", codePath = "state-initializer.lua", inputs = {
      { id = 1, name = "initial", srcNodeId = 21, srcOutputId = 1 },
    }, outputs = { { id = 1, name = "total" } } },
    { id = 23, kind = 11, name = "GetVar", inputs = {
      { id = 1, name = "total", srcNodeId = 22, srcOutputId = 1 },
    }, outputs = { { id = 1, name = "total" } } },
    { id = 24, kind = 2, name = "Step", codePath = "state-step.lua", inputs = {
      { id = 1, name = "total", srcNodeId = 23, srcOutputId = 1 },
      { id = 2, name = "item", srcNodeId = 20, srcOutputId = 1 },
      { id = 3, name = "index", srcNodeId = 20, srcOutputId = 2 },
    }, outputs = { { id = 1, name = "next" } } },
    { id = 25, kind = 12, name = "SetVar", inputs = {
      { id = 1, name = "total", srcNodeId = 24, srcOutputId = 1 },
    }, outputs = {} },
    { id = 26, kind = 6, name = "current", inputs = {
      { id = 1, name = "current", srcNodeId = 23, srcOutputId = 1 },
    }, outputs = {} },
  }
  if includeControl then
    child[#child + 1] = { id = 27, kind = 2, name = "Control", codePath = "state-control.lua", inputs = {
      { id = 1, name = "index", srcNodeId = 20, srcOutputId = 2 },
    }, outputs = { { id = 1, name = "skip" }, { id = 2, name = "break" } } }
    child[#child + 1] = { id = 28, kind = 9, name = "Iteration Control", inputs = {
      { id = 1, name = "Skip", srcNodeId = 27, srcOutputId = 1 },
      { id = 2, name = "Break", srcNodeId = 27, srcOutputId = 2 },
    }, outputs = {} }
  end
  return {
    { id = 1, kind = 2, name = "Source", codePath = "state-source.lua", inputs = {}, outputs = {
      { id = 1, name = "items" }, { id = 2, name = "initial" },
    } },
    { id = 10, kind = 7, name = "Stateful", inputs = {
      { id = 20, name = "items", srcNodeId = 1, srcOutputId = 1 },
      { id = 21, name = "initial", srcNodeId = 1, srcOutputId = 2 },
    }, outputs = { { id = 26, name = "values" } }, childGraph = child },
    { id = 30, kind = 1, name = "Result", inputs = {
      { id = 1, name = "values", srcNodeId = 10, srcOutputId = 26 },
    }, outputs = {} },
  }
end

local function compileGraph()
  input = "graph"
  dofile("examples/demo/ng/compile-graph.lua")
  local compile = main
  local generatedSource = compile()
  local generatedChunk, syntaxError = loadstring(generatedSource)
  if not generatedChunk then error(syntaxError .. "\n" .. generatedSource) end
  generatedChunk()
end

stateItems = {1, 2, 3}
stateInitializerCount = 0
stateInactiveSecond = true
stateSkipFirst = false
graph = stateGraph(false)
compileGraph()
local result = main()
assert(stateInitializerCount == 1)
assert(#result.Result.inputs.values == 3)
assert(result.Result.inputs.values[1] == 0)
assert(result.Result.inputs.values[2] == 1)
assert(result.Result.inputs.values[3] == 1)

stateInactiveSecond = false
stateSkipFirst = true
graph = stateGraph(true)
compileGraph()
result = main()
assert(stateInitializerCount == 2)
assert(#result.Result.inputs.values == 2)
assert(result.Result.inputs.values[1] == 1)
assert(result.Result.inputs.values[2] == 3)

stateItems = json.array()
stateSkipFirst = false
graph = stateGraph(false)
compileGraph()
result = main()
assert(stateInitializerCount == 2)
assert(#result.Result.inputs.values == 0)

stateItems = {1}
graph = stateGraph(false)
graph[2].childGraph[5].codePath = "state-nil.lua"
compileGraph()
local nilOk, nilError = pcall(main)
assert(not nilOk)
assert(tostring(nilError):find("active nil update", 1, true))

graph = stateGraph(false)
graph[2].childGraph[6].inputs[1].srcNodeId = 0
graph[2].childGraph[6].inputs[1].srcOutputId = 0
local unconnectedOk, unconnectedError = pcall(function()
  dofile("examples/demo/ng/compile-graph.lua")
  main()
end)
assert(not unconnectedOk)
assert(tostring(unconnectedError):find("must be connected", 1, true))

graph = stateGraph(false)
graph[2].childGraph[#graph[2].childGraph + 1] = {
  id = 29, kind = 11, name = "Duplicate GetVar",
  inputs = { { id = 1, name = "total", srcNodeId = 21, srcOutputId = 1 } },
  outputs = { { id = 1, name = "total" } },
}
local duplicateOk, duplicateError = pcall(function()
  dofile("examples/demo/ng/compile-graph.lua")
  main()
end)
assert(not duplicateOk)
assert(tostring(duplicateError):find("duplicate GetVar variable", 1, true))

graph = stateGraph(false)
graph[2].childGraph[6].inputs[1].name = "missing"
local missingOk, missingError = pcall(function()
  dofile("examples/demo/ng/compile-graph.lua")
  main()
end)
assert(not missingOk)
assert(tostring(missingError):find("undeclared Iteration State", 1, true))
