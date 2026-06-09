local schema = inputs[1]
local slots = inputs[2]
local path_bin = inputs[3]
local path_decoder = inputs[4]

local odin_code = host.call("respack/respack::generate-odin", schema)
host.call("fs/fs::write-text", path_decoder, odin_code)

local slots_json = nil
if type(slots) == "string" then
	slots_json = slots
else
	slots_json = json.encode(slots)
end
host.call("ui.toast.warning", slots_json)

local byte_data = host.call("respack/respack::build", schema, slots_json)
host.call("fs/fs::write-file", path_bin, byte_data)
