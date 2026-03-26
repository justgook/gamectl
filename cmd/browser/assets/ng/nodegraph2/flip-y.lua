local resultText = host.awaitCall("image", "transform", '{"src":' .. inputs[1] .. ',"flip":2}')
local ok, response = pcall(json.decode, resultText)
if not ok then
	outputs[1] = ""
	outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
	return
end

outputs[1] = response.handle
