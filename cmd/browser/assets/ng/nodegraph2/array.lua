local result = {}
for _, value in ipairs(inputs) do
    if value ~= nil and value ~= "" then
        result[#result + 1] = value
    end
end

outputs[1] = json.encode(result)
