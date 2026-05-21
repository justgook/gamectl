local image = inputs[1]
if image == 0 then
	error("image input is required")
end

outputs[1] = host.call("image/image::info", image)
