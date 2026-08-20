-- Combine animation frame folders into one .aseprite file.
-- Intended to be run by script/combine-animation-folders-to-aseprite.sh via Aseprite CLI.

local function fail(message)
  error("combine-animation-folders-to-aseprite: " .. message, 0)
end

local manifestPath = app.params["manifest"] or fail("missing --script-param manifest=...")
local outputPath = app.params["output"] or fail("missing --script-param output=...")

local function splitManifestLine(line)
  local fields = {}
  local start = 1
  for _ = 1, 3 do
    local tab = string.find(line, "\t", start, true)
    if not tab then fail("bad manifest line: " .. line) end
    table.insert(fields, string.sub(line, start, tab - 1))
    start = tab + 1
  end
  table.insert(fields, string.sub(line, start))
  return fields
end

local animations = {}
for line in io.lines(manifestPath) do
  if line ~= "" then
    local fields = splitManifestLine(line)
    table.insert(animations, {
      name = fields[1],
      colorDir = fields[2],
      normalDir = fields[3],
      metadataPath = fields[4],
    })
  end
end
if #animations == 0 then fail("manifest has no animations") end

local function readFile(path)
  local file, openError = io.open(path, "rb")
  if not file then fail("cannot open " .. path .. ": " .. tostring(openError)) end
  local contents = file:read("*a")
  file:close()
  return contents
end

local function isJsonContainer(value)
  return type(value) == "table" or type(value) == "userdata"
end

local function decodeMetadata(animation)
  local ok, metadata = pcall(json.decode, readFile(animation.metadataPath))
  if not ok then fail("invalid JSON in " .. animation.metadataPath .. ": " .. tostring(metadata)) end
  if not isJsonContainer(metadata) then fail(animation.metadataPath .. " must contain a JSON object") end
  if not isJsonContainer(metadata.frames) or #metadata.frames == 0 then
    fail(animation.metadataPath .. " must contain a non-empty frames array")
  end
  return metadata
end

local function pngFileSet(dir)
  local files = {}
  for _, name in ipairs(app.fs.listFiles(dir)) do
    local path = app.fs.joinPath(dir, name)
    if app.fs.isFile(path) and string.lower(app.fs.fileExtension(name)) == "png" then
      files[name] = true
    end
  end
  return files
end

local function loadRgbImage(path)
  local sourceSprite = Sprite{ fromFile = path, oneFrame = true }
  if sourceSprite.colorMode ~= ColorMode.RGB then
    app.activeSprite = sourceSprite
    app.command.ChangePixelFormat{ format = "rgb" }
  end
  local image = Image(sourceSprite)
  sourceSprite:close()
  return image
end

local expectedWidth = nil
local expectedHeight = nil
local totalFrames = 0

for _, animation in ipairs(animations) do
  local metadata = decodeMetadata(animation)
  local colorPngs = pngFileSet(animation.colorDir)
  local normalPngs = pngFileSet(animation.normalDir)
  local listedFiles = {}
  animation.frames = {}

  for index, frame in ipairs(metadata.frames) do
    local label = animation.metadataPath .. " frames[" .. index .. "]"
    if not isJsonContainer(frame) then fail(label .. " must be an object") end
    if type(frame.file) ~= "string" or frame.file == "" then fail(label .. ".file must be a non-empty string") end
    if app.fs.fileName(frame.file) ~= frame.file or string.lower(app.fs.fileExtension(frame.file)) ~= "png" then
      fail(label .. ".file must be a PNG filename without a directory: " .. frame.file)
    end
    if listedFiles[frame.file] then fail(label .. ".file is duplicated: " .. frame.file) end
    if type(frame.duration_seconds) ~= "number" or frame.duration_seconds <= 0 then
      fail(label .. ".duration_seconds must be a positive number")
    end
    if not colorPngs[frame.file] then fail("missing color frame for " .. animation.name .. ": " .. frame.file) end
    if not normalPngs[frame.file] then fail("missing normal frame for " .. animation.name .. ": " .. frame.file) end

    listedFiles[frame.file] = true
    local colorPath = app.fs.joinPath(animation.colorDir, frame.file)
    local normalPath = app.fs.joinPath(animation.normalDir, frame.file)
    local colorImage = loadRgbImage(colorPath)
    local normalImage = loadRgbImage(normalPath)

    if colorImage.width ~= normalImage.width or colorImage.height ~= normalImage.height then
      fail(normalPath .. " dimensions " .. normalImage.width .. "x" .. normalImage.height ..
        " do not match color frame " .. colorImage.width .. "x" .. colorImage.height)
    end
    if expectedWidth == nil then
      expectedWidth = colorImage.width
      expectedHeight = colorImage.height
    elseif colorImage.width ~= expectedWidth or colorImage.height ~= expectedHeight then
      fail(colorPath .. " dimensions " .. colorImage.width .. "x" .. colorImage.height ..
        " do not match expected " .. expectedWidth .. "x" .. expectedHeight)
    end

    table.insert(animation.frames, {
      colorImage = colorImage,
      normalImage = normalImage,
      duration = frame.duration_seconds,
    })
  end

  for name, _ in pairs(colorPngs) do
    if not listedFiles[name] then fail("extra color PNG for " .. animation.name .. ": " .. name) end
  end
  for name, _ in pairs(normalPngs) do
    if not listedFiles[name] then fail("extra normal PNG for " .. animation.name .. ": " .. name) end
  end
  totalFrames = totalFrames + #animation.frames
end

local out = Sprite(expectedWidth, expectedHeight, ColorMode.RGB)
out.filename = outputPath
out.gridBounds = Rectangle(0, 0, expectedWidth, expectedHeight)

local normalLayer = out.layers[1]
normalLayer.name = "normal"
normalLayer.isVisible = true
local colorLayer = out:newLayer()
colorLayer.name = "color"
colorLayer.isVisible = true

while #out.frames < totalFrames do
  out:newEmptyFrame(#out.frames + 1)
end

local frameNo = 1
for _, animation in ipairs(animations) do
  local firstFrame = frameNo
  for _, frame in ipairs(animation.frames) do
    local normalCel = normalLayer:cel(frameNo)
    if normalCel ~= nil then out:deleteCel(normalCel) end
    local colorCel = colorLayer:cel(frameNo)
    if colorCel ~= nil then out:deleteCel(colorCel) end

    out:newCel(normalLayer, frameNo, frame.normalImage, Point(0, 0))
    out:newCel(colorLayer, frameNo, frame.colorImage, Point(0, 0))
    out.frames[frameNo].duration = frame.duration
    frameNo = frameNo + 1
  end

  local tag = out:newTag(firstFrame, frameNo - 1)
  tag.name = animation.name
  tag.aniDir = AniDir.FORWARD
end

out:saveAs(outputPath)
print("Wrote " .. outputPath .. " with " .. totalFrames .. " frames, " .. #animations .. " tags, and 2 layers")
app.exit()
