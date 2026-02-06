// Query animation data from database (ordered for deterministic output)
const sql = `SELECT source_file, start_frame, tile_width, tile_height, data FROM animation_storage ORDER BY source_file, start_frame`
const result = await window.pluginManager.call("sql", "query", sql)
const DE = new TextDecoder()
$out.data = fromCSV(DE.decode(result.output))
