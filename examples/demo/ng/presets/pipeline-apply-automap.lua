-- Apply Automap Rules - Pipeline Step 5
-- Reads rule/input tilemaps, calls the pure automap component, and writes output.
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

local function fail(message)
	outputs[1] = ""
	outputs[2] = message
end

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

local okRulesRead, rulesText = pcall(fs.read_text, rulesMap)
if not okRulesRead then
	fail("Failed to read rules map: " .. tostring(rulesText))
	return
end

local okInputRead, inputText = pcall(fs.read_text, inputMap)
if not okInputRead then
	fail("Failed to read input map: " .. tostring(inputText))
	return
end

local okRulesDecode, rulesTilemap = pcall(json.decode, rulesText)
if not okRulesDecode then
	fail("Failed to parse rules map JSON: " .. tostring(rulesTilemap))
	return
end

local okInputDecode, inputTilemap = pcall(json.decode, inputText)
if not okInputDecode then
	fail("Failed to parse input map JSON: " .. tostring(inputTilemap))
	return
end

local witRules = tilemap_to_wit(rulesTilemap)
local witInput = tilemap_to_wit(inputTilemap)
local witTarget = nil
if inputMap == outputMap then
	witTarget = witInput
end

local okRulesEncode, rulesJson = pcall(json.encode, witRules)
if not okRulesEncode then
	fail("Failed to encode automap rules input: " .. tostring(rulesJson))
	return
end

local okInputEncode, inputJson = pcall(json.encode, witInput)
if not okInputEncode then
	fail("Failed to encode automap tilemap input: " .. tostring(inputJson))
	return
end

local targetJson = "null"
if witTarget ~= nil then
	local okTargetEncode, encodedTarget = pcall(json.encode, witTarget)
	if not okTargetEncode then
		fail("Failed to encode automap target input: " .. tostring(encodedTarget))
		return
	end
	targetJson = encodedTarget
end

local automapArgsJson = "[" .. rulesJson .. "," .. inputJson .. "," .. targetJson .. "]"
local okAutomap, automapResultText = pcall(host.raw_call, "automap/automap::apply", automapArgsJson)
if not okAutomap then
	fail("Automap failed: " .. tostring(automapResultText))
	return
end

local okAutomapDecode, automapResult = pcall(json.decode, automapResultText)
if not okAutomapDecode then
	fail("Failed to parse automap response: " .. tostring(automapResult))
	return
end
if automapResult.err ~= nil then
	fail("Automap failed: " .. tostring(automapResult.err))
	return
end

local okOutputEncode, outputText = pcall(json.encode, tilemap_from_wit(automapResult.ok))
if not okOutputEncode then
	fail("Failed to encode automap output JSON: " .. tostring(outputText))
	return
end

local okWrite, writeError = pcall(host.call, "fs/fs::write-text", outputMap, outputText)
if not okWrite then
	fail("Failed to write output map: " .. tostring(writeError))
	return
end

outputs[1] = outputMap
outputs[2] = ""
