local packedRectsJson = inputs[1]
if packedRectsJson == nil or packedRectsJson == "" then packedRectsJson = "[]" end

local outputPath = inputs[2]
if outputPath == nil or outputPath == "" then
    outputs[1] = ""
    outputs[2] = "outputPath is required"
    return
end

local format = inputs[3]
if format == nil or format == "" then format = "qoi" end

local okRects, packedRects = pcall(json.decode, packedRectsJson)
if not okRects or type(packedRects) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Invalid packed rects JSON"
    return
end

local function callImage(method, payload)
    local resultText = host.awaitCall("image", method, json.encode(payload))
    local ok, response = pcall(json.decode, resultText)
    if not ok then
        return nil, "Failed to parse image." .. method .. " response: " .. (resultText:sub(1, 100))
    end
    if not response.ok then
        return nil, response.message or response.code or ("image." .. method .. " failed")
    end
    return response, nil
end

local function closeHandle(handle)
    if handle == nil or handle == 0 then return end
    callImage("close", { src = handle })
end

local atlasWidth = 0
local atlasHeight = 0
local packedCount = 0

for _, rect in ipairs(packedRects) do
    if type(rect) == "table" and rect.packed then
        local x = tonumber(rect.x) or 0
        local y = tonumber(rect.y) or 0
        local width = tonumber(rect.width) or 0
        local height = tonumber(rect.height) or 0
        if x + width > atlasWidth then atlasWidth = x + width end
        if y + height > atlasHeight then atlasHeight = y + height end
        packedCount = packedCount + 1
    end
end

if packedCount == 0 then
    outputs[1] = ""
    outputs[2] = "No packed rects to build atlas from"
    return
end

local created, createError = callImage("create", { width = atlasWidth, height = atlasHeight })
if created == nil then
    outputs[1] = ""
    outputs[2] = createError
    return
end

local atlasHandle = created.handle

for _, rect in ipairs(packedRects) do
    if type(rect) == "table" and rect.packed then
        local src = rect.src
        if src == nil or src == "" then
            closeHandle(atlasHandle)
            outputs[1] = ""
            outputs[2] = "Packed rect is missing src"
            return
        end

        local opened, openError = callImage("open", { path = src })
        if opened == nil then
            closeHandle(atlasHandle)
            outputs[1] = ""
            outputs[2] = openError
            return
        end

        local blitted, blitError = callImage("blit", {
            dst = atlasHandle,
            src = opened.handle,
            x = tonumber(rect.x) or 0,
            y = tonumber(rect.y) or 0,
        })
        closeHandle(opened.handle)

        if blitted == nil then
            closeHandle(atlasHandle)
            outputs[1] = ""
            outputs[2] = blitError
            return
        end

        local previousAtlasHandle = atlasHandle
        atlasHandle = blitted.handle
        closeHandle(previousAtlasHandle)
    end
end

local encoded, encodeError = callImage("encode", { src = atlasHandle, path = outputPath, format = format })
closeHandle(atlasHandle)

if encoded == nil then
    outputs[1] = ""
    outputs[2] = encodeError
    return
end

outputs[1] = encoded.path or outputPath
outputs[2] = ""
