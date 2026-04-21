-- Apply Automap Rules - Pipeline Step 5
-- Calls automap plugin to apply transformation rules to tilemap
-- Inputs: rulesMapId, inputMapId, outputMapId
-- Outputs: outputMapId (success), error (failure)

local rulesMapId = inputs[1]
if rulesMapId == nil or rulesMapId == "" then
	rulesMapId = "rules"
end
local inputMapId = inputs[2]
if inputMapId == nil or inputMapId == "" then
	inputMapId = "new_map"
end
local outputMapId = inputs[3]
if outputMapId == nil or outputMapId == "" then
	outputMapId = "automap_result"
end

local payload = {
	rulesMapId = rulesMapId,
	inputMapId = inputMapId,
	outputMapId = outputMapId,
}

local resultText = host.awaitCall("automap", "automap", json.encode(payload))
local ok, response = pcall(json.decode, resultText)
if not ok then
	outputs[1] = ""
	outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
	return
end

if response.success then
	outputs[1] = response.outputMapId or outputMapId -- Return the output map ID
	outputs[2] = "" -- No error
else
	outputs[1] = "" -- No map ID on error
	outputs[2] = response.error or "Unknown error"
end

