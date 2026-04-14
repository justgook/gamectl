const encoder = new TextEncoder()
const decoder = new TextDecoder()

function decodeInput(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return decoder.decode(input)
  if (ArrayBuffer.isView(input)) {
    return decoder.decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  }
  throw new Error(`Unsupported input type '${typeof input}'`)
}

function parseJson(input) {
  return JSON.parse(decodeInput(input))
}

function ok(value = {}) {
  return {
    returnCode: 0,
    output: encoder.encode(JSON.stringify(value)),
  }
}

function fail(message, details = {}) {
  return {
    returnCode: 1,
    output: encoder.encode(JSON.stringify({ error: message, ...details })),
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function now() {
  return Date.now()
}

function validateRequired(schema, args) {
  const required = Array.isArray(schema.required) ? schema.required : []
  for (const key of required) {
    if (args[key] === undefined) return `Missing required field '${key}'`
  }
  return ''
}

function messageText(message) {
  if (typeof message.content === 'string') return message.content
  assert(Array.isArray(message.content), 'Expected message.content to be an array or string')

  return message.content.flatMap((block) => {
    if (block.type === 'text') return [block.text]
    if (block.type === 'tool_call') return [`Tool call: ${block.name} ${JSON.stringify(block.arguments)}`]
    if (block.type === 'tool_result') {
      assert(Array.isArray(block.content), 'Expected tool_result.content to be an array')
      const text = block.content.map((entry) => entry.text).join('\n')
      return [`${block.isError ? 'Tool error' : 'Tool result'}: ${block.name}${text ? `\n${text}` : ''}`]
    }
    throw new Error(`Unknown content block type '${block.type}'`)
  }).join('\n')
}

function writeFsPayload(path, text) {
  const pathBytes = encoder.encode(path)
  const textBytes = encoder.encode(text)
  const payload = new Uint8Array(pathBytes.length + 1 + textBytes.length)
  payload.set(pathBytes, 0)
  payload[pathBytes.length] = 0
  payload.set(textBytes, pathBytes.length + 1)
  return payload
}

function fsExists(ctx, path) {
  const result = ctx.callSync('fs', 'exists', path)
  if (result.returnCode !== 0) return false
  return decoder.decode(result.output).trim() === 'true'
}

function fsReadText(ctx, path) {
  const result = ctx.callSync('fs', 'read', path)
  if (result.returnCode !== 0) {
    throw new Error(decoder.decode(result.output) || `fs.read failed for ${path}`)
  }
  return decoder.decode(result.output)
}

function fsWriteText(ctx, path, text) {
  const result = ctx.callSync('fs', 'write', writeFsPayload(path, text))
  if (result.returnCode !== 0) {
    throw new Error(decoder.decode(result.output) || `fs.write failed for ${path}`)
  }
}

function assertPersistConfig(persist) {
  assert(persist && typeof persist === 'object', 'Persist config is required')
  assert(persist.driver === 'fs', `Unsupported persist driver '${persist.driver}'`)
  assert(persist.format === 'jsonl', `Unsupported persist format '${persist.format}'`)
  assert(typeof persist.path === 'string' && persist.path.length > 0, 'Persist path is required')
}

function makeDefaultTools() {
  return [
    {
      name: 'fs_list',
      description: 'List files from the current workspace path.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
      },
      target: { plugin: 'fs', method: 'list' },
    },
    {
      name: 'fs_read',
      description: 'Read a file from the current workspace path.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      target: { plugin: 'fs', method: 'read' },
    },
    {
      name: 'sql_query',
      description: 'Execute a SQL query against the current database.',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
        },
        required: ['sql'],
      },
      target: { plugin: 'sql', method: 'query' },
    },
  ]
}

function makeDefaultContext() {
  return [
    {
      kind: 'bootstrap',
      source: 'ai.agent',
      label: 'Default browser2 bootstrap',
      content: {
        host: 'browser2',
      },
    },
  ]
}

const sessions = new Map()
let nextHandle = 1

function getSession(handle) {
  const session = sessions.get(Number(handle))
  assert(session, `Session not found for handle '${handle}'`)
  return session
}

function touch(session) {
  session.updatedAt = now()
}

function sessionSummary(session) {
  return {
    handle: session.handle,
    provider: session.provider,
    model: session.model,
    status: session.status,
    stepCount: session.stepCount,
    lastError: session.lastError,
    messageCount: session.messages.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    persist: session.persist,
  }
}

