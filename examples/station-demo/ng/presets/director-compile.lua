local source = inputs[1]
if type(source) ~= "string" then
	error("Director Compile source must be a string")
end

local ir_json = host.call("director-compiler/director-compiler::compile", source)
local ir = json.decode(ir_json)
if type(ir) ~= "table" or type(ir.symbols) ~= "table" then
	error("Director compiler result must contain symbol metadata")
end
local symbols = ir.symbols
ir.symbols = nil
-- The implemented runtime has five pools. Compiler placeholder pools for future
-- path IR are intentionally not packed by this showcase schema.
ir.value_paths = nil
ir.path_steps = nil
outputs[1] = ir
outputs[2] = symbols
