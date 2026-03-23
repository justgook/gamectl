local src = inputs[1]
if src == nil or src == "" then
    outputs[1] = ""
    outputs[2] = "src is required"
    return
end

local id = inputs[2]

local resultText = host.awaitCall("image", "info", json.encode({ path = src }))
local ok, response = pcall(json.decode, resultText)
if not ok then
    outputs[1] = ""
    outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
    return
end

if not response.ok then
    outputs[1] = ""
    outputs[2] = response.message or response.code or "Image info failed"
    return
end

local rect = {
    id = tonumber(id) or 0,
    src = src,
    width = tonumber(response.width) or 0,
    height = tonumber(response.height) or 0,
}

outputs[1] = json.encode(rect)
outputs[2] = ""
