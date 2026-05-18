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

local resource = image.resource or image.image
if resource == nil and image["$resource"] ~= nil then resource = image end
if type(resource) ~= "table" then
    outputs[1] = ""
    outputs[2] = "image resource is required"
    return
end

local path = inputs[2]
if path == nil or path == "" then
    outputs[1] = ""
    outputs[2] = "path is required"
    return
end

local format = inputs[3]
if format == nil or format == "" then format = "qoi" end

local resultText = host.call("image/image::save", resource, path, format)
local ok, response = pcall(json.decode, resultText)
if not ok or type(response) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Failed to parse image.save response: " .. tostring(resultText):sub(1, 100)
    return
end
if response.err ~= nil then
    outputs[1] = ""
    outputs[2] = tostring(response.err)
    return
end

outputs[1] = path
outputs[2] = ""
