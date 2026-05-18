local okImage, image = pcall(json.decode, inputs[1] or "")
if not okImage or type(image) ~= "table" then
	outputs[1] = ""
	return
end

local resource = image.resource or image.image
if resource == nil and image["$resource"] ~= nil then resource = image end
if type(resource) ~= "table" then
	outputs[1] = ""
	return
end

local id = tostring(resource.id or "image")
id = string.gsub(id, "[^%w%-_]", "_")
local path = "tmp/" .. id .. ".qoi"

local okSave, saveResponse = pcall(json.decode, host.call("image/image::save", resource, path, "qoi"))
if not okSave or type(saveResponse) ~= "table" or saveResponse.err ~= nil then
	outputs[1] = ""
	return
end

outputs[1] = json.encode({ _file = path })
