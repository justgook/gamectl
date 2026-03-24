local arrays = {}
local count = 0

for inputIndex, inputValue in ipairs(inputs) do
    if inputValue ~= nil and inputValue ~= "" then
        local ok, decoded = pcall(json.decode, inputValue)
        if not ok or type(decoded) ~= "table" then
            outputs[1] = ""
            outputs[2] = "Input " .. tostring(inputIndex) .. " must be a JSON array"
            return
        end

        arrays[#arrays + 1] = {
            inputIndex = inputIndex,
            items = decoded,
        }
        if #decoded > count then
            count = #decoded
        end
    end
end

local items = {}

for index = 1, count do
    local merged = {}

    for _, arrayInfo in ipairs(arrays) do
        local item = arrayInfo.items[index]
        if item ~= nil then
            if type(item) ~= "table" then
                outputs[1] = ""
                outputs[2] = "Input " .. tostring(arrayInfo.inputIndex) .. " item " .. tostring(index) .. " must be an object"
                return
            end

            for key, value in pairs(item) do
                merged[key] = value
            end
        end
    end

    items[#items + 1] = merged
end

outputs[1] = json.encode(items)
outputs[2] = ""
