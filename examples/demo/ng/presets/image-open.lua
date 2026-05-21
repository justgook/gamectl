local path = inputs[1]
if path == nil or path == "" then
	error("path is required")
end

outputs[1] = host.call("image/image::open", path)
