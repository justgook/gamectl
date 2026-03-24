local itemsJson = inputs[1]
if itemsJson == nil or itemsJson == "" then itemsJson = "[]" end

local fieldsInput = inputs[2]
if fieldsInput == nil then fieldsInput = "" end

local okItems, items = pcall(json.decode, itemsJson)
if not okItems or type(items) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Invalid items JSON"
    return
end

local fields = {}
if type(fieldsInput) == "string" and fieldsInput ~= "" then
    local okFields, decodedFields = pcall(json.decode, fieldsInput)
    if okFields and type(decodedFields) == "table" then
        for _, field in ipairs(decodedFields) do
            if field ~= nil and field ~= "" then
                fields[#fields + 1] = tostring(field)
            end
        end
    else
        for field in fieldsInput:gmatch("[^,%s]+") do
            fields[#fields + 1] = field
        end
    end
end

local picked = {}
for index, item in ipairs(items) do
    if type(item) ~= "table" then
        outputs[1] = ""
        outputs[2] = "Item " .. tostring(index) .. " must be an object"
        return
    end

    if #fields == 0 then
        local copy = {}
        for key, value in pairs(item) do
            copy[key] = value
        end
        picked[#picked + 1] = copy
    else
        local copy = {}
        for _, field in ipairs(fields) do
            if item[field] ~= nil then
                copy[field] = item[field]
            end
        end
        picked[#picked + 1] = copy
    end
end

outputs[1] = json.encode(picked)
outputs[2] = ""
