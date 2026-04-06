var automapDir = FileInfo.cleanPath(FileInfo.joinPaths(FileInfo.path(FileInfo.canonicalPath(__filename)), ".."))
var repoRoot = FileInfo.cleanPath(FileInfo.joinPaths(automapDir, "..", ".."))
var testdataDir = FileInfo.joinPaths(automapDir, "testdata")
var buildRoot = FileInfo.joinPaths(repoRoot, "build.nosync", "automap-fixtures")
var requestPath = FileInfo.joinPaths(buildRoot, "request.json")
var statusPath = FileInfo.joinPaths(buildRoot, "status.json")

var mapBoolProps = {
  rule_MatchOutsideMap: "MatchOutsideMap",
  rule_OverflowBorder: "OverflowBorder",
  rule_WrapBorder: "WrapBorder",
  rule_NoOverlappingOutput: "NoOverlappingOutput",
  rule_DeleteTiles: "DeleteTiles",
}

var layerBoolProps = {
  rule_layer_AutoEmpty: "AutoEmpty",
  rule_layer_IgnoreHorizontalFlip: "IgnoreHorizontalFlip",
  rule_layer_IgnoreVerticalFlip: "IgnoreVerticalFlip",
  rule_layer_IgnoreDiagonalFlip: "IgnoreDiagonalFlip",
}

var layerFloatProps = {
  rule_output_Probability: "Probability",
}

var specialMatchTypes = {
  rule_Empty: "Empty",
  rule_Ignore: "Ignore",
  rule_NonEmpty: "NonEmpty",
  rule_Other: "Other",
  rule_Negate: "Negate",
}

function readJson(path) {
  var file = new TextFile(path, TextFile.ReadOnly)
  try {
    return JSON.parse(file.readAll())
  } finally {
    file.close()
  }
}

function writeJson(path, value) {
  var file = new TextFile(path, TextFile.WriteOnly)
  file.write(JSON.stringify(value, null, 2) + "\n")
  file.commit()
}

function parseBool(value) {
  return value === true || value === "true" || value === "True" || value === "1"
}

function layerHeight(layer) {
  var width = Number(layer.width || 0)
  if (width === 0) {
    return 0
  }
  return Math.floor((layer.data || []).length / width)
}

function mapWidth(nativeMap) {
  return nativeMap.layers && nativeMap.layers.length > 0 ? Number(nativeMap.layers[0].width || 0) : 0
}

function mapHeight(nativeMap) {
  return nativeMap.layers && nativeMap.layers.length > 0 ? layerHeight(nativeMap.layers[0]) : 0
}

function layerName(layer, index) {
  return layer.props && layer.props.name ? layer.props.name : "layer" + index
}

function sanitizeName(value) {
  var out = ""
  for (var i = 0; i < value.length; i++) {
    var ch = value[i]
    out += /[A-Za-z0-9_-]/.test(ch) ? ch : "_"
  }
  out = out.replace(/^_+|_+$/g, "")
  return out || "layer"
}

function selectorToName(selector, targetLayerNames) {
  if (selector && selector[0] === "#") {
    var index = Number(selector.slice(1))
    if (index >= 0 && index < targetLayerNames.length) {
      return targetLayerNames[index]
    }
    return "layer" + index
  }
  return sanitizeName(selector || "layer")
}

function tiledRuleLayerName(props, layerIndex, targetLayerNames) {
  var role = props.rule_role || ""
  var selector = props.rule_target_layer || ("#" + layerIndex)
  var targetName = selectorToName(selector, targetLayerNames)
  if (role === "input") {
    var inputPrefix = "input"
    if (parseBool(props.rule_input_not)) {
      inputPrefix += "not"
    }
    inputPrefix += props.rule_input_index || ""
    return inputPrefix + "_" + targetName
  }
  if (role === "output") {
    return "output" + (props.rule_output_index || "") + "_" + targetName
  }
  return props.name || ("layer" + layerIndex)
}

function nativePropsToTiled(props, skipKeys) {
  var result = []
  var skip = skipKeys || {}
  for (var key in props) {
    if (skip[key]) {
      continue
    }
    result.push({ name: key, type: "string", value: String(props[key]) })
  }
  return result
}

function tiledMapProperties(props) {
  var result = []
  for (var key in mapBoolProps) {
    if (props[key] !== undefined) {
      result.push({ name: mapBoolProps[key], type: "bool", value: parseBool(props[key]) })
    }
  }
  return result
}

function tiledLayerProperties(props) {
  var result = []
  for (var key in layerBoolProps) {
    if (props[key] !== undefined) {
      result.push({ name: layerBoolProps[key], type: "bool", value: parseBool(props[key]) })
    }
  }
  for (var floatKey in layerFloatProps) {
    if (props[floatKey] !== undefined) {
      result.push({ name: layerFloatProps[floatKey], type: "float", value: Number(props[floatKey]) })
    }
  }
  for (var propKey in props) {
    if (propKey === "name" || propKey.indexOf("rule_") === 0) {
      continue
    }
    result.push({ name: propKey, type: "string", value: String(props[propKey]) })
  }
  return result
}

