import { runtime } from '../core/runtime.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const NG = {
  NODE_GOAL: 1,
  NODE_CODE: 2,
  NODE_CALL: 3,
  NODE_VALUE: 4,
}

export class ViewNgNode extends HTMLElement {
  constructor() {
    super()
    this.popupProps = this.popupProps || {}
    this.formElement = null
    this.statusOutput = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'
    this.style.display = 'contents'

    const mode = String(this.popupProps?.mode || 'create')
    const nodeId = Number(this.popupProps?.nodeId || 0)
    const kind = Number(this.popupProps?.kind || NG.NODE_CODE)
    const nodeName = String(this.popupProps?.nodeName || '')
    const inputCount = Math.max(0, Math.min(8, Number(this.popupProps?.inputCount || 2)))
    const outputCount = Math.max(0, Math.min(8, Number(this.popupProps?.outputCount || 1)))
    const valueText = String(this.popupProps?.valueText || '')
    const inputLabels = Array.isArray(this.popupProps?.inputLabels) ? this.popupProps.inputLabels : []
    const outputLabels = Array.isArray(this.popupProps?.outputLabels) ? this.popupProps.outputLabels : []
    const isEdit = mode === 'edit'

    this.innerHTML = `
      <form data-element="form" novalidate>
        ${isEdit ? `<output data-element="node-id">Node #${nodeId}</output>` : ''}
        ${isEdit ? '' : `
        <label>
          Type
          <select data-field="kind" name="kind">
            <option value="${NG.NODE_CODE}" ${kind === NG.NODE_CODE ? 'selected' : ''}>Code</option>
            <option value="${NG.NODE_GOAL}" ${kind === NG.NODE_GOAL ? 'selected' : ''}>Goal</option>
            <option value="${NG.NODE_CALL}" ${kind === NG.NODE_CALL ? 'selected' : ''}>Call</option>
            <option value="${NG.NODE_VALUE}" ${kind === NG.NODE_VALUE ? 'selected' : ''}>Value</option>
          </select>
        </label>
        <label>
          Inputs
          <input type="number" data-field="input-count" name="input-count" min="0" max="8" value="${inputCount}">
        </label>
        <label>
          Outputs
          <input type="number" data-field="output-count" name="output-count" min="0" max="8" value="${outputCount}">
        </label>
        <label>
          Value output text
          <input type="text" data-field="value-text" name="value-text" value="${escapeAttribute(valueText)}">
        </label>
        `}
        <label>
          Name
          <input type="text" data-field="name" name="name" value="${escapeAttribute(nodeName)}" autocomplete="off">
        </label>
        ${isEdit ? `
        <label>
          Input labels
          <textarea data-field="input-labels" name="input-labels" rows="4">${escapeAttribute(inputLabels.join('\n'))}</textarea>
        </label>
        <label>
          Output labels / values
          <textarea data-field="output-labels" name="output-labels" rows="4">${escapeAttribute(outputLabels.join('\n'))}</textarea>
        </label>
        ` : ''}
        <footer>
          <output data-element="status"></output>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" class="accent">${isEdit ? 'Apply' : 'Create'}</button>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('[data-element="form"]')
    this.statusOutput = this.querySelector('[data-element="status"]')

    assert(this.formElement instanceof HTMLFormElement, 'view-ng-node missing form')
    assert(this.statusOutput instanceof HTMLOutputElement, 'view-ng-node missing status output')

    this.querySelector('[data-action="cancel"]')?.addEventListener('click', async () => {
      await runtime.call('ui.popup', 'close', { cancelled: true, ok: false, mode, nodeId })
    })

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      const formData = new FormData(this.formElement)
      if (isEdit) {
        await runtime.call('ui.popup', 'close', {
          ok: true,
          cancelled: false,
          mode,
          nodeId,
          draft: {
            name: String(formData.get('name') || '').trim(),
            inputLabels: String(formData.get('input-labels') || '').split('\n'),
            outputLabels: String(formData.get('output-labels') || '').split('\n'),
          },
        })
        return
      }

      const draftKind = Number(formData.get('kind') || NG.NODE_CODE)
      const draftInputCount = Math.max(0, Math.min(8, Number(formData.get('input-count') || 0)))
      const requestedOutputCount = Math.max(0, Math.min(8, Number(formData.get('output-count') || 0)))
      const draftOutputCount = draftKind === NG.NODE_GOAL ? 0 : draftKind === NG.NODE_VALUE ? Math.max(1, requestedOutputCount) : requestedOutputCount
      await runtime.call('ui.popup', 'close', {
        ok: true,
        cancelled: false,
        mode,
        draft: {
          kind: draftKind,
          name: String(formData.get('name') || '').trim(),
          inputCount: draftInputCount,
          outputCount: draftOutputCount,
          valueText: String(formData.get('value-text') || ''),
        },
      })
    })

    queueMicrotask(() => {
      const nameInput = this.querySelector('[data-field="name"]')
      if (nameInput instanceof HTMLInputElement) {
        nameInput.focus()
        nameInput.select()
      }
    })
  }

  setStatus(text, tone = null) {
    this.statusOutput.textContent = text
    this.statusOutput.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusOutput.classList.add(tone)
  }
}

if (!customElements.get('view-ng-node')) {
  customElements.define('view-ng-node', ViewNgNode)
}
