local rectsJson = inputs[1]
if rectsJson == nil or rectsJson == "" then rectsJson = "[]" end

local width = inputs[2]
if width == nil or width == "" then width = "1" end

local height = inputs[3]
if height == nil or height == "" then height = "1" end

local padding = inputs[4]
if padding == nil or padding == "" then padding = "0" end

local autoSize = inputs[5]
if autoSize == nil or autoSize == "" then autoSize = "true" end

local okRects, rects = pcall(json.decode, rectsJson)
if not okRects or type(rects) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Invalid rects array JSON"
    return
end

local autoSizeBool = autoSize == true or autoSize == "true" or autoSize == "1" or autoSize == 1
local requestRects = {}

for index, rect in ipairs(rects) do
    if type(rect) ~= "table" then
        outputs[1] = ""
        outputs[2] = "Rect item must be an object"
        return
    end

    local rectId = tonumber(rect.id) or index
    local rectWidth = tonumber(rect.width) or 0
    local rectHeight = tonumber(rect.height) or 0
    if rectWidth <= 0 or rectHeight <= 0 then
        outputs[1] = ""
        outputs[2] = "Rect width and height must be positive"
        return
    end

    requestRects[#requestRects + 1] = {
        id = rectId,
        width = rectWidth,
        height = rectHeight,
    }
    rect.id = rectId
end

local request = {
    width = tonumber(width) or 1,
    height = tonumber(height) or 1,
    padding = tonumber(padding) or 0,
    autoSize = autoSizeBool,
    rects = requestRects,
}

local resultText = host.awaitCall("pack", "pack", json.encode(request))
local okResult, response = pcall(json.decode, resultText)
if not okResult then
    outputs[1] = ""
    outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
    return
end

if response.code ~= nil then
    outputs[1] = ""
    outputs[2] = response.message or response.code or "Pack failed"
    return
end

local packedById = {}
for _, packedRect in ipairs(response.rects or {}) do
    packedById[tonumber(packedRect.id) or 0] = packedRect
end

for _, rect in ipairs(rects) do
    local packedRect = packedById[tonumber(rect.id) or 0]
    if packedRect ~= nil then
        rect.x = tonumber(packedRect.x) or 0
        rect.y = tonumber(packedRect.y) or 0
        rect.packed = packedRect.packed == true
    else
        rect.x = 0
        rect.y = 0
        rect.packed = false
    end
end

outputs[1] = json.encode(rects)
outputs[2] = ""
