local schema = inputs[1]
local slots = inputs[2]
local path_bin = inputs[3]
local path_decoder = inputs[4]

local function ensureParentDirs(path)
	local dir = string.match(path, "^(.*)/[^/]*$")
	if dir == nil or dir == "" then
		return
	end
	local current = ""
	for part in string.gmatch(dir, "[^/]+") do
		if current == "" then
			current = part
		else
			current = current .. "/" .. part
		end
		pcall(host.call, "fs/fs::create-dir", current)
	end
end

local odin_code = host.call("respack/respack::generate-odin", schema)
ensureParentDirs(path_decoder)
host.call("fs/fs::write-text", path_decoder, odin_code)

local slots_json = nil
if type(slots) == "string" then
	slots_json = slots
else
	slots_json = json.encode(slots)
end
host.call("ui.toast.warning", slots_json)

local byte_data = host.call("respack/respack::build", schema, slots_json)
ensureParentDirs(path_bin)
host.call("fs/fs::write-file", path_bin, byte_data)
