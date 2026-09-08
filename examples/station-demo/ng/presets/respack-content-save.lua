local schema = inputs[1]
local ir = inputs[2]
local bindings = inputs[3]
local output_path = inputs[4]

if type(schema) ~= "string" or schema == "" then error("Respack Content Save requires schema JSON") end
if type(ir) ~= "table" then error("Respack Content Save requires Director IR") end
if type(bindings) ~= "table" then error("Respack Content Save requires bindings") end
if type(output_path) ~= "string" or output_path == "" then error("Respack Content Save requires output path") end

-- Decoder generation is deliberately absent: visitors only rebuild data for the
-- fixed decoder already compiled into station-demo.wasm.
local byte_count = host.call(
	"respack/respack::build-to-file",
	schema,
	json.encode({ir, bindings}),
	output_path
)
if type(byte_count) ~= "number" or byte_count <= 0 then
	error("respack returned an invalid byte count")
end
outputs[1] = byte_count
