local itemsJson = inputs[1]
if itemsJson == nil or itemsJson == "" then itemsJson = "[]" end

local fieldsInput = inputs[2]
if fieldsInput == nil then fieldsInput = "" end

local function detect_root_kind(raw, defaultKind)
    if type(raw) ~= "string" then return defaultKind end
    local first = raw:match("^%s*(.)")
    if first == "[" then return "array" end
    if first == "{" then return "object" end
    return defaultKind
end

local function pick_fields(item, fields)
    local copy = {}
    if #fields == 0 then
        for key, value in pairs(item) do
            copy[key] = value
        end
        return copy
    end

    for _, field in ipairs(fields) do
        if item[field] ~= nil then
            copy[field] = item[field]
        end
    end
    return copy
end

local itemsRootKind = detect_root_kind(itemsJson, "array")

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

if itemsRootKind == "object" then
    outputs[1] = json.encode(pick_fields(items, fields))
    outputs[2] = ""
    return
end

local picked = {}
for index, item in ipairs(items) do
    if type(item) ~= "table" then
        outputs[1] = ""
        outputs[2] = "Item " .. tostring(index) .. " must be an object"
        return
    end

    picked[#picked + 1] = pick_fields(item, fields)
end

outputs[1] = json.encode(picked)
outputs[2] = ""
