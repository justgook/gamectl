import { runtime } from '../core/runtime.js'
import { parseCSVLines } from '../util/csv.js'
import { createWriteInput } from '../util/fs.js'

const textDecoder = new TextDecoder()

const NG = {
  NODE_GOAL: 1,
  NODE_CODE: 2,
  NODE_CALL: 3,
  NODE_VALUE: 4,
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function clampPortCount(value, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(32, Math.floor(n)))
}

function kindToFormValue(kind) {
  if (kind === NG.NODE_VALUE) return 'value'
  if (kind === NG.NODE_GOAL) return 'goal'
  if (kind === NG.NODE_CALL) return 'import'
  return 'code'
}

function kindFromFormValue(value, fallback = NG.NODE_CODE) {
  if (value === 'value') return NG.NODE_VALUE
  if (value === 'goal') return NG.NODE_GOAL
  if (value === 'import') return NG.NODE_CALL
  if (value === 'code') return NG.NODE_CODE
  return fallback
}

function nodeKindLabel(kind) {
  if (kind === NG.NODE_VALUE) return 'node-value'
  if (kind === NG.NODE_GOAL) return 'node-goal'
  if (kind === NG.NODE_CALL) return 'import-node'
  return 'node-code'
}

function nodeSupportsInputs(kind) {
  return kind === NG.NODE_CODE || kind === NG.NODE_GOAL || kind === NG.NODE_CALL
}

function nodeSupportsOutputs(kind) {
  return kind === NG.NODE_CODE || kind === NG.NODE_VALUE || kind === NG.NODE_CALL
}

function createNodeDraft(kind = NG.NODE_CODE) {
  return {
    kind,
    templateName: '',
    name: '',
    codePath: '',
    code: '',
    codeReadOnly: kind === NG.NODE_CODE,
    codeStatus: kind === NG.NODE_CODE ? 'Choose a code file to enable editing.' : '',
    newInputName: '',
    newOutputName: '',
    newOutputValue: '',
    graphName: '',
    graphId: 0,
    graphSummary: { inputs: [], outputs: [] },
    inputs: [],
    outputs: [],
  }
}

function normalizeTemplatePayload(payload, fallbackKind = NG.NODE_CODE) {
  const rawKind = Number(payload?.kind || fallbackKind)
  const kind = rawKind === NG.NODE_VALUE || rawKind === NG.NODE_GOAL || rawKind === NG.NODE_CODE || rawKind === NG.NODE_CALL
    ? rawKind
    : fallbackKind
  const normalized = createNodeDraft(kind)
  normalized.name = String(payload?.name || '').trim()
  normalized.codePath = String(payload?.codePath || '').trim()
  normalized.code = String(payload?.code || '')
  normalized.graphName = String(payload?.graphName || '').trim()
  normalized.graphId = Number(payload?.graphId || 0)
  normalized.codeReadOnly = kind === NG.NODE_CODE && (!normalized.codePath || Boolean(normalized.code))
  normalized.codeStatus = normalized.codePath
    ? ''
    : normalized.code
      ? 'Legacy inline code detected. Use Save to path to migrate it to a file.'
      : kind === NG.NODE_CODE
        ? 'Choose a code file to enable editing.'
        : ''

  const inputList = Array.isArray(payload?.inputs) ? payload.inputs : []
  const outputList = Array.isArray(payload?.outputs) ? payload.outputs : []

  normalized.inputs = inputList.map((input, index) => {
    const inputId = Number(input?.inputId || input?.id || index + 1)
    return {
      inputId: Number.isFinite(inputId) && inputId > 0 ? inputId : index + 1,
      name: String(input?.name || '').trim(),
      value: String(input?.defaultValue || input?.value || ''),
    }
  })

  normalized.outputs = outputList.map((output, index) => {
    const outputId = Number(output?.outputId || output?.id || index + 1)
    return {
      outputId: Number.isFinite(outputId) && outputId > 0 ? outputId : index + 1,
      name: String(output?.name || '').trim(),
      value: String(output?.value || ''),
    }
  })

  return normalized
}

