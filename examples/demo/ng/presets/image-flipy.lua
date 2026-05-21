local image = inputs[1]
if image == 0 then
	error("image input is required")
end

local transformed = host.call("image/image::transform", image, { "vertical" })

outputs[1] = transformed
