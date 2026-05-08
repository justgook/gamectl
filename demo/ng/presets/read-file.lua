local path = inputs[1]
if path == nil or path == "" then
    outputs[1] = ""
    outputs[2] = "path is required"
    return
end

local content = host.awaitCall("fs", "read", path)
outputs[1] = content
outputs[2] = ""
