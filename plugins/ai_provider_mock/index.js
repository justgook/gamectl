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

function getLastMessage(messages) {
  if (!Array.isArray(messages)) throw new Error('Expected request.messages to be an array')
  return messages.length > 0 ? messages[messages.length - 1] : null
}

function extractToolResultText(message) {
  if (message.role !== 'tool') throw new Error(`Expected tool message, got '${message.role}'`)
  const block = message.content[0]
  const first = block.content[0]
  if (typeof first.text !== 'string') throw new Error('Expected tool result text content')
  return first.text
}

let script = []
let cursor = 0

const plugin = {
  id: 'ai.provider.mock',

  methods: {
    reset() {
      script = []
      cursor = 0
      return ok({ ok: true })
    },

    set_script(input) {
      const data = parseJson(input)
      if (!Array.isArray(data.script)) throw new Error('Expected script array')
      script = data.script
      cursor = 0
      return ok({ ok: true, count: script.length })
    },

    chat(input) {
      const request = parseJson(input)
      const step = script[cursor++]
      if (step) return ok(step)

      const messages = request.messages
      const lastMessage = getLastMessage(messages)

      if (lastMessage && lastMessage.role === 'tool') {
        const resultText = extractToolResultText(lastMessage)
        return ok({
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `Tool result:\n${resultText}`,
            },
          ],
          stopReason: 'stop',
        })
      }

      const lastUser = [...messages].reverse().find((message) => message.role === 'user')
      if (!lastUser) throw new Error('Mock provider expected at least one user message')
      if (typeof lastUser.content !== 'string') throw new Error('Mock provider expected user content string')

      const text = lastUser.content
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
              arguments: "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
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
