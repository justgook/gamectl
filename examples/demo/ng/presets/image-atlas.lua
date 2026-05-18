local imagesJson = inputs[1]
if imagesJson == nil or imagesJson == "" then imagesJson = "[]" end

local okRects, images = pcall(json.decode, imagesJson)
if not okRects or type(images) ~= "table" then
    outputs[1] = ""
    outputs[2] = "Invalid images array JSON"
    return
end

local function decodeResult(text, label)
    local ok, response = pcall(json.decode, text)
    if not ok or type(response) ~= "table" then
        return nil, "Failed to parse " .. label .. " response: " .. tostring(text):sub(1, 100)
    end
    if response.err ~= nil then
        return nil, tostring(response.err)
    end
    return response.ok, nil
end

local function callImage(method, ...)
    return decodeResult(host.call("image/image::" .. string.gsub(method, "_", "-"), ...), "image." .. method)
end

local function imageResource(image)
    local resource = image.resource or image.image
    if resource == nil and image["$resource"] ~= nil then resource = image end
    return resource
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

local atlas, createError = callImage("create", atlasWidth, atlasHeight, { r = 0, g = 0, b = 0, a = 0 })
if atlas == nil then
    outputs[1] = ""
    outputs[2] = createError or "Failed to create atlas image"
    return
end

for _, image in ipairs(images) do
    local src = imageResource(image)
    if type(src) ~= "table" then
        outputs[1] = ""
        outputs[2] = "Image is missing resource"
        return
    end

    local blitted, blitError = callImage("blit", atlas, src, {
        x = math.floor(tonumber(image.x) or 0),
        y = math.floor(tonumber(image.y) or 0),
    })
    if blitted == nil then
        outputs[1] = ""
        outputs[2] = blitError or "image.blit failed"
        return
    end
    atlas = blitted
end

outputs[1] = json.encode({
    image = atlas,
    resource = atlas,
    width = atlasWidth,
    height = atlasHeight,
})
outputs[2] = ""
