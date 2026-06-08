local path = inputs[1]
if path == nil or path == "" then
	outputs[1] = nil
	outputs[2] = "path is required"
	return
end

local content = host.call("fs/fs::read-text", path)
outputs[1] = json.decode(content)
outputs[2] = ""
