
function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string`)
}

function assertStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`)
  for (const item of value) assertString(item, `${name} item`)
}

function assertSqlResource(value, name) {
  if (!value || typeof value !== 'object') throw new Error(`${name} must be a resource object`)
  if (value.$resource !== 'wasi:sql/types') throw new Error(`${name} must be a wasi:sql/types resource`)
  assertString(value.id, `${name}.id`)
}

async function unwrapSqlResult(runtime, result, label) {
  if (!result || typeof result !== 'object') throw new Error(`${label}: expected result object`)
  if (Object.prototype.hasOwnProperty.call(result, 'ok')) return result.ok
  if (!Object.prototype.hasOwnProperty.call(result, 'err')) throw new Error(`${label}: expected result object`)

  const err = result.err
  assertSqlResource(err, `${label} error`)
  const trace = await runtime.invoke('sql/types::[method]error.trace', err)
  await runtime.releaseResource(err)
  throw new Error(`${label}: ${trace}`)
}

function cellValue(value) {
  if (!value || typeof value !== 'object') throw new Error('SQL cell value must be a variant object')
  assertString(value.case, 'SQL cell value case')
  if (value.case === 'null') return null
  if (!Object.prototype.hasOwnProperty.call(value, 'value')) {
    throw new Error(`SQL cell value '${value.case}' must contain value`)
  }
  return value.value
}

export class SqlConnection {
  #runtime
  #connection

  constructor(runtime, connection) {
    if (!runtime || typeof runtime.invoke !== 'function') throw new Error('SqlConnection runtime must implement invoke')
    assertSqlResource(connection, 'SqlConnection connection')
    this.#runtime = runtime
    this.#connection = connection
  }

  get resource() {
    return this.#connection
  }

  async close() {
    await this.#runtime.releaseResource(this.#connection)
  }

  async prepare(sql, params = []) {
    assertString(sql, 'SQL statement')
    assertStringArray(params, 'SQL params')
    return await unwrapSqlResult(
      this.#runtime,
      await this.#runtime.invoke('sql/types::[static]statement.prepare', sql, params),
      'prepare SQL statement',
    )
  }

  async exec(sql, params = []) {
    const statement = await this.prepare(sql, params)
    try {
      return await unwrapSqlResult(
        this.#runtime,
        await this.#runtime.invoke('sql/readwrite::exec', this.#connection, statement),
        'exec SQL statement',
      )
    } finally {
      await this.#runtime.releaseResource(statement)
    }
  }

  async queryCells(sql, params = []) {
    const statement = await this.prepare(sql, params)
    try {
      const cells = await unwrapSqlResult(
        this.#runtime,
        await this.#runtime.invoke('sql/readwrite::query', this.#connection, statement),
        'query SQL statement',
      )
      if (!Array.isArray(cells)) throw new Error('SQL query result must be an array')
      return cells
    } finally {
      await this.#runtime.releaseResource(statement)
    }
  }

  async queryObjects(sql, columns, params = []) {
    assertStringArray(columns, 'SQL query columns')
    if (columns.length === 0) throw new Error('SQL query columns must not be empty')

    const cells = await this.queryCells(sql, params)
    if (cells.length % columns.length !== 0) {
      throw new Error(`SQL cell count ${cells.length} is not divisible by column count ${columns.length}`)
    }

    const rows = []
    for (let offset = 0; offset < cells.length; offset += columns.length) {
      const row = {}
      for (let index = 0; index < columns.length; index++) {
        const cell = cells[offset + index]
        const column = columns[index]
        if (!cell || typeof cell !== 'object') throw new Error('SQL row cell must be an object')
        if (cell['field-name'] !== column) {
          throw new Error(`SQL column mismatch at cell ${offset + index}: expected ${column}, got ${cell['field-name']}`)
        }
        row[column] = cellValue(cell.value)
      }
      rows.push(row)
    }
    return rows
  }

  async value(sql, params = []) {
    const cells = await this.queryCells(sql, params)
    if (cells.length !== 1) throw new Error(`SQL value query expected exactly one cell, got ${cells.length}`)
    return cellValue(cells[0].value)
  }
}

export async function openSqlVecConnection(runtime, name) {
  assertString(name, 'SQL connection name')
  const connection = await unwrapSqlResult(
    runtime,
    await runtime.invoke('sql/types::[static]connection.open', name),
    'open SQL connection',
  )
  return new SqlConnection(runtime, connection)
}
