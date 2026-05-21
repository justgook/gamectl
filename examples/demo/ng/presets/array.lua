local result = {}
for index, value in ipairs(inputs) do
	if value == nil then
		error("value '" .. index .. "' is nil")
	end
	result[index] = value
end

outputs[1] = result
