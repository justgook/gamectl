-- Demo: query tilemaps via SQL, parse CSV, decode tilemap JSON.
-- Requires ng runtime helpers: csv.parse, json.decode, json.encode.

local sql = "SELECT name, data FROM tilemap_storage ORDER BY name LIMIT 8"
local csvText = host.awaitCall("sql", "query", sql)
local rows = csv.parse(csvText, { headers = true })

local items = {}
for i, row in ipairs(rows) do
  local name = row.name or ("row_" .. i)
  local ok, tilemap = pcall(json.decode, row.data or "{}")
  if ok and type(tilemap) == "table" then
    local layers = tilemap.layers or {}
    items[#items + 1] = {
      name = name,
      layerCount = #layers,
      width = (layers[1] and layers[1].width) or 0,
      tileCount = (layers[1] and #(layers[1].data or {})) or 0,
    }
  else
    items[#items + 1] = {
      name = name,
      error = "invalid tilemap json",
    }
  end
end

outputs[1] = json.encode(items)
outputs[2] = json.encode({ count = #items })
