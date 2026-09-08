local path = inputs[1]
if type(path) ~= "string" or path == "" then
	error("Ensure Directory requires a non-empty project-relative path")
end

local current = ""
for part in string.gmatch(path, "[^/]+") do
	current = current == "" and part or (current .. "/" .. part)
	local created, create_error = pcall(host.call, "fs/fs::create-dir", current)
	if not created then
		local stat_ok, stat = pcall(host.call, "fs/fs::stat", current)
		if not stat_ok or type(stat) ~= "table" or stat.type ~= "directory" then
			error("cannot create directory " .. current .. ": " .. tostring(create_error))
		end
	end
end
outputs[1] = inputs[2] ~= nil and inputs[2] or path
