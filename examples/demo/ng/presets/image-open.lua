local path = inputs[1]
local resultText = host.call("image/image::open", { path = path })
local ok, _ = pcall(json.decode, resultText)
if not ok then
	outputs[1] = ""
	outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
	return
end

outputs[1] = resultText
