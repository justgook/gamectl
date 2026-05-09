function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInt(value, fallback = 0) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export class ViewPagination extends HTMLElement {
  static get observedAttributes() {
    return ['data-page', 'data-page-size', 'data-total-count', 'data-page-size-options']
  }

  connectedCallback() {
    this.render()
  }

  attributeChangedCallback() {
    if (!this.isConnected) return
    this.render()
  }

  get page() {
    return parseNonNegativeInt(this.getAttribute('data-page'), 0)
  }

  set page(value) {
    this.setAttribute('data-page', String(parseNonNegativeInt(value, 0)))
  }

  get pageSize() {
    return parsePositiveInt(this.getAttribute('data-page-size'), 20)
  }

  set pageSize(value) {
    this.setAttribute('data-page-size', String(parsePositiveInt(value, 20)))
  }

  get totalCount() {
    return parseNonNegativeInt(this.getAttribute('data-total-count'), 0)
  }

  set totalCount(value) {
    this.setAttribute('data-total-count', String(parseNonNegativeInt(value, 0)))
  }

  get pageSizeOptions() {
    const raw = this.getAttribute('data-page-size-options') || '10,20,50,100'
    const values = raw
      .split(',')
      .map((value) => parsePositiveInt(value.trim(), 0))
      .filter(Boolean)

    const unique = [...new Set(values)]
    return unique.length > 0 ? unique : [10, 20, 50, 100]
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize) || 1)
  }

  render() {
    const totalPages = this.totalPages
    const currentPage = clamp(this.page, 0, totalPages - 1)
    const pageSize = this.pageSize
    const options = this.pageSizeOptions

    if (currentPage !== this.page) {
      this.setAttribute('data-page', String(currentPage))
      return
    }

    this.innerHTML = `
      <button data-action="first" aria-label="First page" title="First page" ${currentPage === 0 ? 'disabled' : ''}><i aria-hidden="true">first_page</i></button>
      <button data-action="prev" aria-label="Previous page" title="Previous page" ${currentPage === 0 ? 'disabled' : ''}><i aria-hidden="true">chevron_left</i></button>
      <output data-element="summary">Page ${currentPage + 1} of ${totalPages}</output>
      <button data-action="next" aria-label="Next page" title="Next page" ${currentPage >= totalPages - 1 ? 'disabled' : ''}><i aria-hidden="true">chevron_right</i></button>
      <button data-action="last" aria-label="Last page" title="Last page" ${currentPage >= totalPages - 1 ? 'disabled' : ''}><i aria-hidden="true">last_page</i></button>
      <select data-action="page-size">
        ${options.map((size) => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size} rows</option>`).join('')}
      </select>
    `

    this.querySelector('[data-action="first"]')?.addEventListener('click', () => {
      this._emitChange(0, pageSize)
    })

    this.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
      this._emitChange(clamp(currentPage - 1, 0, totalPages - 1), pageSize)
    })

    this.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      this._emitChange(clamp(currentPage + 1, 0, totalPages - 1), pageSize)
    })

    this.querySelector('[data-action="last"]')?.addEventListener('click', () => {
      this._emitChange(totalPages - 1, pageSize)
    })

    this.querySelector('[data-action="page-size"]')?.addEventListener('change', (event) => {
      const nextPageSize = parsePositiveInt(event.target.value, pageSize)
      this._emitChange(0, nextPageSize)
    })
  }

  _emitChange(page, pageSize) {
    this.dispatchEvent(new CustomEvent('change', {
      detail: { page, pageSize },
      bubbles: true,
    }))
  }
}

if (!customElements.get('view-pagination')) {
  customElements.define('view-pagination', ViewPagination)
}
