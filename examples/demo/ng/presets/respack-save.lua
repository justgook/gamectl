local schema = inputs[1]
local slots = inputs[2]
local path_bin = inputs[3]
local path_decoder = inputs[4]

local odin_code = host.call("respack/respack::generate-odin", schema)
host.call("fs/fs::write-text", path_decoder, odin_code)
host.call("ui.toast.warning", json.encode(slots))

local byte_data = host.call("respack/respack::build", schema, json.encode(slots), {})
host.call("fs/fs::write-file", path_bin, byte_data)
