local arrayMetatable = {}
json = {
  null = {},
  array = function() return setmetatable({}, arrayMetatable) end,
  object = function() return {} end,
  is_array = function(value) return getmetatable(value) == arrayMetatable or #value > 0 end,
}

local graph = {
  { id = 1, kind = 2, name = "Sources", codePath = "sources.lua", inputs = {}, outputs = {
    { id = 1, name = "items" }, { id = 2, name = "short" }, { id = 3, name = "configuration" },
  } },
  { id = 10, kind = 7, name = "Each", inputs = {
    { id = 20, name = "items", srcNodeId = 1, srcOutputId = 1 },
    { id = 25, name = "short", srcNodeId = 1, srcOutputId = 2 },
    { id = 26, name = "configuration", srcNodeId = 1, srcOutputId = 3 },
  }, outputs = { { id = 22, name = "results" } }, childGraph = {
    { id = 20, kind = 8, name = "items", inputs = {}, outputs = {
      { id = 1, name = "Item" }, { id = 2, name = "Index" }, { id = 3, name = "Array" },
    } },
    { id = 25, kind = 8, name = "short", inputs = {}, outputs = {
      { id = 1, name = "Item" }, { id = 2, name = "Index" }, { id = 3, name = "Array" },
    } },
    { id = 26, kind = 10, name = "configuration", inputs = {}, outputs = {
      { id = 1, name = "Value" },
    } },
    { id = 21, kind = 2, name = "Double", codePath = "double.lua", inputs = {
      { id = 1, name = "item", srcNodeId = 20, srcOutputId = 1 },
      { id = 2, name = "shortItem", srcNodeId = 25, srcOutputId = 1 },
      { id = 3, name = "shortIndex", srcNodeId = 25, srcOutputId = 2 },
      { id = 4, name = "shortArray", srcNodeId = 25, srcOutputId = 3 },
      { id = 5, name = "configuration", srcNodeId = 26, srcOutputId = 1 },
    }, outputs = { { id = 1, name = "result" } } },
    { id = 40, kind = 7, name = "Nested", inputs = {
      { id = 41, name = "shortArray", srcNodeId = 25, srcOutputId = 3 },
    }, outputs = { { id = 43, name = "nestedResults" } }, childGraph = {
      { id = 41, kind = 8, name = "shortArray", inputs = {}, outputs = {
        { id = 1, name = "Item" }, { id = 2, name = "Index" }, { id = 3, name = "Array" },
      } },
      { id = 42, kind = 2, name = "Nested Double", codePath = "nested-double.lua", inputs = {
        { id = 1, name = "item", srcNodeId = 41, srcOutputId = 1 },
      }, outputs = { { id = 1, name = "result" } } },
      { id = 43, kind = 6, name = "nestedResult", inputs = {
        { id = 1, name = "result", srcNodeId = 42, srcOutputId = 1 },
      }, outputs = {} },
    } },
    { id = 22, kind = 6, name = "result", inputs = {
      { id = 1, name = "result", srcNodeId = 40, srcOutputId = 43 },
    }, outputs = {} },
    { id = 24, kind = 2, name = "Control", codePath = "control.lua", inputs = {
      { id = 1, name = "item", srcNodeId = 21, srcOutputId = 1 },
    }, outputs = { { id = 1, name = "skip" }, { id = 2, name = "break" } } },
    { id = 23, kind = 9, name = "Iteration Control", inputs = {
      { id = 1, name = "Skip", srcNodeId = 24, srcOutputId = 1 },
      { id = 2, name = "Break", srcNodeId = 24, srcOutputId = 2 },
    }, outputs = {} },
  } },
  { id = 30, kind = 1, name = "Result", inputs = {
    { id = 1, name = "values", srcNodeId = 10, srcOutputId = 22 },
  }, outputs = {} },
}

