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

let script = []
let cursor = 0

function getLastMessage(messages) {
  return Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null
}

function extractToolResultText(message) {
  if (!message || message.role !== 'tool') return ''
  const block = Array.isArray(message.content) ? message.content[0] : null
  const first = Array.isArray(block?.content) ? block.content[0] : null
  return typeof first?.text === 'string' ? first.text : ''
}

const plugin = {
  id: 'ai.provider.mock',

  methods: {
    reset() {
      script = []
      cursor = 0
      return ok({ ok: true })
    },

    set_script(input) {
      const data = parseJson(input, {})
      script = Array.isArray(data.script) ? data.script : []
      cursor = 0
      return ok({ ok: true, count: script.length })
    },

    chat(input) {
      const request = parseJson(input, {})
      const step = script[cursor++]

      if (step) {
        return ok(step)
      }

      const messages = Array.isArray(request.messages) ? request.messages : []
      const lastMessage = getLastMessage(messages)

      if (lastMessage?.role === 'tool') {
        const resultText = extractToolResultText(lastMessage)
        return ok({
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: resultText ? `Tool result:\n${resultText}` : 'Tool finished.',
            },
          ],
          stopReason: 'stop',
        })
      }

      const lastUser = [...messages].reverse().find((message) => message?.role === 'user')
      const text = typeof lastUser?.content === 'string'
        ? lastUser.content
        : 'Mock provider response.'
      const lower = text.toLowerCase()

      if (lower.includes('list') && lower.includes('file')) {
        return ok({
          role: 'assistant',
          content: [
            {
              type: 'tool_call',
              id: `tool-${Date.now()}`,
              name: 'fs_list',
              arguments: { path: '/' },
            },
          ],
          stopReason: 'tool_use',
        })
      }

      const readMatch = text.match(/read\s+([^\s]+)|open\s+([^\s]+)/i)
      if (readMatch) {
        const path = readMatch[1] || readMatch[2]
        return ok({
          role: 'assistant',
          content: [
            {
              type: 'tool_call',
              id: `tool-${Date.now()}`,
              name: 'fs_read',
              arguments: { path },
            },
          ],
          stopReason: 'tool_use',
        })
      }

      if (lower.includes('table') || lower.includes('sqlite') || lower.includes('sql')) {
        return ok({
          role: 'assistant',
          content: [
            {
              type: 'tool_call',
              id: `tool-${Date.now()}`,
              name: 'sql_query',
              arguments: { sql: "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" },
            },
          ],
          stopReason: 'tool_use',
        })
      }

      return ok({
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `mock:${text}`,
          },
        ],
        stopReason: 'stop',
      })
    },
  },
}

export default plugin
