-- Pack Demo: auto-size an atlas and inspect packed rectangles.

local request = {
  width = 4,
  height = 4,
  padding = 1,
  autoSize = true,
  rects = {
    { width = 3, height = 2 },
    { width = 2, height = 2 },
    { width = 2, height = 3 },
    { width = 1, height = 4 },
  },
}

local resultText = host.awaitCall("pack", "pack", json.encode(request))
local result = json.decode(resultText)

local packedIds = {}
for i = 1, #(result.rects or {}) do
  local rect = result.rects[i]
  if rect.packed then
    packedIds[#packedIds + 1] = rect.id
  end
end

outputs[1] = resultText
outputs[2] = json.encode({
  atlas = {
    width = result.width,
    height = result.height,
    padding = result.padding,
  },
  packedAll = result.packedAll,
  packedCount = result.packedCount,
  failedCount = result.failedCount,
  packedIds = packedIds,
})