function newSession(data) {
  const createdAt = now()
  const session = {
    handle: nextHandle++,
    provider: data.provider ?? 'ai.provider.mock',
    model: data.model ?? 'mock-default',
    persist: data.persist ?? null,
    messages: [],
    tools: Array.isArray(data.tools) ? data.tools : makeDefaultTools(),
    context: Array.isArray(data.context) ? data.context : makeDefaultContext(),
    status: 'idle',
    stepCount: 0,
    maxSteps: Number(data.maxSteps ?? 8),
    lastError: '',
    createdAt,
    updatedAt: createdAt,
  }
  return session
}

function serializeSessionJsonl(session) {
  const lines = []
  lines.push(JSON.stringify({
    type: 'session_meta',
    provider: session.provider,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    maxSteps: session.maxSteps,
    persist: session.persist,
  }))
  lines.push(JSON.stringify({ type: 'context', items: session.context }))
  lines.push(JSON.stringify({ type: 'tools', items: session.tools }))
  for (const message of session.messages) {
    lines.push(JSON.stringify({ type: 'message', message }))
  }
  return `${lines.join('\n')}\n`
}

function deserializeSessionJsonl(text, persistOverride) {
  const session = newSession({ persist: persistOverride })
  session.messages = []
  session.tools = makeDefaultTools()
  session.context = makeDefaultContext()

  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue
    const entry = JSON.parse(line)
    assert(entry && typeof entry === 'object', 'Expected JSONL entry object')

    if (entry.type === 'session_meta') {
      session.provider = entry.provider
      session.model = entry.model
      session.createdAt = Number(entry.createdAt)
      session.updatedAt = Number(entry.updatedAt)
      session.maxSteps = Number(entry.maxSteps)
      session.persist = persistOverride
      continue
    }

    if (entry.type === 'context') {
      assert(Array.isArray(entry.items), 'Expected context items array')
      session.context = entry.items
      continue
    }

    if (entry.type === 'tools') {
      assert(Array.isArray(entry.items), 'Expected tools items array')
      session.tools = entry.items
      continue
    }

    if (entry.type === 'message') {
      assert(entry.message, 'Expected message entry payload')
      session.messages.push(entry.message)
      continue
    }

    throw new Error(`Unknown JSONL entry type '${entry.type}'`)
  }

  session.handle = nextHandle++
  session.status = 'idle'
  session.lastError = ''
  return session
}

function persistSession(ctx, session) {
  if (session.persist == null) return
  const text = serializeSessionJsonl(session)
  fsWriteText(ctx, session.persist.path, text)
}

function openSession(data, ctx) {
  if (data.persist != null) {
    assertPersistConfig(data.persist)
    if (fsExists(ctx, data.persist.path)) {
      const text = fsReadText(ctx, data.persist.path)
      const session = deserializeSessionJsonl(text, data.persist)
      sessions.set(session.handle, session)
      return session
    }
  }

  const session = newSession(data)
  sessions.set(session.handle, session)
  persistSession(ctx, session)
  return session
}

function executeToolCalls(ctx, session, toolCalls) {
  const toolResults = []

  for (const toolCall of toolCalls) {
    const tool = session.tools.find((entry) => entry.name === toolCall.name)
    if (!tool) {
      toolResults.push({
        role: 'tool',
        content: [{
          type: 'tool_result',
          toolCallId: toolCall.id,
          name: toolCall.name,
          isError: true,
          content: [{ type: 'text', text: `Unknown tool '${toolCall.name}'` }],
        }],
        timestamp: now(),
      })
      continue
    }

    const validationError = validateRequired(tool.inputSchema, toolCall.arguments)
    if (validationError) {
      toolResults.push({
        role: 'tool',
        content: [{
          type: 'tool_result',
          toolCallId: toolCall.id,
          name: toolCall.name,
          isError: true,
          content: [{ type: 'text', text: validationError }],
        }],
        timestamp: now(),
      })
      continue
    }

    try {
      const result = ctx.callSync(tool.target.plugin, tool.target.method, JSON.stringify(toolCall.arguments))
      const text = decoder.decode(result.output)

      toolResults.push({
        role: 'tool',
        content: [{
          type: 'tool_result',
          toolCallId: toolCall.id,
          name: toolCall.name,
          isError: result.returnCode !== 0,
          content: [{ type: 'text', text }],
        }],
        timestamp: now(),
      })
    } catch (error) {
      toolResults.push({
        role: 'tool',
        content: [{
          type: 'tool_result',
          toolCallId: toolCall.id,
          name: toolCall.name,
          isError: true,
          content: [{ type: 'text', text: String(error.message || error) }],
        }],
        timestamp: now(),
      })
    }
  }

  return toolResults
}

