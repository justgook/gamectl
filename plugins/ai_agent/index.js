const encoder = new TextEncoder()
const decoder = new TextDecoder()

function decodeInput(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return decoder.decode(input)
  if (ArrayBuffer.isView(input)) {
    return decoder.decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  }
  return String(input ?? '')
}

function parseJson(input, fallback = {}) {
  const text = decodeInput(input)
  if (!text) return fallback
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
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

function now() {
  return Date.now()
}

function validateRequired(schema, args) {
  const required = Array.isArray(schema?.required) ? schema.required : []
  for (const key of required) {
    if (args?.[key] === undefined) return `Missing required field '${key}'`
  }
  return ''
}

function messageText(message) {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (!Array.isArray(message.content)) return ''

  return message.content.flatMap((block) => {
    if (block?.type === 'text') return [block.text || '']
    if (block?.type === 'tool_call') return [`Tool call: ${block.name} ${JSON.stringify(block.arguments || {})}`]
    if (block?.type === 'tool_result') {
      const text = Array.isArray(block.content)
        ? block.content.map((entry) => entry?.text || '').filter(Boolean).join('\n')
        : ''
      return [`${block.isError ? 'Tool error' : 'Tool result'}: ${block.name}${text ? `\n${text}` : ''}`]
    }
    return []
  }).filter(Boolean).join('\n')
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
  if (result?.returnCode) return false
  return decoder.decode(result.output || new Uint8Array()).trim() === 'true'
}

function fsReadText(ctx, path) {
  const result = ctx.callSync('fs', 'read', path)
  if (result?.returnCode) {
    throw new Error(decoder.decode(result.output || new Uint8Array()) || `fs.read failed for ${path}`)
  }
  return decoder.decode(result.output || new Uint8Array())
}

function fsWriteText(ctx, path, text) {
  const result = ctx.callSync('fs', 'write', writeFsPayload(path, text))
  if (result?.returnCode) {
    throw new Error(decoder.decode(result.output || new Uint8Array()) || `fs.write failed for ${path}`)
  }
}

function isSupportedPersistConfig(persist) {
  return persist && persist.driver === 'fs' && persist.format === 'jsonl' && typeof persist.path === 'string' && persist.path.length > 0
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

function makeDefaultContext(profile = 'browser2-default') {
  return [
    {
      kind: 'bootstrap',
      source: 'ai.agent',
      label: 'Default browser2 profile',
      content: {
        profile,
        host: 'browser2',
      },
    },
  ]
}

const sessions = new Map()
let nextHandle = 1

function getSession(handle) {
  return sessions.get(Number(handle) || 0) || null
}

function touch(session) {
  session.updatedAt = now()
}

function sessionSummary(session) {
  return {
    handle: session.handle,
    provider: session.provider,
    model: session.model,
    profile: session.profile,
    status: session.status,
    stepCount: session.stepCount,
    lastError: session.lastError,
    messageCount: session.messages.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    persist: session.persist || null,
  }
}

function newSession(data = {}) {
  const createdAt = now()
  return {
    handle: nextHandle++,
    provider: data.provider || 'ai.provider.mock',
    model: data.model || 'mock-default',
    profile: data.profile || 'browser2-default',
    persist: isSupportedPersistConfig(data.persist) ? data.persist : null,
    messages: [],
    tools: makeDefaultTools(),
    context: makeDefaultContext(data.profile || 'browser2-default'),
    status: 'idle',
    stepCount: 0,
    maxSteps: Number(data.maxSteps || 8),
    lastError: '',
    createdAt,
    updatedAt: createdAt,
  }
}

function serializeSessionJsonl(session) {
  const lines = []
  lines.push(JSON.stringify({
    type: 'session_meta',
    provider: session.provider,
    model: session.model,
    profile: session.profile,
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

function deserializeSessionJsonl(text, persistOverride = null) {
  const session = newSession({ persist: persistOverride })
  session.messages = []
  session.tools = makeDefaultTools()
  session.context = makeDefaultContext(session.profile)

  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue
    let entry = null
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (!entry || typeof entry !== 'object') continue

    if (entry.type === 'session_meta') {
      session.provider = entry.provider || session.provider
      session.model = entry.model || session.model
      session.profile = entry.profile || session.profile
      session.createdAt = Number(entry.createdAt || session.createdAt)
      session.updatedAt = Number(entry.updatedAt || session.updatedAt)
      session.maxSteps = Number(entry.maxSteps || session.maxSteps)
      if (persistOverride) session.persist = persistOverride
      else if (isSupportedPersistConfig(entry.persist)) session.persist = entry.persist
      continue
    }

    if (entry.type === 'context' && Array.isArray(entry.items)) {
      session.context = entry.items
      continue
    }

    if (entry.type === 'tools' && Array.isArray(entry.items)) {
      session.tools = entry.items
      continue
    }

    if (entry.type === 'message' && entry.message) {
      session.messages.push(entry.message)
    }
  }

  session.handle = nextHandle++
  session.status = 'idle'
  session.lastError = ''
  return session
}

function persistSession(ctx, session) {
  if (!isSupportedPersistConfig(session.persist)) return
  const text = serializeSessionJsonl(session)
  fsWriteText(ctx, session.persist.path, text)
}

function openSession(data, ctx) {
  if (isSupportedPersistConfig(data.persist) && fsExists(ctx, data.persist.path)) {
    const text = fsReadText(ctx, data.persist.path)
    const session = deserializeSessionJsonl(text, data.persist)
    sessions.set(session.handle, session)
    return session
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

    const validationError = validateRequired(tool.inputSchema, toolCall.arguments || {})
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
      const result = ctx.callSync(tool.target.plugin, tool.target.method, JSON.stringify(toolCall.arguments || {}))
      const text = result?.output instanceof Uint8Array
        ? decoder.decode(result.output)
        : JSON.stringify(result ?? null)

      toolResults.push({
        role: 'tool',
        content: [{
          type: 'tool_result',
          toolCallId: toolCall.id,
          name: toolCall.name,
          isError: !!result?.returnCode,
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
          content: [{ type: 'text', text: String(error?.message || error) }],
        }],
        timestamp: now(),
      })
    }
  }

  return toolResults
}

function runLoop(session, ctx) {
  const startedAt = session.messages.length
  const maxSteps = session.maxSteps || 8
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
    if (providerResult?.returnCode) {
      session.status = 'error'
      session.lastError = decoder.decode(providerResult.output || new Uint8Array())
      touch(session)
      persistSession(ctx, session)
      return fail('Provider call failed', { providerError: session.lastError })
    }

    const assistant = parseJson(providerResult.output, {
      role: 'assistant',
      content: [{ type: 'text', text: 'Empty provider response' }],
      stopReason: 'stop',
      timestamp: now(),
    })
    assistant.timestamp ||= now()
    lastAssistant = assistant
    session.messages.push(assistant)

    const toolCalls = Array.isArray(assistant.content)
      ? assistant.content.filter((entry) => entry?.type === 'tool_call')
      : []

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
      const data = parseJson(input, {})
      if (data.persist && !isSupportedPersistConfig(data.persist)) {
        return fail('Unsupported persist config', { supported: { driver: 'fs', format: 'jsonl' } })
      }
      const session = openSession(data, ctx)
      return ok({ handle: session.handle, summary: sessionSummary(session) })
    },

    close(input) {
      const data = parseJson(input, {})
      const handle = Number(data.handle || 0)
      sessions.delete(handle)
      return ok({ ok: true, handle })
    },

    list_open() {
      return ok({ items: Array.from(sessions.values()).map(sessionSummary) })
    },

    get_summary(input) {
      const data = parseJson(input, {})
      const session = getSession(data.handle)
      if (!session) return fail('Session not found')
      return ok(sessionSummary(session))
    },

    get_history_page(input) {
      const data = parseJson(input, {})
      const session = getSession(data.handle)
      if (!session) return fail('Session not found')

      const limit = Math.max(1, Number(data.limit || 50))
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
      const data = parseJson(input, {})
      const session = getSession(data.handle)
      if (!session) return fail('Session not found')
      session.provider = data.provider || session.provider
      session.model = data.model || session.model
      touch(session)
      persistSession(ctx, session)
      return ok(sessionSummary(session))
    },

    set_context(input, ctx) {
      const data = parseJson(input, {})
      const session = getSession(data.handle)
      if (!session) return fail('Session not found')
      session.context = Array.isArray(data.context) ? data.context : []
      touch(session)
      persistSession(ctx, session)
      return ok({ ok: true, summary: sessionSummary(session) })
    },

    add_context(input, ctx) {
      const data = parseJson(input, {})
      const session = getSession(data.handle)
      if (!session) return fail('Session not found')
      const entries = Array.isArray(data.context) ? data.context : (data.entry ? [data.entry] : [])
      session.context.push(...entries)
      touch(session)
      persistSession(ctx, session)
      return ok({ ok: true, summary: sessionSummary(session) })
    },

    send(input, ctx) {
      const data = parseJson(input, {})
      const session = getSession(data.handle)
      if (!session) return fail('Session not found')

      const text = typeof data.message === 'string' ? data.message.trim() : ''
      if (!text) return fail('Message is required')

      session.messages.push({ role: 'user', content: text, timestamp: now() })
      touch(session)
      return runLoop(session, ctx)
    },

    get_transcript_text(input) {
      const data = parseJson(input, {})
      const session = getSession(data.handle)
      if (!session) return fail('Session not found')
      return ok({
        text: session.messages.map((message) => `${message.role}: ${messageText(message)}`).join('\n\n'),
      })
    },
  },
}

export default plugin
