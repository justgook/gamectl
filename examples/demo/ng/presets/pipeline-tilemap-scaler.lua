-- Tilemap Scaler
-- Reads a tilemap, calls the pure scaler component, and writes the scaled tilemap.
-- Inputs: inputMap, outputMap, scaleFactor
-- Outputs: outputMap (success), error (failure)

local inputMap = inputs[1]
if inputMap == nil or inputMap == "" then inputMap = "/minimap.map.json" end

local outputMap = inputs[2]
if outputMap == nil or outputMap == "" then outputMap = "/scaled.map.json" end

local scaleFactor = inputs[3]
if scaleFactor == nil or scaleFactor == "" then scaleFactor = "2" end

local function map_to_entries(props)
    local entries = {}
    if props == nil then return entries end
    for key, value in pairs(props) do
        entries[#entries + 1] = { key, value }
    end
    return entries
end

local function entries_to_map(entries)
    if entries == nil or #entries == 0 then return nil end
    local props = {}
    for _, entry in ipairs(entries) do
        props[entry[1]] = entry[2]
    end
    return props
end

local function tilemap_to_wit(tm)
    local layers = {}
    for i, layer in ipairs(tm.layers or {}) do
        layers[i] = {
            width = layer.width,
            data = layer.data or {},
            props = map_to_entries(layer.props),
        }
    end
    return {
        layers = layers,
        props = map_to_entries(tm.props),
    }
end

local function tilemap_from_wit(tm)
    local layers = {}
    for i, layer in ipairs(tm.layers or {}) do
        layers[i] = {
            width = layer.width,
            data = layer.data or {},
            props = entries_to_map(layer.props),
        }
    end
    return {
        layers = layers,
        props = entries_to_map(tm.props),
    }
end

local okRead, inputText = pcall(fs.read_text, inputMap)
if not okRead then
    outputs[1] = ""
    outputs[2] = "Failed to read input map: " .. tostring(inputText)
    return
end

local okDecode, inputTilemap = pcall(json.decode, inputText)
if not okDecode then
    outputs[1] = ""
    outputs[2] = "Failed to parse input map JSON: " .. tostring(inputTilemap)
    return
end

local normalizedScaleFactor = tonumber(scaleFactor) or 2
local okScaleInputEncode, scaleSrcJson = pcall(json.encode, tilemap_to_wit(inputTilemap))
if not okScaleInputEncode then
    outputs[1] = ""
    outputs[2] = "Failed to encode scaler input: " .. tostring(scaleSrcJson)
    return
end

local scaleArgsJson = "[" .. scaleSrcJson .. ",{\"scale-factor\":" .. tostring(normalizedScaleFactor) .. ",\"door-sizes\":null}]"
local okScale, scaleResultText = pcall(host.raw_call, "scaler/scaler::scale", scaleArgsJson)
if not okScale then
    outputs[1] = ""
    outputs[2] = "Scaler failed: " .. tostring(scaleResultText)
    return
end

local okScaleDecode, scaleResult = pcall(json.decode, scaleResultText)
if not okScaleDecode then
    outputs[1] = ""
    outputs[2] = "Failed to parse scaler response: " .. tostring(scaleResult)
    return
end
if scaleResult.err ~= nil then
    outputs[1] = ""
    outputs[2] = "Scaler failed: " .. tostring(scaleResult.err)
    return
end

local okEncode, outputText = pcall(json.encode, tilemap_from_wit(scaleResult.ok))
if not okEncode then
    outputs[1] = ""
    outputs[2] = "Failed to encode scaled map JSON: " .. tostring(outputText)
    return
end

local okWrite, writeError = pcall(host.call, "fs/fs::write-text", outputMap, outputText)
if not okWrite then
    outputs[1] = ""
    outputs[2] = "Failed to write output map: " .. tostring(writeError)
    return
end

outputs[1] = outputMap
outputs[2] = ""