function runLoop(session, ctx) {
  const startedAt = session.messages.length
  const maxSteps = session.maxSteps
  let lastAssistant = null

  for (let i = 0; i < maxSteps; i++) {
    session.status = 'running'
    session.stepCount += 1
    touch(session)

    const providerInput = {
      handle: session.handle,
      model: session.model,
      messages: session.messages,
      tools: session.tools,
      context: session.context,
    }

    const providerResult = ctx.callSync(session.provider, 'chat', JSON.stringify(providerInput))
    if (providerResult.returnCode !== 0) {
      session.status = 'error'
      session.lastError = decoder.decode(providerResult.output)
      touch(session)
      persistSession(ctx, session)
      return fail('Provider call failed', { providerError: session.lastError })
    }

    const assistant = parseJson(providerResult.output)
    assistant.timestamp ??= now()
    lastAssistant = assistant
    session.messages.push(assistant)

    const toolCalls = assistant.content.filter((entry) => entry.type === 'tool_call')
    if (toolCalls.length === 0) {
      session.status = 'idle'
      touch(session)
      break
    }

    const toolResults = executeToolCalls(ctx, session, toolCalls)
    session.messages.push(...toolResults)
    session.status = 'idle'
    touch(session)
  }

  persistSession(ctx, session)

  const newMessages = session.messages.slice(startedAt)
  return ok({
    summary: sessionSummary(session),
    lastAssistant,
    newMessages,
  })
}

const plugin = {
  id: 'ai.agent',

  methods: {
    open(input, ctx) {
      const data = parseJson(input)
      const session = openSession(data, ctx)
      return ok({ handle: session.handle, summary: sessionSummary(session) })
    },

    close(input) {
      const data = parseJson(input)
      const handle = Number(data.handle)
      sessions.delete(handle)
      return ok({ ok: true, handle })
    },

    list_open() {
      return ok({ items: Array.from(sessions.values()).map(sessionSummary) })
    },

    get_summary(input) {
      const data = parseJson(input)
      const session = getSession(data.handle)
      return ok(sessionSummary(session))
    },

    get_history_page(input) {
      const data = parseJson(input)
      const session = getSession(data.handle)

      const limit = Math.max(1, Number(data.limit))
      const endExclusive = data.cursor == null
        ? session.messages.length
        : Math.max(0, Math.min(session.messages.length, Number(data.cursor)))
      const start = Math.max(0, endExclusive - limit)
      const items = session.messages.slice(start, endExclusive)

      return ok({
        items,
        nextCursor: start > 0 ? start : null,
        hasMore: start > 0,
      })
    },

    set_provider(input, ctx) {
      const data = parseJson(input)
      const session = getSession(data.handle)
      session.provider = data.provider
      session.model = data.model
      touch(session)
      persistSession(ctx, session)
      return ok(sessionSummary(session))
    },

    set_context(input, ctx) {
      const data = parseJson(input)
      const session = getSession(data.handle)
      assert(Array.isArray(data.context), 'Expected context array')
      session.context = data.context
      touch(session)
      persistSession(ctx, session)
      return ok({ ok: true, summary: sessionSummary(session) })
    },

    add_context(input, ctx) {
      const data = parseJson(input)
      const session = getSession(data.handle)
      assert(Array.isArray(data.context), 'Expected context array')
      session.context.push(...data.context)
      touch(session)
      persistSession(ctx, session)
      return ok({ ok: true, summary: sessionSummary(session) })
    },

    send(input, ctx) {
      const data = parseJson(input)
      const session = getSession(data.handle)
      assert(typeof data.message === 'string', 'Expected message string')
      assert(data.message.trim().length > 0, 'Message must not be empty')

      session.messages.push({ role: 'user', content: data.message.trim(), timestamp: now() })
      touch(session)
      return runLoop(session, ctx)
    },

    get_transcript_text(input) {
      const data = parseJson(input)
      const session = getSession(data.handle)
      return ok({
        text: session.messages.map((message) => `${message.role}: ${messageText(message)}`).join('\n\n'),
      })
    },
  },
}

export default plugin
