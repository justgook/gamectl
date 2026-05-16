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

local function safeCall(target, ...)
	local ok, result = pcall(host.call, target, ...)
	if not ok then
		return false, tostring(result or "")
	end
	return true, tostring(result or "")
end

local function callRespack(method, payload)
	return safeCall("respack/respack::" .. string.gsub(method, "_", "-"), payload)
end

local function writeFile(path, content)
	return safeCall("fs/fs::write-text", path, content)
end

local okInit, initText = callRespack("init", schemaJson)
if not okInit then
	outputs[1] = ""
	outputs[2] = ""
	outputs[3] = initText ~= "" and initText or "respack.init failed"
	return
end

local okGenerate, odinSource = callRespack("generate_odin", "")
if not okGenerate then
	outputs[1] = ""
	outputs[2] = ""
	outputs[3] = odinSource ~= "" and odinSource or "respack.generate_odin failed"
	return
end

if outputFile ~= "" then
	local okWrite, writeText = writeFile(outputFile, odinSource)

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
