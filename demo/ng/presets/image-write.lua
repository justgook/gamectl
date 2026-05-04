local imageJson = inputs[1]
if imageJson == nil or imageJson == "" then
    outputs[1] = ""
    outputs[2] = "image is required"
    return
end

local okImage, image = pcall(json.decode, imageJson)
if not okImage or type(image) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Invalid image JSON"
    return
end

local handle = tonumber(image.handle)
if handle == nil or handle == 0 then
    outputs[1] = ""
    outputs[2] = "image.handle is required"
    return
end

local path = inputs[2]
if path == nil or path == "" then
    outputs[1] = ""
    outputs[2] = "path is required"
    return
end

local format = inputs[3]
if format == nil then format = "" end

local function callImage(method, payload)
    local resultText = host.awaitCall("image", method, json.encode(payload))
    local ok, response = pcall(json.decode, resultText)
    if not ok then
        return nil, "Failed to parse image." .. method .. " response: " .. (resultText:sub(1, 100))
    end
    if not response.ok then
        return nil, response.message or response.code or ("image." .. method .. " failed")
    end
    return response, nil
end

local encoded, encodeError = callImage("encode", {
    src = handle,
    path = path,
    format = format,
})
if encoded == nil then
    outputs[1] = ""
    outputs[2] = encodeError or "Failed to write image"
    return
end

outputs[1] = encoded.path or path
outputs[2] = ""
