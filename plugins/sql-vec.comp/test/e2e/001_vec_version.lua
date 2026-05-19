local function assert_eq(actual, expected, label)
  if actual ~= expected then
    error((label or "assert_eq") .. ": expected " .. tostring(expected) .. ", got " .. tostring(actual))
  end
end

function main()
  local connection = host.call("sql/types::[static]connection.open", ":memory:")
  local rows = host.call(
    "sql/readwrite::query",
    connection,
    host.call("sql/types::[static]statement.prepare", "select vec_version() as version", {})
  )
  assert_eq(rows[1]["field-name"], "version", "version field")
  assert_eq(rows[1].value.case, "str", "version type")
  if rows[1].value.value == nil or rows[1].value.value == "" then
    error("vec_version() returned empty version")
  end
  return "ok"
end
