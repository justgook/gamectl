local schemaJson = inputs[1]
if schemaJson == nil or schemaJson == "" then
    outputs[1] = ""
    outputs[2] = "schema is required"
    return
end

local outputFile = inputs[2]
if outputFile == nil or outputFile == "" then
    outputs[1] = ""
    outputs[2] = "outputFile is required"
    return
end

local slotsJson = inputs[3]
if slotsJson == nil or slotsJson == "" then slotsJson = "[]" end

local okSlots, slots = pcall(json.decode, slotsJson)
if not okSlots or type(slots) ~= "table" then
    outputs[1] = ""
    outputs[2] = "slots must be a JSON array"
    return
end

local function callRespack(method, payload)
    local ok, result = pcall(host.awaitCall, "respack", method, payload)
    if not ok then
        return false, tostring(result)
    end

    local text = tostring(result or "")
    return true, text
end

local okInit, initText = callRespack("init", schemaJson)
if not okInit then
    outputs[1] = ""
    outputs[2] = initText ~= "" and initText or "respack.init failed"
    return
end

for slotIndex, payload in ipairs(slots) do
    local writePayload = json.encode({
        slot = slotIndex - 1,
        payload = payload,
    })
    local okWrite, writeText = callRespack("write", writePayload)
    if not okWrite then
        outputs[1] = ""
        outputs[2] = writeText ~= "" and writeText or ("respack.write failed for slot " .. tostring(slotIndex - 1))
        return
    end
end

local okDump, dumpText = callRespack("dump_to_file", outputFile)
if not okDump then
    outputs[1] = ""
    outputs[2] = dumpText ~= "" and dumpText or "respack.dump_to_file failed"
    return
end

outputs[1] = outputFile
outputs[2] = ""