function tiledPropertiesToNative(properties) {
  var result = {}
  for (var i = 0; i < properties.length; i++) {
    var prop = properties[i]
    if (typeof prop.value === "boolean") {
      result[prop.name] = prop.value ? "true" : "false"
    } else {
      result[prop.name] = String(prop.value)
    }
  }
  return result
}

function maxTileId(nativeMap) {
  var maxValue = 0
  for (var i = 0; i < nativeMap.layers.length; i++) {
    var data = nativeMap.layers[i].data || []
    for (var j = 0; j < data.length; j++) {
      maxValue = Math.max(maxValue, Number(data[j]))
    }
  }
  return maxValue
}

function writeText(path, text) {
  var file = new TextFile(path, TextFile.WriteOnly)
  file.write(text)
  file.commit()
}

function tileColor(tileId) {
  return [tileId * 37 % 256, tileId * 67 % 256, tileId * 97 % 256]
}

function writePpm(path, tileCount, tileWidth, tileHeight) {
  var lines = []
  lines.push("P3")
  lines.push(String(tileCount * tileWidth) + " " + String(tileHeight))
  lines.push("255")
  for (var y = 0; y < tileHeight; y++) {
    var row = []
    for (var tileId = 1; tileId <= tileCount; tileId++) {
      var color = tileColor(tileId)
      for (var x = 0; x < tileWidth; x++) {
        row.push(String(color[0]), String(color[1]), String(color[2]))
      }
    }
    lines.push(row.join(" "))
  }
  writeText(path, lines.join("\n") + "\n")
}

function writeTilesetAssets(caseBuildDir, maxTileCount, rulesMap) {
  var tilesetPath = FileInfo.joinPaths(caseBuildDir, "tiles.tsj")
  var imagePath = FileInfo.joinPaths(caseBuildDir, "tiles.ppm")
  writePpm(imagePath, maxTileCount, 16, 16)

  var tiles = []
  for (var propName in specialMatchTypes) {
    var rawValue = rulesMap.props && rulesMap.props[propName]
    if (!rawValue) {
      continue
    }
    var tileId = Number(rawValue)
    if (!tileId || tileId < 1) {
      continue
    }
    tiles.push({
      id: tileId - 1,
      properties: [{ name: "MatchType", type: "string", value: specialMatchTypes[propName] }],
    })
  }

  var tileset = {
    columns: maxTileCount,
    image: "tiles.ppm",
    imageheight: 16,
    imagewidth: 16 * maxTileCount,
    margin: 0,
    name: "tiles",
    spacing: 0,
    tilecount: maxTileCount,
    tiledversion: "1.11.2",
    tileheight: 16,
    tilewidth: 16,
    type: "tileset",
    version: "1.10",
  }
  if (tiles.length > 0) {
    tileset.tiles = tiles
  }
  writeJson(tilesetPath, tileset)
}

function writeTmj(path, nativeMap, targetLayerNames, isRulesMap) {
  var layers = []
  var nextLayerId = 1
  var width = mapWidth(nativeMap)
  var height = mapHeight(nativeMap)
  var mapProps = nativeMap.props || {}
  var tileSize = Number(mapProps.tileSize || mapProps.tw || 16)

  for (var index = 0; index < nativeMap.layers.length; index++) {
    var nativeLayer = nativeMap.layers[index]
    var props = nativeLayer.props || {}
    var tiledLayer = {
      data: nativeLayer.data,
      height: layerHeight(nativeLayer),
      id: nextLayerId,
      name: layerName(nativeLayer, index),
      opacity: 1,
      type: "tilelayer",
      visible: true,
      width: nativeLayer.width,
      x: 0,
      y: 0,
    }
    nextLayerId += 1

    var propertyList
    if (isRulesMap) {
      tiledLayer.name = tiledRuleLayerName(props, index, targetLayerNames)
      propertyList = tiledLayerProperties(props)
    } else {
      propertyList = nativePropsToTiled(props, { name: true })
    }
    if (propertyList.length > 0) {
      tiledLayer.properties = propertyList
    }
    layers.push(tiledLayer)
  }

  var tmj = {
    compressionlevel: -1,
    height: height,
    infinite: false,
    layers: layers,
    nextlayerid: nextLayerId,
    nextobjectid: 1,
    orientation: "orthogonal",
    renderorder: "right-down",
    tiledversion: "1.11.2",
    tileheight: tileSize,
    tilesets: [{ firstgid: 1, source: "tiles.tsj" }],
    tilewidth: tileSize,
    type: "map",
    version: "1.10",
    width: width,
  }

  var topProps = isRulesMap ? tiledMapProperties(mapProps) : nativePropsToTiled(mapProps, {})
  if (topProps.length > 0) {
    tmj.properties = topProps
  }
  writeJson(path, tmj)
}

