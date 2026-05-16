-- Tilemap Scaler
-- Calls scaler plugin to scale a tilemap by an integer factor.
-- Inputs: inputMap, outputMap, scaleFactor
-- Outputs: outputMap (success), error (failure)

local inputMap = inputs[1]
if inputMap == nil or inputMap == "" then inputMap = "/minimap.map.json" end

local outputMap = inputs[2]
if outputMap == nil or outputMap == "" then outputMap = "/scaled.map.json" end

local scaleFactor = inputs[3]
if scaleFactor == nil or scaleFactor == "" then scaleFactor = "2" end

local payload = {
    inputMap = inputMap,
    outputMap = outputMap,
    scaleFactor = tonumber(scaleFactor) or 2,
}

local resultText = host.call("scaler/scaler::scale", payload)
local ok, response = pcall(json.decode, resultText)
if not ok then
    outputs[1] = ""
    outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
    return
end

if response.success then
    outputs[1] = outputMap
    outputs[2] = ""
else
    outputs[1] = ""
    outputs[2] = response.error or "Unknown error"
end