function buildImportBoundarySummary(nodes) {
  const inputs = []
  const outputs = []
  const list = Array.isArray(nodes) ? nodes : []

  for (const node of list) {
    const kind = Number(node?.kind || 0)
    const nodeId = Number(node?.id || 0)
    const nodeName = String(node?.name || `#${nodeId}`).trim()
    if (kind === NG.NODE_VALUE) {
      const bucket = Array.isArray(node?.outputs) ? node.outputs : []
      bucket.forEach((port, index) => {
        const outputId = Number(port?.id || port?.outputId || index + 1)
        const portName = String(port?.name || `output ${index + 1}`).trim()
        inputs.push({
          nodeId,
          portId: outputId,
          importPortId: nodeId * 33 + outputId,
          name: bucket.length > 1 ? `${nodeName}.${portName}` : nodeName,
          nodeName,
          portName,
          value: String(port?.value || ''),
        })
      })
      continue
    }
    if (kind === NG.NODE_GOAL) {
      const bucket = Array.isArray(node?.inputs) ? node.inputs : []
      bucket.forEach((port, index) => {
        const inputId = Number(port?.id || port?.inputId || index + 1)
        const portName = String(port?.name || `input ${index + 1}`).trim()
        outputs.push({
          nodeId,
          portId: inputId,
          importPortId: nodeId * 33 + inputId,
          name: bucket.length > 1 ? `${nodeName}.${portName}` : nodeName,
          nodeName,
          portName,
        })
      })
    }
  }

  return { inputs, outputs }
}

export class ViewNgNode extends HTMLElement {
  constructor() {
    super()
    this.popupProps = this.popupProps || {}
    this.mode = String(this.popupProps?.mode || 'create')
    this.nodeId = Number(this.popupProps?.nodeId || 0)
    this.formElement = null
    this.statusOutput = null
    this.templates = []
    this.graphEntries = []
    this.draft = this._createInitialDraft()
  }

