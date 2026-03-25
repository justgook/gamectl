local arrays = {}
local singles = {}
local count = 0

local function detect_root_kind(raw, defaultKind)
    if type(raw) ~= "string" then return defaultKind end
    local first = raw:match("^%s*(.)")
    if first == "[" then return "array" end
    if first == "{" then return "object" end
    return defaultKind
end

for inputIndex, inputValue in ipairs(inputs) do
    if inputValue ~= nil and inputValue ~= "" then
        local rootKind = detect_root_kind(inputValue, "array")
        local ok, decoded = pcall(json.decode, inputValue)
        if not ok or type(decoded) ~= "table" then
            outputs[1] = ""
            outputs[2] = "Input " .. tostring(inputIndex) .. " must be JSON"
            return
        end

        if rootKind == "object" then
            singles[#singles + 1] = {
                inputIndex = inputIndex,
                item = decoded,
            }
            if count < 1 then
                count = 1
            end
        else
            arrays[#arrays + 1] = {
                inputIndex = inputIndex,
                items = decoded,
            }
            if #decoded > count then
                count = #decoded
            end
        end
    end
end

if #arrays == 0 and #singles == 0 then
    outputs[1] = json.encode({})
    outputs[2] = ""
    return
end

if #arrays == 0 then
    local merged = {}
    for _, singleInfo in ipairs(singles) do
        if type(singleInfo.item) ~= "table" then
            outputs[1] = ""
            outputs[2] = "Input " .. tostring(singleInfo.inputIndex) .. " must be an object"
            return
        end

        for key, value in pairs(singleInfo.item) do
            merged[key] = value
        end
    end

    outputs[1] = json.encode(merged)
    outputs[2] = ""
    return
end

local items = {}

for index = 1, count do
    local merged = {}

    for _, singleInfo in ipairs(singles) do
        if type(singleInfo.item) ~= "table" then
            outputs[1] = ""
            outputs[2] = "Input " .. tostring(singleInfo.inputIndex) .. " must be an object"
            return
        end

        for key, value in pairs(singleInfo.item) do
            merged[key] = value
        end
    end

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
