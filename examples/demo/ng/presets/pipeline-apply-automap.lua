-- Apply Automap Rules - Pipeline Step 5
-- Calls automap plugin to apply transformation rules to tilemap
-- Inputs: rulesMap, inputMap, outputMap
-- Outputs: outputMap (success), error (failure)

local rulesMap = inputs[1]
if rulesMap == nil or rulesMap == "" then
	rulesMap = "plugins/automap/testdata/new_rules/rules.json"
end
local inputMap = inputs[2]
if inputMap == nil or inputMap == "" then
	inputMap = "plugins/automap/testdata/new_rules/input.json"
end
local outputMap = inputs[3]
if outputMap == nil or outputMap == "" then
	outputMap = "automap_result.tilemap.json"
end

local payload = {
	rulesMap = rulesMap,
	inputMap = inputMap,
	outputMap = outputMap,
}

local resultText = host.call("automap/automap::automap", payload)
local ok, response = pcall(json.decode, resultText)
if not ok then
	outputs[1] = ""
	outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
	return
end

if response.success then
	outputs[1] = response.outputMap or outputMap
	outputs[2] = ""
else
	outputs[1] = ""
	outputs[2] = response.error or "Unknown error"
end
