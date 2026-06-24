-- Combine horizontal PNG sprite sheets into one .aseprite file.
-- Intended to be run by script/combine-spritesheets-to-aseprite.sh via Aseprite CLI.

local function fail(message)
  error("combine-spritesheets-to-aseprite: " .. message, 0)
end

local manifestPath = app.params["manifest"] or fail("missing --script-param manifest=...")
local outputPath = app.params["output"] or fail("missing --script-param output=...")
local frameWidth = tonumber(app.params["frame_width"] or "") or fail("missing/invalid --script-param frame_width=...")
local frameHeightParam = app.params["frame_height"]
local frameHeight = frameHeightParam and tonumber(frameHeightParam) or nil
local duration = tonumber(app.params["duration"] or "0.1") or fail("invalid --script-param duration=...")

if frameWidth <= 0 then fail("frame width must be positive") end
if frameHeight ~= nil and frameHeight <= 0 then fail("frame height must be positive") end
if duration <= 0 then fail("duration must be positive") end

local rows = {}
for line in io.lines(manifestPath) do
  if line ~= "" then
    local tab = string.find(line, "\t", 1, true)
    if not tab then fail("bad manifest line: " .. line) end
    local path = string.sub(line, 1, tab - 1)
    local tagName = string.sub(line, tab + 1)
    table.insert(rows, { path = path, tagName = tagName })
  end
end
if #rows == 0 then fail("manifest has no input files") end

local maxHeight = frameHeight or 0
local totalFrames = 0
for _, row in ipairs(rows) do
  local image = Image{ fromFile = row.path }
  if image.width % frameWidth ~= 0 then
    fail(row.path .. " width " .. image.width .. " is not divisible by frame width " .. frameWidth)
  end
  if frameHeight ~= nil and image.height < frameHeight then
    fail(row.path .. " height " .. image.height .. " is smaller than frame height " .. frameHeight)
  end
  row.image = image
  row.frames = math.floor(image.width / frameWidth)
  row.height = frameHeight or image.height
  if row.frames < 1 then fail(row.path .. " contains no frames") end
  if row.height > maxHeight then maxHeight = row.height end
  totalFrames = totalFrames + row.frames
end

local out = Sprite(frameWidth, maxHeight, ColorMode.RGB)
out.filename = outputPath
out.gridBounds = Rectangle(0, 0, frameWidth, maxHeight)
local layer = out.layers[1]
layer.name = "sprites"

while #out.frames < totalFrames do
  out:newEmptyFrame(#out.frames + 1)
end

local frameNo = 1
for _, row in ipairs(rows) do
  local firstFrame = frameNo
  for i = 0, row.frames - 1 do
    local sourceRect = Rectangle(i * frameWidth, 0, frameWidth, row.height)
    local frameImage = Image(row.image, sourceRect)

    local existingCel = layer:cel(frameNo)
    if existingCel ~= nil then out:deleteCel(existingCel) end
    out:newCel(layer, frameNo, frameImage, Point(0, 0))
    out.frames[frameNo].duration = duration
    frameNo = frameNo + 1
  end

  local tag = out:newTag(firstFrame, frameNo - 1)
  tag.name = row.tagName
  tag.aniDir = AniDir.FORWARD
end

out:saveAs(outputPath)
print("Wrote " .. outputPath .. " with " .. totalFrames .. " frames and " .. #rows .. " tags")
app.exit()
