local path = inputs[1]
if path == nil or path == "" then
	outputs[1] = ""
	outputs[2] = "path is required"
	return
end

local function decodeResult(text, label)
	local ok, response = pcall(json.decode, text)
	if not ok or type(response) ~= "table" then
		return nil, "Failed to parse " .. label .. " response: " .. tostring(text):sub(1, 100)
	end
	if response.err ~= nil then
		return nil, tostring(response.err)
	end
	return response.ok, nil
end

local openedText = host.call("image/image::open", path)
local image, openErr = decodeResult(openedText, "image.open")
if image == nil then
	outputs[1] = ""
	outputs[2] = openErr or "image.open failed"
	return
end

local infoText = host.call("image/image::info", image)
local info, infoErr = decodeResult(infoText, "image.info")
if info == nil then
	outputs[1] = ""
	outputs[2] = infoErr or "image.info failed"
	return
end

outputs[1] = json.encode({
	image = image,
	resource = image,
	width = info.width,
	height = info.height,
	path = path,
})
outputs[2] = ""
