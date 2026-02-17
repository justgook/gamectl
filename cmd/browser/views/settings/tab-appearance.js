import { bus } from '../../systems/event-bus.js'
import { toast } from '../../systems/toast.js'
import { parseCSVLines } from '../../util/csv.js'

const APPEARANCE_STORAGE_KEY = 'gamectl.appearance'

/**
 * SettingsTabAppearance
 * 
 * Appearance settings:
 * - Theme selector (Current, Obsidian, Neon)
 * - Font family selector (base UI font override)
 * - Font size selector
 * 
 * Stores settings in SQLite `settings` table.
 * Theme, base font family, and size are applied live.
 */
class SettingsTabAppearance extends HTMLElement {
  constructor() {
    super()
    this.settings = {}
  }

  async connectedCallback() {
    this.style.display = 'block'
    this.style.height = '100%'
    this.style.overflow = 'auto'

    await this.loadSettings()
    this.settings['appearance.theme'] = this.normalizeTheme(this.settings['appearance.theme'])
    this.applyTheme(this.settings['appearance.theme'])
    this.applyFontFamily(this.settings['appearance.font-family'] || 'default')
    this.applyFontSize(this.settings['appearance.font-size'] || '14')
    this.render()
  }

  async loadSettings() {
    const defaults = {
      'appearance.theme': 'current',
      'appearance.font-family': 'default',
      'appearance.font-size': '14',
    }

    try {
      const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        this.settings = { ...defaults, ...parsed }
        return
      }
    } catch (err) {
      console.warn('[SettingsTabAppearance] Failed to read localStorage appearance settings:', err)
    }

    try {
      const result = await window.pluginManager.call(
        'sql', 'query',
        "SELECT key, value FROM settings WHERE category='appearance'"
      )
      const csv = new TextDecoder().decode(result.output)
      const lines = parseCSVLines(csv.trim())

      this.settings = { ...defaults }
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (row.length >= 2) {
          this.settings[row[0]] = row[1]
        }
      }
    } catch (err) {
      console.error('[SettingsTabAppearance] Failed to load settings:', err)
      this.settings = defaults
    }
  }

  render() {
    this.innerHTML = ''

    const container = document.createElement('div')
    container.className = 'settings-appearance-container'

    // Theme selector
    container.appendChild(this.createSection('Theme', () => {
      const select = document.createElement('select')
      select.className = 'settings-appearance-select'
      const themes = [
        { value: 'current', label: 'Current' },
        { value: 'obsidian', label: 'Obsidian Terminal' },
        { value: 'neon', label: 'Neon Brutalist' },
      ]
      const activeTheme = this.normalizeTheme(this.settings['appearance.theme'] || 'current')
      themes.forEach(t => {
        const opt = document.createElement('option')
        opt.value = t.value
        opt.textContent = t.label
        if (t.value === activeTheme) {
          opt.selected = true
        }
        select.appendChild(opt)
      })
      select.addEventListener('change', (e) => {
        const nextTheme = this.normalizeTheme(e.target.value)
        this.settings['appearance.theme'] = nextTheme
        this.applyTheme(nextTheme)
      })
      return select
    }))

    // Base font family selector
    container.appendChild(this.createSection('Base Font Family', () => {
      const select = document.createElement('select')
      select.className = 'settings-appearance-select'
      const fonts = [
        { value: 'default', label: 'Theme Default' },
        { value: 'Roboto, sans-serif', label: 'Roboto' },
        { value: 'JetBrains Mono, monospace', label: 'JetBrains Mono' },
        { value: 'IBM Plex Mono, monospace', label: 'IBM Plex Mono' },
        { value: 'sans-serif', label: 'System Sans' },
        { value: 'monospace', label: 'System Mono' },
      ]
      fonts.forEach(f => {
        const opt = document.createElement('option')
        opt.value = f.value
        opt.textContent = f.label
        if (f.value !== 'default') {
          opt.style.fontFamily = f.value
        }
        if (f.value === (this.settings['appearance.font-family'] || 'default')) {
          opt.selected = true
        }
        select.appendChild(opt)
      })
      select.addEventListener('change', (e) => {
        this.settings['appearance.font-family'] = e.target.value
        this.applyFontFamily(e.target.value)
      })
      return select
    }))

    // Font size selector
    container.appendChild(this.createSection('Font Size', () => {
      const wrapper = document.createElement('div')
      wrapper.className = 'settings-appearance-font-size'

      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = '10'
      slider.max = '24'
      slider.step = '1'
      slider.value = this.settings['appearance.font-size'] || '14'
      slider.className = 'settings-appearance-slider'

      const display = document.createElement('span')
      display.className = 'settings-appearance-size-display'
      display.textContent = `${slider.value}px`

      slider.addEventListener('input', (e) => {
        display.textContent = `${e.target.value}px`
        this.settings['appearance.font-size'] = e.target.value
        this.applyFontSize(e.target.value)
      })

      wrapper.appendChild(slider)
      wrapper.appendChild(display)
      return wrapper
    }))

    // Save button
    const footer = document.createElement('div')
    footer.className = 'settings-appearance-footer'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'primary'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', () => this.save())
    footer.appendChild(saveBtn)

    const resetBtn = document.createElement('button')
    resetBtn.className = 'secondary'
    resetBtn.textContent = 'Reset to Default'
    resetBtn.addEventListener('click', () => this.resetDefaults())
    footer.appendChild(resetBtn)

    container.appendChild(footer)
    this.appendChild(container)
  }

  createSection(title, contentFn) {
    const section = document.createElement('div')
    section.className = 'settings-appearance-section'

    const label = document.createElement('label')
    label.className = 'settings-appearance-label'
    label.textContent = title

    section.appendChild(label)
    const content = contentFn()
    if (content instanceof DocumentFragment || content instanceof HTMLElement) {
      section.appendChild(content)
    }

    return section
  }

  applyFontFamily(value) {
    if (!value || value === 'default') {
      document.documentElement.style.removeProperty('--ui-font-body-override')
      document.documentElement.style.removeProperty('--ui-font-body')
      return
    }

    document.documentElement.style.setProperty('--ui-font-body-override', value)
    document.documentElement.style.setProperty('--ui-font-body', value)
  }

  normalizeTheme(value) {
    if (!value || value === 'dark') return 'current'
    if (value === 'current' || value === 'obsidian' || value === 'neon') return value
    return 'current'
  }

  applyTheme(value) {
    document.documentElement.dataset.theme = this.normalizeTheme(value)
  }

  applyFontSize(value) {
    document.documentElement.style.setProperty('--font-size-md', `${value}px`)
  }

  async save() {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(this.settings))

      // Apply current settings
      this.applyTheme(this.settings['appearance.theme'] || 'current')
      this.applyFontFamily(this.settings['appearance.font-family'] || 'default')
      this.applyFontSize(this.settings['appearance.font-size'] || '14')

      toast.success('Appearance settings saved locally')
    } catch (err) {
      console.error('[SettingsTabAppearance] Save failed:', err)
      toast.error('Failed to save appearance settings')
    }
  }

  async resetDefaults() {
    this.settings = {
      'appearance.theme': 'current',
      'appearance.font-family': 'default',
      'appearance.font-size': '14',
    }
    this.applyTheme('current')
    this.applyFontFamily('default')
    this.applyFontSize('14')
    this.render()
  }
}

customElements.define('settings-tab-appearance', SettingsTabAppearance)
