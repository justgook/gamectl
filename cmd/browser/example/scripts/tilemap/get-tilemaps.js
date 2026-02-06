// Query tilemap data from database
// Filter can be adjusted - for now get specific maps
const sql = `SELECT name, data FROM tilemap_storage WHERE name IN ('new_map', 'rules') ORDER BY name`
const result = await window.pluginManager.call("sql", "query", sql)
const DE = new TextDecoder()
const rows = fromCSV(DE.decode(result.output))

// Parse JSON data for each tilemap
$out.tilemaps = rows.map(row => ({
  name: row.name,
  ...JSON.parse(row.data)
}))