json.decode = function(_) return graph end
fs = { read_text = function(path)
  if path == "sources.lua" then return "outputs[1] = {1, 2, 3, 4}\noutputs[2] = {10, 10, 10, 10}\noutputs[3] = 'shared'" end
  if path == "inactive-shared-source.lua" then return "outputs[1] = {1}\noutputs[2] = {10}\noutputs[3] = 'shared'\noutputs.active[3] = false" end
  if path == "double.lua" then return [[
assert(inputs[2] == 10)
assert(inputs[3] >= 1 and inputs[3] <= 4)
assert(#inputs[4] == 4)
assert(inputs[5] == 'shared')
outputs[1] = inputs[1] * 2
]] end
  if path == "nested-double.lua" then return "outputs[1] = inputs[1] * 2" end
  if path == "control.lua" then return "outputs[1] = inputs[1] == 4\noutputs[2] = inputs[1] == 8" end
  if path == "side-source.lua" then return "outputs[1] = {1, 2, 3}" end
  if path == "side-effect.lua" then return "_G.sideEffectCount = (_G.sideEffectCount or 0) + 1" end
  if path == "unequal-sources.lua" then return "outputs[1] = {1, 2}\noutputs[2] = {10}" end
  error("unexpected code path " .. tostring(path))
end }

input = "graph"
dofile("examples/demo/ng/compile-graph.lua")
local compile = main
local generatedSource = compile()
local generatedChunk, syntaxError = loadstring(generatedSource)
if not generatedChunk then error(syntaxError .. "\n" .. generatedSource) end
generatedChunk()
local result = main()
assert(#result.Result.inputs.values == 2)
assert(#result.Result.inputs.values[1] == 4)
assert(#result.Result.inputs.values[2] == 4)
assert(result.Result.inputs.values[1][1] == 20)
assert(result.Result.inputs.values[1][4] == 20)
assert(result.Result.inputs.values[2][1] == 20)
assert(result.Result.inputs.values[2][4] == 20)

graph[1].codePath = "inactive-shared-source.lua"
dofile("examples/demo/ng/compile-graph.lua")
compile = main
generatedSource = compile()
generatedChunk, syntaxError = loadstring(generatedSource)
if not generatedChunk then error(syntaxError .. "\n" .. generatedSource) end
generatedChunk()
local inactiveOk, inactiveError = pcall(main)
assert(not inactiveOk)
assert(tostring(inactiveError):find("input 26 must be active", 1, true))

graph = {
  { id = 1, kind = 2, name = "Source", codePath = "side-source.lua", inputs = {}, outputs = { { id = 1, name = "items" } } },
  { id = 10, kind = 7, name = "Side Effects", inputs = {
    { id = 20, name = "items", srcNodeId = 1, srcOutputId = 1 },
  }, outputs = {}, childGraph = {
    { id = 20, kind = 8, name = "items", inputs = {}, outputs = {
      { id = 1, name = "Item" }, { id = 2, name = "Index" }, { id = 3, name = "Array" },
    } },
    { id = 21, kind = 2, name = "Write", codePath = "side-effect.lua", inputs = {
      { id = 1, name = "item", srcNodeId = 20, srcOutputId = 1 },
    }, outputs = {} },
  } },
}

dofile("examples/demo/ng/compile-graph.lua")
compile = main
generatedSource = compile()
generatedChunk, syntaxError = loadstring(generatedSource)
if not generatedChunk then error(syntaxError .. "\n" .. generatedSource) end
generatedChunk()
sideEffectCount = 0
main()
assert(sideEffectCount == 3)

graph = {
  { id = 1, kind = 2, name = "Unequal Sources", codePath = "unequal-sources.lua", inputs = {}, outputs = {
    { id = 1, name = "left" }, { id = 2, name = "right" },
  } },
  { id = 10, kind = 7, name = "Zip", inputs = {
    { id = 20, name = "left", srcNodeId = 1, srcOutputId = 1 },
    { id = 21, name = "right", srcNodeId = 1, srcOutputId = 2 },
  }, outputs = {}, childGraph = {
    { id = 20, kind = 8, name = "left", inputs = {}, outputs = {
      { id = 1, name = "Item" }, { id = 2, name = "Index" }, { id = 3, name = "Array" },
    } },
    { id = 21, kind = 8, name = "right", inputs = {}, outputs = {
      { id = 1, name = "Item" }, { id = 2, name = "Index" }, { id = 3, name = "Array" },
    } },
  } },
}

dofile("examples/demo/ng/compile-graph.lua")
compile = main
generatedSource = compile()
generatedChunk, syntaxError = loadstring(generatedSource)
if not generatedChunk then error(syntaxError .. "\n" .. generatedSource) end
generatedChunk()
local ok, unequalError = pcall(main)
assert(not ok)
assert(tostring(unequalError):find("For Each inputs must have equal lengths", 1, true))
