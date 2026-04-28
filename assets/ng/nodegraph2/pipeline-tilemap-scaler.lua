-- Tilemap Scaler
-- Calls scaler plugin to scale a tilemap by an integer factor.
-- Inputs: inputMapId, outputMapId, scaleFactor
-- Outputs: outputMapId (success), error (failure)

local inputMapId = inputs[1]
if inputMapId == nil or inputMapId == "" then inputMapId = "new_map" end

local outputMapId = inputs[2]
if outputMapId == nil or outputMapId == "" then outputMapId = "scaled_map" end

local scaleFactor = inputs[3]
if scaleFactor == nil or scaleFactor == "" then scaleFactor = "2" end

local payload = {
    inputMapId = inputMapId,
    outputMapId = outputMapId,
    scaleFactor = tonumber(scaleFactor) or 2,
}

local resultText = host.awaitCall("scaler", "scale", json.encode(payload))
local ok, response = pcall(json.decode, resultText)
if not ok then
    outputs[1] = ""
    outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
    return
end

if response.success then
    outputs[1] = outputMapId
    outputs[2] = ""
else
    outputs[1] = ""
    outputs[2] = response.error or "Unknown error"
end
