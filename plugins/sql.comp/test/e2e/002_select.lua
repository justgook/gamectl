local function assert_eq(actual, expected, label)
  if actual ~= expected then
    error((label or "assert_eq") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual))
  end
end

function main()
  local connection = host.call("sql/types::[static]connection.open", ":memory:")

  host.call(
    "sql/readwrite::exec",
    connection,
    host.call("sql/types::[static]statement.prepare", "create table items(id integer primary key, name text)", {})
  )

  local insert = host.call("sql/types::[static]statement.prepare", "insert into items(name) values (?)", { "sword" })
  assert_eq(host.call("sql/readwrite::exec", connection, insert), 1, "insert changed rows")

  local rows = host.call(
    "sql/readwrite::query",
    connection,
    host.call("sql/types::[static]statement.prepare", "select id, name from items order by id", {})
  )

  assert_eq(#rows, 2, "flat wasi-sql cell count")
  assert_eq(rows[1]["field-name"], "id", "id field name")
  assert_eq(rows[1].value.case, "int64", "id type")
  assert_eq(rows[1].value.value, 1, "id value")
  assert_eq(rows[2]["field-name"], "name", "name field name")
  assert_eq(rows[2].value.case, "str", "name type")
  assert_eq(rows[2].value.value, "sword", "name value")
  return "ok"
end
