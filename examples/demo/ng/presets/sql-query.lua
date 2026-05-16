local query = inputs[1]
if query == nil or query == "" then
    outputs[1] = ""
    outputs[2] = "query is required"
    return
end

local csvText = host.call("sql/sql::query", query)
local ok, rows = pcall(csv.parse, csvText, { headers = true })
if not ok then
    outputs[1] = ""
    outputs[2] = csvText ~= "" and csvText or "SQL query failed"
    return
end

outputs[1] = json.encode(rows)
outputs[2] = ""
