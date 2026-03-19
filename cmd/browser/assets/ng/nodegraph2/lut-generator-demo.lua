-- LUT Generator Demo: query tilemap, encode tile IDs as RGBA8 LUT image.
-- Requires ng runtime helpers: csv.parse, json.decode.
-- Uses image plugin to create and write pixel data.

local sql = "SELECT name, data FROM tilemap_storage ORDER BY name LIMIT 1"
local csvText = host.awaitCall("sql", "query", sql)
local rows = csv.parse(csvText, { headers = true })

if #rows == 0 then
  outputs[1] = json.encode({ error = "No tilemaps found" })
  return
end

local tilemapJson = json.decode(rows[1].data or "{}")
local layers = tilemapJson.layers or {}
if #layers == 0 then
  outputs[1] = json.encode({ error = "Tilemap has no layers" })
  return
end

local layer = layers[1]
local width = layer.width or 0
local height = math.floor(#layer.data / width)
if width == 0 or height == 0 then
  outputs[1] = json.encode({ error = "Invalid layer dimensions" })
  return
end

local bytes = {}
for i = 1, #layer.data do
  local tileId = layer.data[i]
  local offset = (i - 1) * 4
  bytes[offset + 1] = tileId & 0xFF
  bytes[offset + 2] = (tileId >> 8) & 0xFF
  bytes[offset + 3] = (tileId >> 16) & 0xFF
  bytes[offset + 4] = 255
end

local chunkSize = 8192
local pixelString = ""
for i = 1, #bytes, chunkSize do
  local chunk = {}
  local endIdx = math.min(i + chunkSize - 1, #bytes)
  for j = i, endIdx do
    chunk[#chunk + 1] = bytes[j]
  end
  pixelString = pixelString .. string.char(table.unpack(chunk))
end

local base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local base64 = ""
for i = 1, #pixelString, 3 do
  local a, b, c = string.byte(pixelString, i, i + 2)
  local n = (a or 0) * 0x10000 + (b or 0) * 0x100 + (c or 0)
  base64 = base64 .. string.sub(base64chars, ((n >> 18) & 0x3F) + 1, ((n >> 18) & 0x3F) + 1)
               .. string.sub(base64chars, ((n >> 12) & 0x3F) + 1, ((n >> 12) & 0x3F) + 1)
               .. string.sub(base64chars, ((n >> 6) & 0x3F) + 1, ((n >> 6) & 0x3F) + 1)
               .. string.sub(base64chars, (n & 0x3F) + 1, (n & 0x3F) + 1)
end

local padding = #pixelString % 3
if padding == 1 then
  base64 = string.sub(base64, 1, -3) .. "=="
elseif padding == 2 then
  base64 = string.sub(base64, 1, -2) .. "="
end

local createResult = host.awaitCall("image", "create", json.encode({
  width = width,
  height = height,
  fill = {0, 0, 0, 0},
}))
local createJson = json.decode(createResult)
if not createJson.ok or not createJson.handle then
  outputs[1] = json.encode({ error = "Failed to create image handle" })
  return
end

local handle = createJson.handle

local writeResult = host.awaitCall("image", "write_pixels", json.encode({
  src = handle,
  width = width,
  height = height,
  pixelFormat = "rgba8",
  encoding = "base64",
  data = base64,
}))
local writeJson = json.decode(writeResult)
if not writeJson.ok then
  outputs[1] = json.encode({ error = "Failed to write pixel data" })
  return
end

outputs[1] = json.encode({
  handle = tostring(handle),
  width = width,
  height = height,
  tileCount = #layer.data,
  tilemap = rows[1].name,
})
