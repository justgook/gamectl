-- Demo: initialize respack, write a payload, save the dump to disk,
-- and generate an Odin decoder.
local schema2 = host.awaitCall("fs", "read", "local:/assets/respack/game2.rspk.json")
local initResult = host.awaitCall("respack", "init", schema2)
local positions = {
  entity_ids = {33, 45},
  components = {
    {22, 11},
    {7, -3},
  },
}
local writePositionsResult = host.awaitCall("respack", "write", json.encode({ slot = 0, payload = positions }))

local function string_to_u8_array(value)
  local out = {}
  for i = 1, #value do
    out[i] = string.byte(value, i)
  end
  return out
end
local atlas = host.awaitCall("fs", "read", "local:/assets/game/the_atlas.qoi")
local atlas_bytes = string_to_u8_array(atlas)
local writeAtlasResult = host.awaitCall("respack", "write", json.encode({ slot = 1, payload = atlas_bytes }))

local uvs = {}
for i = 0, 32 * 32 - 1 do
  local x = i % 32
  local y = math.floor(i / 32)
  uvs[#uvs + 1] = {
    x * 16 / 512,
    y * 16 / 512,
    (x + 1) * 16 / 512,
    (y + 1) * 16 / 512,
  }
end
local writeUvsResult = host.awaitCall("respack", "write", json.encode({ slot = 2, payload = uvs }))

local dumpPath = "/the_data/game.rspk"
local saveResult = host.awaitCall("respack", "dump_to_file", dumpPath)
local odinSource = host.awaitCall("respack", "generate_odin", "main")

local function escape_string(str)
  str = str:gsub("\\", "\\\\")
  str = str:gsub('"', '\\"')
  str = str:gsub('\t', '\\t')
  str = str:gsub("\n", "\\n")
  return str
end

local odinOutFile = "/the_data/decoder.txt"
host.awaitCall("fs", "writeJson", '{"path": "' .. odinOutFile .. '", "content":"' .. escape_string(odinSource) .. '"}')

outputs[1] = odinSource
outputs[2] = json.encode({
  init = initResult,
  write_positions = writePositionsResult,
  write_atlas = writeAtlasResult,
  write_uvs = writeUvsResult,
  save = saveResult,
  dump_path = dumpPath,
  package = "main",
  slot = 0,
  schema = "JUST DATA",
  generated_bytes = #odinSource,
})
