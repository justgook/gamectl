local src = inputs[1]
local content = inputs[2]
if src == nil or src == "" then
	outputs[1] = ""
	outputs[2] = "path is required"
	return
end

if type(content) ~= "string" then
	content = json.encode(content)
end

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
ensureParentDirs(src)

host.call("fs/fs::write-text", src, content)
outputs[1] = src
