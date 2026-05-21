local result = {}
for index, value in ipairs(inputs) do
	if value ~= nil then
		result[#result + 1] = value
	end
end

outputs[1] = result
