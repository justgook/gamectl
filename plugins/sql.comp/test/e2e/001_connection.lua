local function assert_eq(actual, expected, label)
  if actual ~= expected then
    error((label or "assert_eq") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual))
  end
end

function main()
  local connection = host.call("sql/types::[static]connection.open", ":memory:")
  assert_eq(connection["$resource"], "wasi:sql/types", "connection resource type")

  local statement = host.call("sql/types::[static]statement.prepare", "create table checks(id integer)", {})
  assert_eq(statement["$resource"], "wasi:sql/types", "statement resource type")

  local changed = host.call("sql/readwrite::exec", connection, statement)
  assert_eq(changed, 0, "create table changed rows")
  return "ok"
end
