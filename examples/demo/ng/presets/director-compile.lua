local source = inputs[1]
if type(source) ~= "string" then
	error("Director Compile source must be a string")
end

local irJson = host.call("director-compiler/director-compiler::compile", source)
outputs[1] = json.decode(irJson)
