local result = {}
for index, value in ipairs(inputs) do
    if value ~= nil and value ~= "" then
        local ok, decoded = pcall(json.decode, value)
        if not ok then
            error("Input " .. tostring(index) .. " must be valid JSON")
        end
        result[#result + 1] = decoded
    end
end

outputs[1] = json.encode(result)
