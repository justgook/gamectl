local imagesJson = inputs[1]
if imagesJson == nil or imagesJson == "" then imagesJson = "[]" end

local okImages, images = pcall(json.decode, imagesJson)
if not okImages or type(images) ~= "table" then
    outputs[1] = "0"
    outputs[2] = "Invalid images array JSON"
    return
end

local function callImage(method, payload)
    local resultText = host.call("image/image::" .. string.gsub(method, "_", "-"), payload)
    local ok, response = pcall(json.decode, resultText)
    if not ok then
        return nil, "Failed to parse image." .. method .. " response: " .. (resultText:sub(1, 100))
    end
    if not response.ok then
        return nil, response.message or response.code or ("image." .. method .. " failed")
    end
    return response, nil
end

local closed = 0
for index, image in ipairs(images) do
    local handle = nil
    if type(image) == "table" then
        handle = tonumber(image.handle)
    elseif type(image) == "number" or type(image) == "string" then
        handle = tonumber(image)
    end

    if handle == nil or handle == 0 then
        outputs[1] = tostring(closed)
        outputs[2] = "Image " .. tostring(index) .. " is missing handle"
        return
    end

    local response, closeError = callImage("close", { src = handle })
    if response == nil then
        outputs[1] = tostring(closed)
        outputs[2] = closeError or ("Failed to close image " .. tostring(index))
        return
    end

    closed = closed + (tonumber(response.closed) or 1)
end

outputs[1] = tostring(closed)
outputs[2] = ""
