local schemaJson = inputs[1]
if schemaJson == nil or schemaJson == "" then
	outputs[1] = ""
	outputs[2] = ""
	outputs[3] = "schema is required"
	return
end

local outputFile = inputs[2]
if outputFile == nil then
	outputFile = ""
end

local function safeAwait(service, method, payload)
	local ok, result = pcall(host.awaitCall, service, method, payload)
	if not ok then
		return false, tostring(result or "")
	end
	return true, tostring(result or "")
end

local okInit, initText = safeAwait("respack", "init", schemaJson)
if not okInit then
	outputs[1] = ""
	outputs[2] = ""
	outputs[3] = initText ~= "" and initText or "respack.init failed"
	return
end

local okGenerate, odinSource = safeAwait("respack", "generate_odin", "")
if not okGenerate then
	outputs[1] = ""
	outputs[2] = ""
	outputs[3] = odinSource ~= "" and odinSource or "respack.generate_odin failed"
	return
end

if outputFile ~= "" then
	local okWrite, writeText = safeAwait(
		"fs",
		"writeJson",
		json.encode({
			path = outputFile,
			content = odinSource,
		})
	)
	if not okWrite then
		outputs[1] = odinSource
		outputs[2] = ""
		outputs[3] = writeText ~= "" and writeText or "failed to write Odin source"
		return
	end
end

outputs[1] = odinSource
outputs[2] = outputFile
outputs[3] = ""
