local image = inputs[1]
if image == nil or image == "" then
    error("image is required")
end
if type(image) ~= "table" then
    error("image resource must be a table")
end

local resource = image.resource or image.image
if resource == nil and image["$resource"] ~= nil then resource = image end
if type(resource) ~= "table" then
    error("image resource is required")
end

local path = inputs[2]
if path == nil or path == "" then
    error("path is required")
end

local format = inputs[3]
if format == nil or format == "" then format = "qoi" end

host.call("image/image::save", resource, path, format)

outputs[1] = path
