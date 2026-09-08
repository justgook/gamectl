local path = inputs[1]
if type(path) ~= "string" or path == "" then
	error("Read Text requires a non-empty project-relative path")
end
outputs[1] = host.call("fs/fs::read-text", path)
if type(outputs[1]) ~= "string" then
	error("fs/fs::read-text returned a non-string for " .. path)
end