  _createInitialDraft() {
    if (this.mode === 'edit') {
      const kind = Number(this.popupProps?.kind || NG.NODE_CODE)
      const draft = createNodeDraft(kind)
      draft.name = String(this.popupProps?.nodeName || '').trim()
      draft.inputs = (Array.isArray(this.popupProps?.inputLabels) ? this.popupProps.inputLabels : []).map((name, index) => ({
        inputId: index + 1,
        name: String(name || ''),
      }))
      draft.outputs = (Array.isArray(this.popupProps?.outputLabels) ? this.popupProps.outputLabels : []).map((value, index) => ({
        outputId: index + 1,
        name: kind === NG.NODE_VALUE ? '' : String(value || ''),
        value: kind === NG.NODE_VALUE ? String(value || '') : '',
      }))
      draft.codePath = String(this.popupProps?.codePath || '').trim()
      draft.code = String(this.popupProps?.code || '')
      draft.codeReadOnly = Boolean(this.popupProps?.codeReadOnly ?? (kind === NG.NODE_CODE && !draft.codePath))
      draft.codeStatus = String(this.popupProps?.codeStatus || (kind === NG.NODE_CODE && !draft.codePath ? 'Choose a code file to enable editing.' : ''))
      draft.graphName = String(this.popupProps?.graphName || '').trim()
      draft.graphId = Number(this.popupProps?.graphId || 0)
      draft.graphSummary = this.popupProps?.graphSummary || { inputs: [], outputs: [] }
      return draft
    }
    return createNodeDraft(NG.NODE_CODE)
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'
    this.style.display = 'contents'
    this.innerHTML = '<form data-element="form" novalidate></form>'
    this.formElement = this.querySelector('[data-element="form"]')
    assert(this.formElement instanceof HTMLFormElement, 'view-ng-node missing form')

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.handleSubmit(event)
    })

    void this.initialize()
  }

  async initialize() {
    await this.loadTemplates()
    await this.loadGraphs()
    if (this.mode !== 'edit') {
      this.ensureDraftShape()
    }
    if (this.draft.kind === NG.NODE_CALL && this.draft.graphId > 0) {
      await this.applyImportNodeGraphRef(this.draft.graphId)
    }
    this.renderForm()
    queueMicrotask(() => {
      const nameInput = this.querySelector('[data-field="name"]')
      if (nameInput instanceof HTMLInputElement) {
        nameInput.focus()
        nameInput.select()
      }
    })
  }

  async callSql(sql) {
    const result = await runtime.call('sql', 'query', sql)
    if (result.returnCode !== 0) {
      throw new Error(decodeOutput(result) || `sql query failed: ${result.returnCode}`)
    }
    return decodeOutput(result)
  }

  async callFs(method, input) {
    const result = await runtime.call('fs', method, input)
    if (result.returnCode !== 0) {
      throw new Error(decodeOutput(result) || `fs.${method} failed: ${result.returnCode}`)
    }
    return result
  }

  async loadTemplates() {
    try {
      const csv = await this.callSql('SELECT name, kind, data FROM nodegraph2_node_templates ORDER BY name')
      const rows = parseCSVLines(csv.trim())
      this.templates = rows.slice(1).map((row) => {
        const name = String(row[0] || '').trim()
        const kind = Number(row[1] || 0)
        const raw = String(row[2] || '')
        if (!name) return null
        let data = {}
        try {
          data = JSON.parse(raw || '{}')
        } catch {
          data = {}
        }
        return { name, kind, data }
      }).filter(Boolean)
    } catch (error) {
      this.templates = []
    }
  }

  async loadGraphs() {
    try {
      const csv = await this.callSql('SELECT rowid, name, node_count, data FROM ng_graph_storage ORDER BY name')
      const rows = parseCSVLines(csv.trim())
      this.graphEntries = rows.slice(1).map((row) => ({
        id: Number(row[0] || 0),
        name: String(row[1] || '').trim(),
        nodeCount: Number(row[2] || 0),
        data: String(row[3] || ''),
      })).filter((entry) => entry.name)
    } catch (error) {
      this.graphEntries = []
    }
  }

  ensureDraftShape() {
    if (this.draft.kind === NG.NODE_CALL) {
      if (!this.draft.graphId && this.graphEntries.length) {
        this.draft.graphId = Number(this.graphEntries[0].id || 0)
      }
      return
    }

    if (!nodeSupportsInputs(this.draft.kind)) {
      this.draft.inputs = []
      this.draft.newInputName = ''
    } else if (!Array.isArray(this.draft.inputs) || this.draft.inputs.length === 0) {
      this.draft.inputs = []
    }

    if (!nodeSupportsOutputs(this.draft.kind)) {
      this.draft.outputs = []
      this.draft.newOutputName = ''
      this.draft.newOutputValue = ''
    } else if (!Array.isArray(this.draft.outputs) || this.draft.outputs.length === 0) {
      this.draft.outputs = this.draft.kind === NG.NODE_VALUE
        ? [{ outputId: 1, name: '', value: '' }]
        : []
    }

    if (this.draft.kind === NG.NODE_CODE && !this.draft.codePath) {
      this.draft.codeReadOnly = true
      this.draft.codeStatus = this.draft.codeStatus || 'Choose a code file to enable editing.'
    }
  }

  kindLabel(kind) {
    return nodeKindLabel(kind)
  }

  renderNodeTypeOptions(selectedKind, selectedTemplateName = '') {
    const selected = selectedTemplateName ? `template:${selectedTemplateName}` : kindToFormValue(selectedKind)
    const templateOptions = this.templates.length
      ? this.templates.map((entry) => {
        const value = `template:${entry.name}`
        return `<option value="${escapeAttribute(value)}" ${selected === value ? 'selected' : ''}>${escapeAttribute(entry.name)} (${escapeAttribute(this.kindLabel(Number(entry.kind || NG.NODE_CODE)))})</option>`
      }).join('')
      : '<option value="template-empty" disabled>empty</option>'
    return `
      <optgroup label="Base">
        <option value="value" ${selected === 'value' ? 'selected' : ''}>value</option>
        <option value="code" ${selected === 'code' ? 'selected' : ''}>code</option>
        <option value="goal" ${selected === 'goal' ? 'selected' : ''}>goal</option>
        <option value="import" ${selected === 'import' ? 'selected' : ''}>import</option>
      </optgroup>
      <optgroup label="Presets">
        ${templateOptions}
      </optgroup>
    `
  }

  renderCodeSourceFields() {
    const hasPath = Boolean(String(this.draft.codePath || '').trim())
    const message = String(this.draft.codeStatus || '').trim()
    return `
      <fieldset>
        <legend>Code file</legend>
        <label>
          Path
          <input type="text" name="code-path" data-field="code-path" value="${escapeAttribute(this.draft.codePath)}" placeholder="local:/assets/ng/example.lua">
        </label>
        <div>
          <button type="submit" name="intent" value="load-code-file">Load</button>
          <button type="submit" name="intent" value="save-code-file">Save to path</button>
          ${hasPath ? '<button type="submit" name="intent" value="reload-code-file">Reload</button>' : ''}
        </div>
        ${message ? `<output class="warning">${escapeAttribute(message)}</output>` : ''}
        <code-editor name="code" lang="lua" rows="12" spellcheck="false" ${this.draft.codeReadOnly ? 'readonly' : ''} placeholder="-- Lua code. Read inputs via inputs[<id>] and write outputs via outputs[<id>].">${escapeAttribute(this.draft.code)}</code-editor>
      </fieldset>
    `
  }

  renderImportBoundarySummary(summary = {}) {
    const inputs = Array.isArray(summary.inputs) ? summary.inputs : []
    const outputs = Array.isArray(summary.outputs) ? summary.outputs : []
    return `
      <fieldset>
        <legend>Imported inputs</legend>
        <table>
          <thead><tr><th>Name</th><th>Default</th></tr></thead>
          <tbody>
            ${inputs.length
        ? inputs.map((item, index) => `<tr><td>${escapeAttribute(String(item?.name || `input ${index + 1}`))}</td><td>${escapeAttribute(String(item?.value || ''))}</td></tr>`).join('')
        : '<tr><td colspan="2">none</td></tr>'}
          </tbody>
        </table>
      </fieldset>
      <fieldset>
        <legend>Imported outputs</legend>
        <table>
          <thead><tr><th>Name</th></tr></thead>
          <tbody>
            ${outputs.length
        ? outputs.map((item, index) => `<tr><td>${escapeAttribute(String(item?.name || `output ${index + 1}`))}</td></tr>`).join('')
        : '<tr><td>none</td></tr>'}
          </tbody>
        </table>
      </fieldset>
    `
  }

  renderPortRows(direction) {
    const isInput = direction === 'input'
    const isValueNode = this.draft.kind === NG.NODE_VALUE
    const ports = isInput ? this.draft.inputs : this.draft.outputs
    return ports.map((port, index) => `
      <tr>
        <td>${Number(isInput ? port.inputId : port.outputId || index + 1)}</td>
        <td>
          ${isInput
        ? `<input type="hidden" name="input-port-id" value="${Number(port.inputId || index + 1)}"><input type="text" name="input-port-name" value="${escapeAttribute(port.name || '')}" placeholder="Input ${index + 1}">`
        : isValueNode
          ? `<input type="hidden" name="output-port-id" value="${Number(port.outputId || index + 1)}"><input type="text" name="output-port-value" value="${escapeAttribute(port.value || '')}" placeholder="Value ${index + 1}">`
          : `<input type="hidden" name="output-port-id" value="${Number(port.outputId || index + 1)}"><input type="text" name="output-port-name" value="${escapeAttribute(port.name || '')}" placeholder="Output ${index + 1}">`}
        </td>
        <td><button type="submit" name="${isInput ? 'remove-input-id' : 'remove-output-id'}" value="${Number(isInput ? port.inputId : port.outputId || index + 1)}" aria-label="Delete"><i aria-hidden="true">delete</i></button></td>
      </tr>
    `).join('')
  }

  renderForm() {
    const isEdit = this.mode === 'edit'
    const isCodeNode = this.draft.kind === NG.NODE_CODE
    const isValueNode = this.draft.kind === NG.NODE_VALUE
    const isImportNode = this.draft.kind === NG.NODE_CALL
    const graphOptions = this.graphEntries.length
      ? this.graphEntries.map((entry) => `<option value="${Number(entry.id || 0)}" ${Number(entry.id || 0) === Number(this.draft.graphId || 0) ? 'selected' : ''}>${escapeAttribute(entry.name)} (${Number(entry.nodeCount || 0)} node${Number(entry.nodeCount || 0) === 1 ? '' : 's'})</option>`).join('')
      : '<option value="" disabled selected>no saved graphs</option>'

    this.formElement.innerHTML = `
      ${isEdit ? `<output data-element="node-id">Node #${this.nodeId}</output>` : '<p>Add a new node.</p>'}
      <label>
        Type
        <select name="node-kind" ${isEdit ? 'disabled' : ''}>
          ${this.renderNodeTypeOptions(this.draft.kind, this.draft.templateName)}
        </select>
      </label>
      <label>
        Node name
        <input type="text" data-field="name" name="name" placeholder="Enter node name" value="${escapeAttribute(this.draft.name)}">
      </label>
      ${isImportNode ? `
      <fieldset>
        <legend>Imported graph</legend>
        <label>
          Graph
          <select name="graph-name">
            <option value="" ${!this.draft.graphId ? 'selected' : ''}>choose graph</option>
            ${graphOptions}
          </select>
        </label>
        ${this.renderImportBoundarySummary(this.draft.graphSummary)}
      </fieldset>` : ''}
      ${isCodeNode ? this.renderCodeSourceFields() : ''}
      ${nodeSupportsInputs(this.draft.kind) && !isImportNode ? `
      <fieldset>
        <legend>Inputs</legend>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th></th></tr></thead>
          <tbody>${this.renderPortRows('input')}
            <td>New</td>
            <td><input type="text" name="new-input-name" value="${escapeAttribute(this.draft.newInputName)}" placeholder="Input name"></td>
            <td><button type="submit" name="intent" value="add-input" ${String(this.draft.newInputName).trim() ? '' : 'disabled'}><i aria-hidden="true">add</i></button></td>
          </tbody>
        </table>
      </fieldset>` : ''}
      ${nodeSupportsOutputs(this.draft.kind) && !isImportNode ? `
      <fieldset>
        <legend>Outputs</legend>
        <table>
          <thead><tr><th>ID</th><th>${isValueNode ? 'Value' : 'Name'}</th><th></th></tr></thead>
          <tbody>${this.renderPortRows('output')}
            <td>New</td>
            <td><input type="text" name="${isValueNode ? 'new-output-value' : 'new-output-name'}" value="${escapeAttribute(isValueNode ? this.draft.newOutputValue : this.draft.newOutputName)}" placeholder="${isValueNode ? 'Value' : 'Output name'}"></td>
            <td><button type="submit" name="intent" value="add-output" ${!isValueNode && !String(this.draft.newOutputName).trim() ? 'disabled' : ''}><i aria-hidden="true">add</i></button></td>
          </tbody>
        </table>
      </fieldset>` : ''}
      <footer>
        <output data-element="status"></output>
        <button type="button" data-action="cancel">Cancel</button>
        <button type="submit" name="intent" value="${isEdit ? 'save-node' : 'create-node'}" class="accent">${isEdit ? 'Apply' : 'Create'}</button>
      </footer>
    `

    this.statusOutput = this.querySelector('[data-element="status"]')
    assert(this.statusOutput instanceof HTMLOutputElement, 'view-ng-node missing status output')

    this.querySelector('[data-action="cancel"]')?.addEventListener('click', async () => {
      await runtime.call('ui.popup', 'close', { cancelled: true, ok: false, mode: this.mode, nodeId: this.nodeId })
    })

    const kindSelect = this.querySelector('[name="node-kind"]')
    if (kindSelect instanceof HTMLSelectElement && !isEdit) {
      kindSelect.onchange = async () => {
        this.captureDraftFromForm()
        const selectedValue = String(kindSelect.value || '')
        if (selectedValue.startsWith('template:')) {
          const templateName = selectedValue.slice('template:'.length).trim()
          const templateEntry = this.templates.find((entry) => String(entry.name || '') === templateName)
          if (!templateEntry) {
            this.setStatus(`Template '${templateName}' was not found.`, 'warning')
            return
          }
          this.applyNodeTemplateToDraft(templateEntry)
          if (this.draft.kind === NG.NODE_CALL && this.draft.graphId > 0) {
            await this.applyImportNodeGraphRef(this.draft.graphId)
          }
          this.renderForm()
          return
        }
        const previousKind = this.draft.kind
        this.draft.kind = kindFromFormValue(selectedValue, this.draft.kind)
        this.draft.templateName = ''
        if (this.draft.kind !== previousKind) this.ensureDraftShape()
        if (this.draft.kind === NG.NODE_CALL && this.draft.graphId > 0) {
          await this.applyImportNodeGraphRef(this.draft.graphId)
        }
        this.renderForm()
      }
    }

    const graphSelect = this.querySelector('[name="graph-name"]')
    if (graphSelect instanceof HTMLSelectElement && isImportNode) {
      graphSelect.onchange = async () => {
        await this.applyImportNodeGraphRef(Number(graphSelect.value || 0))
        this.renderForm()
      }
    }

    const newInput = this.querySelector('[name="new-input-name"]')
    const addInput = this.querySelector('[name="intent"][value="add-input"]')
    if (newInput instanceof HTMLInputElement && addInput instanceof HTMLButtonElement) {
      newInput.addEventListener('input', () => {
        this.draft.newInputName = newInput.value
        addInput.disabled = !String(newInput.value || '').trim()
      })
    }

    const newOutput = this.querySelector('[name="new-output-name"]')
    const addOutput = this.querySelector('[name="intent"][value="add-output"]')
    if (newOutput instanceof HTMLInputElement && addOutput instanceof HTMLButtonElement && !isValueNode) {
      newOutput.addEventListener('input', () => {
        this.draft.newOutputName = newOutput.value
        addOutput.disabled = !String(newOutput.value || '').trim()
      })
    }
  }

  captureDraftFromForm() {
    const formData = new FormData(this.formElement)
    this.draft.name = String(formData.get('name') || '').trim()
    this.draft.codePath = String(formData.get('code-path') || '').trim()
    this.draft.code = String(formData.get('code') || '')
    this.draft.newInputName = String(formData.get('new-input-name') || '')
    this.draft.newOutputName = String(formData.get('new-output-name') || '')
    this.draft.newOutputValue = String(formData.get('new-output-value') || '')

    const nextInputs = []
    const inputIds = formData.getAll('input-port-id')
    const inputNames = formData.getAll('input-port-name')
    for (let i = 0; i < inputIds.length; i += 1) {
      const inputId = Number(inputIds[i])
      if (!Number.isFinite(inputId)) continue
      nextInputs.push({ inputId, name: String(inputNames[i] || '').trim(), value: '' })
    }

    const nextOutputs = []
    const outputIds = formData.getAll('output-port-id')
    const outputNames = formData.getAll('output-port-name')
    const outputValues = formData.getAll('output-port-value')
    for (let i = 0; i < outputIds.length; i += 1) {
      const outputId = Number(outputIds[i])
      if (!Number.isFinite(outputId)) continue
      nextOutputs.push({ outputId, name: String(outputNames[i] || '').trim(), value: String(outputValues[i] || '') })
    }

    this.draft.inputs = nextInputs
    this.draft.outputs = nextOutputs
  }

  applyNodeTemplateToDraft(templateEntry) {
    const payload = normalizeTemplatePayload(templateEntry?.data, Number(templateEntry?.kind || NG.NODE_CODE))
    this.draft.kind = payload.kind
    this.draft.templateName = String(templateEntry?.name || '').trim()
    this.draft.name = payload.name
    this.draft.codePath = payload.codePath
    this.draft.code = payload.code
    this.draft.codeReadOnly = payload.codeReadOnly
    this.draft.codeStatus = payload.codeStatus
    this.draft.newInputName = ''
    this.draft.newOutputName = ''
    this.draft.newOutputValue = ''
    this.draft.inputs = payload.inputs
    this.draft.outputs = payload.outputs
    this.draft.graphName = payload.graphName
    this.draft.graphId = payload.graphId
  }

  async readGraphEntryById(graphId) {
    const normalized = Number(graphId || 0)
    return this.graphEntries.find((entry) => Number(entry.id) === normalized) || null
  }

  async applyImportNodeGraphRef(graphRef) {
    const graphId = Number(graphRef || 0) || 0
    const graph = graphId > 0 ? await this.readGraphEntryById(graphId) : null
    const cleanName = String(graph?.name || '').trim()
    const previousGraphName = String(this.draft.graphName || '').trim()
    this.draft.graphId = graph?.id || graphId
    this.draft.graphName = cleanName
    if (!String(this.draft.name || '').trim() || String(this.draft.name || '').trim() === previousGraphName) {
      this.draft.name = cleanName
    }
    this.draft.inputs = []
    this.draft.outputs = []
    if (!cleanName) {
      this.draft.graphSummary = { inputs: [], outputs: [] }
      return
    }
    let nodes = []
    try {
      const parsed = JSON.parse(String(graph?.data || '{}'))
      nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : []
    } catch {
      nodes = []
    }
    const summary = buildImportBoundarySummary(nodes)
    this.draft.graphSummary = summary
    this.draft.inputs = summary.inputs.map((entry, index) => ({ inputId: Number(entry.importPortId || index + 1), name: entry.name, value: entry.value }))
    this.draft.outputs = summary.outputs.map((entry, index) => ({ outputId: Number(entry.importPortId || index + 1), name: entry.name, value: '' }))
  }

  async readCodeFile(path) {
    const result = await this.callFs('read', path)
    return decodeOutput(result)
  }

  async writeCodeFile(path, content) {
    await this.callFs('write', createWriteInput(path, String(content ?? '')))
  }

  setStatus(text, tone = null) {
    this.statusOutput.textContent = text
    this.statusOutput.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusOutput.classList.add(tone)
  }

  async handleSubmit(event) {
    this.captureDraftFromForm()
    const submitter = event.submitter
    const formData = new FormData(this.formElement, submitter || undefined)
    const intent = formData.has('remove-input-id')
      ? `remove-input:${String(formData.get('remove-input-id') || '')}`
      : formData.has('remove-output-id')
        ? `remove-output:${String(formData.get('remove-output-id') || '')}`
        : String(formData.get('intent') || (this.mode === 'edit' ? 'save-node' : 'create-node'))

    if (intent === 'add-input') {
      const inputName = String(formData.get('new-input-name') || '').trim()
      if (inputName) {
        const nextId = this.draft.inputs.reduce((max, port) => Math.max(max, Number(port.inputId || 0)), 0) + 1
        this.draft.inputs.push({ inputId: nextId, name: inputName, value: '' })
        this.draft.newInputName = ''
      }
      this.renderForm()
      return
    }

    if (intent.startsWith('remove-input:')) {
      const inputId = Number(intent.split(':')[1])
      this.draft.inputs = this.draft.inputs.filter((port) => Number(port.inputId) !== inputId)
      this.renderForm()
      return
    }

    if (intent === 'add-output') {
      const outputName = String(formData.get('new-output-name') || '').trim()
      const outputValue = String(formData.get('new-output-value') || '')
      if (this.draft.kind === NG.NODE_VALUE || outputName) {
        const nextId = this.draft.outputs.reduce((max, port) => Math.max(max, Number(port.outputId || 0)), 0) + 1
        this.draft.outputs.push({ outputId: nextId, name: outputName, value: outputValue })
        this.draft.newOutputName = ''
        this.draft.newOutputValue = ''
      }
      this.renderForm()
      return
    }

    if (intent.startsWith('remove-output:')) {
      const outputId = Number(intent.split(':')[1])
      this.draft.outputs = this.draft.outputs.filter((port) => Number(port.outputId) !== outputId)
      this.renderForm()
      return
    }

    if (intent === 'load-code-file' || intent === 'reload-code-file') {
      if (!this.draft.codePath) {
        this.draft.codeStatus = 'Choose a code file path first.'
      } else {
        try {
          this.draft.code = await this.readCodeFile(this.draft.codePath)
          this.draft.codeReadOnly = false
          this.draft.codeStatus = ''
        } catch (error) {
          this.draft.codeStatus = String(error?.message || error)
        }
      }
      this.renderForm()
      return
    }

    if (intent === 'save-code-file') {
      if (!this.draft.codePath) {
        this.draft.codeStatus = 'Choose a code file path first.'
        this.renderForm()
        return
      }
      try {
        await this.writeCodeFile(this.draft.codePath, this.draft.code)
        this.draft.codeReadOnly = false
        this.draft.codeStatus = ''
      } catch (error) {
        this.draft.codeStatus = String(error?.message || error)
      }
      this.renderForm()
      return
    }

    if (this.draft.kind === NG.NODE_CALL) {
      const graphId = Number(formData.get('graph-name') || this.draft.graphId || 0)
      if (!Number.isFinite(graphId) || graphId <= 0) {
        this.setStatus('Choose a graph to import.', 'warning')
        return
      }
      await this.applyImportNodeGraphRef(graphId)
    }

    if (this.mode === 'edit') {
      await runtime.call('ui.popup', 'close', {
        ok: true,
        cancelled: false,
        mode: this.mode,
        nodeId: this.nodeId,
        draft: {
          name: String(this.draft.name || '').trim(),
          inputLabels: this.draft.inputs.map((port) => String(port.name || '')),
          outputLabels: this.draft.outputs.map((port) => String(this.draft.kind === NG.NODE_VALUE ? port.value : port.name || '')),
        },
      })
      return
    }

    await runtime.call('ui.popup', 'close', {
      ok: true,
      cancelled: false,
      mode: this.mode,
      draft: {
        kind: Number(this.draft.kind || NG.NODE_CODE),
        templateName: String(this.draft.templateName || ''),
        name: String(this.draft.name || '').trim(),
        codePath: String(this.draft.codePath || '').trim(),
        code: String(this.draft.code || ''),
        graphName: String(this.draft.graphName || '').trim(),
        graphId: Number(this.draft.graphId || 0),
        graphSummary: this.draft.graphSummary,
        inputs: this.draft.inputs.map((port, index) => ({ inputId: Number(port.inputId || index + 1), name: String(port.name || '').trim(), value: String(port.value || '') })),
        outputs: this.draft.outputs.map((port, index) => ({ outputId: Number(port.outputId || index + 1), name: String(port.name || '').trim(), value: String(port.value || '') })),
      },
    })
  }
}

if (!customElements.get('view-ng-node')) {
  customElements.define('view-ng-node', ViewNgNode)
}
