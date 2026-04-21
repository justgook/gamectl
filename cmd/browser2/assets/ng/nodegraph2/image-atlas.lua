local imagesJson = inputs[1]
if imagesJson == nil or imagesJson == "" then imagesJson = "[]" end

local okRects, images = pcall(json.decode, imagesJson)
if not okRects or type(images) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Invalid images array JSON"
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
local imageCount = 0

for _, image in ipairs(images) do
    if type(image) ~= "table" then
        outputs[1] = ""
        outputs[2] = "Image item must be an object"
        return
    end

    local width = tonumber(image.width) or 0
    local height = tonumber(image.height) or 0
    if width <= 0 or height <= 0 then
        outputs[1] = ""
        outputs[2] = "Image width and height must be positive"
        return
    end

    local x = tonumber(image.x) or 0
    local y = tonumber(image.y) or 0
    if x + width > atlasWidth then atlasWidth = x + width end
    if y + height > atlasHeight then atlasHeight = y + height end
    imageCount = imageCount + 1
end

if imageCount == 0 then
    outputs[1] = ""
    outputs[2] = "No images to build atlas from"
    return
end

local created, createError = callImage("create", { width = atlasWidth, height = atlasHeight })
if created == nil or created.handle == nil then
    outputs[1] = ""
    outputs[2] = createError or "Failed to create atlas image handle"
    return
end

local atlasHandle = created.handle

for _, image in ipairs(images) do
    local srcHandle = tonumber(image.handle)
    if srcHandle == nil or srcHandle == 0 then
        closeHandle(atlasHandle)
        outputs[1] = ""
        outputs[2] = "Image is missing handle"
        return
    end

    local blitted, blitError = callImage("blit", {
        dst = atlasHandle,
        src = srcHandle,
        x = tonumber(image.x) or 0,
        y = tonumber(image.y) or 0,
    })
    if blitted == nil then
        closeHandle(atlasHandle)
        outputs[1] = ""
        outputs[2] = blitError
        return
    end

    local nextAtlasHandle = blitted.handle or atlasHandle
    if nextAtlasHandle ~= atlasHandle then
        closeHandle(atlasHandle)
        atlasHandle = nextAtlasHandle
    end
end

outputs[1] = json.encode({
    handle = atlasHandle,
    width = atlasWidth,
    height = atlasHeight,
})
outputs[2] = ""
