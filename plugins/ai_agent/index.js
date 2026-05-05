import Ajv from "/util/ajv.js"

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const ajv = new Ajv({
  allErrors: true,
  strict: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
})

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

function formatAjvErrors(validate, toolName, originalArguments) {
  assert(Array.isArray(validate.errors), `Tool '${toolName}' validation failed without AJV errors`)
  const details = validate.errors.map((error) => {
    const path = error.instancePath ? error.instancePath.slice(1) || 'root' : (error.params.missingProperty || 'root')
    return `- ${path}: ${error.message}`
  }).join('\n')
  return `Validation failed for tool '${toolName}':\n${details}\nReceived arguments:\n${JSON.stringify(originalArguments, null, 2)}`
}

function assertToolDefinitionShape(tool) {
  assert(tool && typeof tool === 'object', 'Tool definition must be an object')
  assert(typeof tool.name === 'string' && tool.name.length > 0, 'Tool name is required')
  assert(typeof tool.description === 'string' && tool.description.length > 0, `Tool '${tool.name}' description is required`)
  assert(tool.parameters && typeof tool.parameters === 'object', `Tool '${tool.name}' parameters schema is required`)
  assert(tool.target && typeof tool.target === 'object', `Tool '${tool.name}' target is required`)
  assert(typeof tool.target.plugin === 'string' && tool.target.plugin.length > 0, `Tool '${tool.name}' target.plugin is required`)
  assert(typeof tool.target.method === 'string' && tool.target.method.length > 0, `Tool '${tool.name}' target.method is required`)
}

function normalizeTool(tool) {
  assertToolDefinitionShape(tool)
  const validate = ajv.compile(tool.parameters)
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    target: {
      plugin: tool.target.plugin,
      method: tool.target.method,
    },
    validate,
  }
}

function normalizeTools(tools) {
  assert(Array.isArray(tools), 'Expected tools array')
  return tools.map(normalizeTool)
}

function serializeTools(tools) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    target: tool.target,
  }))
}

function coerceToolArgumentsForSchema(schema, rawArguments) {
  if (!schema || schema.type !== 'object') return rawArguments
  if (rawArguments == null || typeof rawArguments === 'object') return rawArguments

  const properties = schema.properties ?? {}
  const keys = Object.keys(properties)
  if (keys.length !== 1) return rawArguments

  const [key] = keys
  const propertySchema = properties[key]
  if (!propertySchema || propertySchema.type !== typeof rawArguments) return rawArguments

  const required = Array.isArray(schema.required) ? schema.required : []
  if (required.length !== 1 || required[0] !== key) return rawArguments
  if (schema.additionalProperties !== false) return rawArguments

  return { [key]: rawArguments }
}

function serializeToolTargetInput(value) {
  if (typeof value === 'string') return value
  if (value == null) return JSON.stringify(value)

  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value)
    if (keys.length === 1) {
      const singleValue = value[keys[0]]
      if (typeof singleValue === 'string') return singleValue
      if (typeof singleValue === 'number' || typeof singleValue === 'boolean') return String(singleValue)
    }
  }

  return JSON.stringify(value)
}

function validateToolArguments(tool, rawArguments) {
  const normalizedArguments = coerceToolArgumentsForSchema(tool.parameters, rawArguments)
  const argumentsCopy = structuredClone(normalizedArguments)
  const valid = tool.validate(argumentsCopy)
  if (!valid) {
    return {
      ok: false,
      error: formatAjvErrors(tool.validate, tool.name, rawArguments),
    }
  }
  return {
    ok: true,
    value: argumentsCopy,
  }
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

const sessions = new Map()
let nextHandle = 1
let nextToolCallId = 1

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
    toolCount: session.tools.length,
    contextCount: session.context.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    persist: session.persist,
  }
}

