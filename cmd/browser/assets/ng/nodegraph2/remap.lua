local itemsJson = inputs[1]
if itemsJson == nil or itemsJson == "" then itemsJson = "[]" end

local fieldsInput = inputs[2]
if fieldsInput == nil then fieldsInput = "" end

local srcMin = tonumber(inputs[3]) or 0
local srcMax = tonumber(inputs[4]) or 1
local dstMin = tonumber(inputs[5]) or 0
local dstMax = tonumber(inputs[6]) or 1

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

if #fields == 0 then
    outputs[1] = ""
    outputs[2] = "fields are required"
    return
end

if srcMax == srcMin then
    outputs[1] = ""
    outputs[2] = "srcMax must differ from srcMin"
    return
end

local scale = (dstMax - dstMin) / (srcMax - srcMin)
local remapped = {}

for index, item in ipairs(items) do
    if type(item) ~= "table" then
        outputs[1] = ""
        outputs[2] = "Item " .. tostring(index) .. " must be an object"
        return
    end

    local copy = {}
    for key, value in pairs(item) do
        copy[key] = value
    end

    for _, field in ipairs(fields) do
        local value = tonumber(copy[field])
        if value == nil then
            outputs[1] = ""
            outputs[2] = "Item " .. tostring(index) .. " field '" .. field .. "' must be numeric"
            return
        end
        copy[field] = dstMin + (value - srcMin) * scale
    end

    remapped[#remapped + 1] = copy
end

outputs[1] = json.encode(remapped)
outputs[2] = ""
