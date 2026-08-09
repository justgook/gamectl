import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

class MockHTMLElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase()
    this.attributes = new Map()
  }

  hasAttribute(name) {
    return this.attributes.has(name)
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value))
  }

  removeAttribute(name) {
    this.attributes.delete(name)
  }
}

class MockStorage {
  constructor() {
    this.values = new Map()
  }

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }

  removeItem(key) {
    this.values.delete(key)
  }
}

globalThis.HTMLElement = MockHTMLElement
globalThis.localStorage = new MockStorage()
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
}

const source = await readFile(new URL("../packages/util/view-source-state.js", import.meta.url), "utf8")
const state = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)
const key = "gams:view-source:v1:view-markov"

test.beforeEach(() => localStorage.values.clear())

test("restores source attributes by view type", () => {
  localStorage.setItem(key, JSON.stringify({
    "data-source": "models/Basic.xml",
    "data-source-input": "maps/input.tilemap.json",
  }))
  const view = new MockHTMLElement("view-markov")

  state.restoreViewSourceState(view)

  assert.equal(view.getAttribute("data-source"), "models/Basic.xml")
  assert.equal(view.getAttribute("data-source-input"), "maps/input.tilemap.json")
})

test("explicit creation attributes take precedence over stored state", () => {
  localStorage.setItem(key, JSON.stringify({
    "data-source": "models/remembered.xml",
    "data-source-input": "maps/remembered.json",
  }))
  const view = new MockHTMLElement("view-markov")

  state.restoreViewSourceState(view, { "data-source": "models/explicit.xml" })

  assert.equal(view.getAttribute("data-source"), null)
  assert.equal(view.getAttribute("data-source-input"), "maps/remembered.json")
})

test("persists present source attributes and removes empty records", () => {
  const view = new MockHTMLElement("view-markov")
  view.setAttribute("data-source", "models/opened.xml")

  state.persistViewSourceState(view)
  assert.deepEqual(JSON.parse(localStorage.getItem(key)), { "data-source": "models/opened.xml" })

  view.removeAttribute("data-source")
  state.persistViewSourceState(view)
  assert.equal(localStorage.getItem(key), null)
})

test("rejects malformed stored source state", () => {
  localStorage.setItem(key, JSON.stringify({ source: "models/Basic.xml" }))
  const view = new MockHTMLElement("view-markov")

  assert.throws(() => state.restoreViewSourceState(view), /unknown field 'source'/)
})
