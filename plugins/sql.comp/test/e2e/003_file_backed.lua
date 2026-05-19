local function assert_eq(actual, expected, label)
  if actual ~= expected then
    error((label or "assert_eq") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual))
  end
end

function main()
  local path = "sql-lua-e2e.sqlite"
  local connection = host.call("sql/types::[static]connection.open", path)
  host.call(
    "sql/readwrite::exec",
    connection,
    host.call("sql/types::[static]statement.prepare", "drop table if exists persisted", {})
  )
  host.call(
    "sql/readwrite::exec",
    connection,
    host.call("sql/types::[static]statement.prepare", "create table persisted(value text)", {})
  )
  host.call(
    "sql/readwrite::exec",
    connection,
    host.call("sql/types::[static]statement.prepare", "insert into persisted(value) values (?)", { "from-file-db" })
  )
  local rows = host.call(
    "sql/readwrite::query",
    connection,
    host.call("sql/types::[static]statement.prepare", "select value from persisted", {})
  )
  assert_eq(rows[1].value.value, "from-file-db", "file-backed select")
  return "ok"
end