function readTmjAsNative(path) {
  var tmj = readJson(path)
  var nativeLayers = []
  for (var i = 0; i < tmj.layers.length; i++) {
    var layer = tmj.layers[i]
    if (layer.type !== "tilelayer") {
      continue
    }
    var props = tiledPropertiesToNative(layer.properties || [])
    props.name = layer.name || ""
    nativeLayers.push({ width: layer.width, data: layer.data, props: props })
  }
  return {
    layers: nativeLayers,
    props: tiledPropertiesToNative(tmj.properties || []),
  }
}

function readCaseList() {
  return readJson(FileInfo.joinPaths(testdataDir, "cases.json"))
}

function resolveCases(rawSelection) {
  var allCases = readCaseList()
  if (!rawSelection || rawSelection === "*" || rawSelection === "all") {
    return allCases
  }

  var requested = []
  var seen = {}
  var parts = rawSelection.split(",")
  for (var i = 0; i < parts.length; i++) {
    var name = parts[i].trim()
    if (!name || seen[name]) {
      continue
    }
    seen[name] = true
    if (allCases.indexOf(name) === -1) {
      throw new Error("unknown automap fixture case: " + name)
    }
    requested.push(name)
  }
  return requested
}

function generateCase(caseName) {
  var caseDir = FileInfo.joinPaths(testdataDir, caseName)
  var inputMap = readJson(FileInfo.joinPaths(caseDir, "input.json"))
  var rulesMap = readJson(FileInfo.joinPaths(caseDir, "rules.json"))
  var caseBuildDir = FileInfo.joinPaths(buildRoot, caseName)
  var targetLayerNames = []
  for (var i = 0; i < inputMap.layers.length; i++) {
    targetLayerNames.push(layerName(inputMap.layers[i], i))
  }
  var highestTile = Math.max(maxTileId(inputMap), maxTileId(rulesMap), 1)

  if (File.exists(caseBuildDir)) {
    File.remove(caseBuildDir)
  }
  File.makePath(caseBuildDir)

  writeTilesetAssets(caseBuildDir, highestTile, rulesMap)
  writeTmj(FileInfo.joinPaths(caseBuildDir, "input.tmj"), inputMap, targetLayerNames, false)
  writeTmj(FileInfo.joinPaths(caseBuildDir, "rules.tmj"), rulesMap, targetLayerNames, true)
  writeText(FileInfo.joinPaths(caseBuildDir, "rules.txt"), "rules.tmj\n")

  var workingPath = FileInfo.joinPaths(caseBuildDir, "working.tmj")
  var outputTmj = FileInfo.joinPaths(caseBuildDir, "output.tmj")
  File.copy(FileInfo.joinPaths(caseBuildDir, "input.tmj"), workingPath)

  var workingMap = tiled.open(workingPath)
  if (!workingMap || !workingMap.isTileMap) {
    throw new Error("failed to open working map for case: " + caseName)
  }

  workingMap.autoMap(FileInfo.joinPaths(caseBuildDir, "rules.txt"))
  var format = tiled.mapFormatForFile(outputTmj)
  if (!format || !format.canWrite) {
    tiled.close(workingMap)
    throw new Error("no writable map format for " + outputTmj)
  }

  var writeError = format.write(workingMap, outputTmj)
  tiled.close(workingMap)
  if (writeError) {
    throw new Error(writeError)
  }

  writeJson(FileInfo.joinPaths(caseDir, "output.json"), readTmjAsNative(outputTmj))
  return caseName
}

function generateFixtures(caseSelection) {
  File.makePath(buildRoot)
  var cases = resolveCases(caseSelection)
  var generated = []
  for (var i = 0; i < cases.length; i++) {
    generated.push(generateCase(cases[i]))
  }
  return generated
}

function writeStatus(ok, generated, errorMessage) {
  File.makePath(buildRoot)
  writeJson(statusPath, {
    ok: ok,
    generated: generated || [],
    error: errorMessage || "",
  })
}

function runFromRequestIfPresent() {
  if (!File.exists(requestPath)) {
    return
  }

  try {
    var request = readJson(requestPath)
    var generated = generateFixtures(request.cases && request.cases.length ? request.cases.join(",") : "*")
    writeStatus(true, generated, "")
    tiled.log("Generated automap fixtures: " + generated.join(", "))
  } catch (error) {
    var message = error && error.message ? error.message : String(error)
    writeStatus(false, [], message)
    tiled.error("Failed to generate automap fixtures: " + message)
  }

  File.remove(requestPath)
}

var generateFixturesAction = tiled.registerAction("GamectlGenerateAutomapFixtures", function() {
  try {
    var rawSelection = tiled.prompt("Case names (comma-separated or * for all)", "*", "Generate Automap Fixtures")
    if (rawSelection === null || rawSelection === "") {
      return
    }
    var generated = generateFixtures(rawSelection)
    tiled.log("Generated automap fixtures: " + generated.join(", "))
  } catch (error) {
    var message = error && error.message ? error.message : String(error)
    tiled.error("Failed to generate automap fixtures: " + message)
    throw error
  }
})
generateFixturesAction.text = "Generate Automap Fixtures"

tiled.extendMenu("Map", [{ action: "GamectlGenerateAutomapFixtures", before: "AutoMap" }])

runFromRequestIfPresent()
