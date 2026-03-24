local leftJson = inputs[1]
if leftJson == nil or leftJson == "" then leftJson = "[]" end

local rightJson = inputs[2]
if rightJson == nil or rightJson == "" then rightJson = "[]" end

local okLeft, leftItems = pcall(json.decode, leftJson)
if not okLeft or type(leftItems) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Invalid left JSON"
    return
end

local okRight, rightItems = pcall(json.decode, rightJson)
if not okRight or type(rightItems) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Invalid right JSON"
    return
end

local count = math.max(#leftItems, #rightItems)
local items = {}

for index = 1, count do
    local leftItem = leftItems[index]
    local rightItem = rightItems[index]

    if leftItem ~= nil and type(leftItem) ~= "table" then
        outputs[1] = ""
        outputs[2] = "Left item " .. tostring(index) .. " must be an object"
        return
    end

    if rightItem ~= nil and type(rightItem) ~= "table" then
        outputs[1] = ""
        outputs[2] = "Right item " .. tostring(index) .. " must be an object"
        return
    end

    local merged = {}
    if type(leftItem) == "table" then
        for key, value in pairs(leftItem) do
            merged[key] = value
        end
    end
    if type(rightItem) == "table" then
        for key, value in pairs(rightItem) do
            merged[key] = value
        end
    end

    items[#items + 1] = merged
end

outputs[1] = json.encode(items)
outputs[2] = ""
