local image = inputs[1]

local resource = image.resource or image.image
if resource == nil and image["$resource"] ~= nil then
	resource = image
end
if type(resource) ~= "table" then
	outputs[1] = ""
	return
end

local id = tostring(resource.id or "image")
id = string.gsub(id, "[^%w%-_]", "_")
local path = "tmp/" .. id .. ".qoi"

host.call("image/image::save", resource, path, "qoi")

outputs[1] = json.encode({ _file = path })