function newSession(data) {
  const createdAt = now()
  return {
    handle: nextHandle++,
    provider: data.provider ?? 'ai.provider.mock',
    model: data.model ?? 'mock-default',
    persist: data.persist ?? null,
    messages: [],
    tools: normalizeTools(data.tools ?? []),
    context: data.context ?? [],
    status: 'idle',
    stepCount: 0,
    maxSteps: Number(data.maxSteps ?? 8),
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
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    maxSteps: session.maxSteps,
    persist: session.persist,
  }))
  lines.push(JSON.stringify({ type: 'context', items: session.context }))
  lines.push(JSON.stringify({ type: 'tools', items: serializeTools(session.tools) }))
  for (const message of session.messages) {
    lines.push(JSON.stringify({ type: 'message', message }))
  }
  return `${lines.join('\n')}\n`
}

function deserializeSessionJsonl(text, persistOverride) {
  const session = newSession({ persist: persistOverride, tools: [], context: [] })
  session.messages = []
  session.tools = []
  session.context = []

  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue
    const entry = JSON.parse(line)
    assert(entry && typeof entry === 'object', 'Expected JSONL entry object')

    if (entry.type === 'session_meta') {
      assert(typeof entry.provider === 'string' && entry.provider.length > 0, 'Persisted session provider is required')
      assert(typeof entry.model === 'string' && entry.model.length > 0, 'Persisted session model is required')
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
      session.tools = normalizeTools(entry.items)
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
  assert(data && typeof data === 'object', 'ai.agent.open expects an object')
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

function createToolResultMessage(toolCallId, toolName, text, isError) {
  return {
    role: 'tool',
    content: [{
      type: 'tool_result',
      toolCallId,
      name: toolName,
      isError,
      content: [{ type: 'text', text }],
    }],
    timestamp: now(),
  }
}

function executeToolCall(ctx, session, toolCall) {
  assert(typeof toolCall.id === 'string' && toolCall.id.length > 0, 'Tool call id is required')
  assert(typeof toolCall.name === 'string' && toolCall.name.length > 0, 'Tool call name is required')
  // assert(toolCall.arguments && typeof toolCall.arguments === 'object' && !Array.isArray(toolCall.arguments), `Tool call '${toolCall.name}' arguments must be an object`)

  const tool = session.tools.find((entry) => entry.name === toolCall.name)
  if (!tool) {
    return createToolResultMessage(toolCall.id, toolCall.name, `Unknown tool '${toolCall.name}'`, true)
  }

  const validated = validateToolArguments(tool, toolCall.arguments)
  if (!validated.ok) {
    return createToolResultMessage(toolCall.id, toolCall.name, validated.error, true)
  }

  try {
    const result = ctx.callSync(tool.target.plugin, tool.target.method, serializeToolTargetInput(validated.value))
    const text = decoder.decode(result.output)
    return createToolResultMessage(toolCall.id, toolCall.name, text, result.returnCode !== 0)
  } catch (error) {
    return createToolResultMessage(toolCall.id, toolCall.name, String(error.message || error), true)
  }
}

function executeToolCalls(ctx, session, toolCalls) {
  return toolCalls.map((toolCall) => executeToolCall(ctx, session, toolCall))
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
      tools: serializeTools(session.tools),
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
    assert(assistant && typeof assistant === 'object', 'Provider returned invalid assistant payload')
    assert(Array.isArray(assistant.content), 'Provider assistant payload missing content array')
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

function nextManualToolCallId() {
  return `manual-tool-${nextToolCallId++}`
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
      assert(typeof data.provider === 'string' && data.provider.length > 0, 'Expected provider string')
      assert(typeof data.model === 'string' && data.model.length > 0, 'Expected model string')
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

    invoke_tool(input, ctx) {
      const data = parseJson(input)
      const session = getSession(data.handle)
      assert(typeof data.name === 'string' && data.name.length > 0, 'Expected tool name')
      // assert(data.arguments && typeof data.arguments === 'object' && !Array.isArray(data.arguments), 'Expected tool arguments object')

      const debugCommand = `/tool:${data.name} ${JSON.stringify(data.arguments)}`
      session.messages.push({ role: 'user', content: debugCommand, timestamp: now() })
      const toolResult = executeToolCall(ctx, session, {
        id: nextManualToolCallId(),
        name: data.name,
        arguments: data.arguments,
      })

      session.messages.push(toolResult)
      touch(session)
      persistSession(ctx, session)
      return ok({
        summary: sessionSummary(session),
        newMessages: [session.messages[session.messages.length - 2], toolResult],
      })
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
