/**
 * OPR Unit Builder View
 * Dynamic UI for building units from OPR armies (Grimdark Future, Age of Fantasy, etc.)
 * 
 * Workflow: Universe → Army → Unit → Display stats/weapons/rules → Select upgrades
 */

const DE = new TextDecoder()

export class ViewOPRUnitBuilder extends HTMLElement {
  constructor() {
    super()
    this.state = {
      selectedUniverse: null,
      selectedArmy: null,
      selectedUnit: null,
      selectedUpgrades: new Set(),
      baseCost: 0
    }
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'
    
    // Load template
    const template = document.getElementById('view-opr-unit-builder')
    const content = template.content.cloneNode(true)
    this.appendChild(content)

    // Get references to key elements
    this.elements = {
      universeSelect: this.querySelector('[data-select="universe"]'),
      armySelect: this.querySelector('[data-select="army"]'),
      unitSelect: this.querySelector('[data-select="unit"]'),
      unitDisplay: this.querySelector('[data-element="unit-display"]'),
      emptyState: this.querySelector('[data-element="empty-state"]'),
      
      // Unit details
      unitName: this.querySelector('[data-element="unit-name"]'),
      unitSize: this.querySelector('[data-element="unit-size"]'),
      unitCost: this.querySelector('[data-element="unit-cost"]'),
      unitQuality: this.querySelector('[data-element="unit-quality"]'),
      unitDefense: this.querySelector('[data-element="unit-defense"]'),
      unitType: this.querySelector('[data-element="unit-type"]'),
      
      // Sections
      specialRulesContainer: this.querySelector('[data-element="special-rules-container"]'),
      specialRules: this.querySelector('[data-element="special-rules"]'),
      weaponsContainer: this.querySelector('[data-element="weapons-container"]'),
      weapons: this.querySelector('[data-element="weapons"]'),
      upgradesContainer: this.querySelector('[data-element="upgrades-container"]'),
      upgrades: this.querySelector('[data-element="upgrades"]'),
      
      totalCost: this.querySelector('[data-element="total-cost"]'),
      
      // Header controls
      randomBtn: this.querySelector('[data-action="random-unit"]'),
      exportBtn: this.querySelector('[data-action="export-json"]')
    }

    // Attach event listeners
    this.elements.universeSelect.addEventListener('change', () => this.onUniverseChange())
    this.elements.armySelect.addEventListener('change', () => this.onArmyChange())
    this.elements.unitSelect.addEventListener('change', () => this.onUnitChange())
    this.elements.randomBtn?.addEventListener('click', () => this.generateRandomUnit())
    this.elements.exportBtn?.addEventListener('click', () => this.exportJSON())

    // Initial load
    this.loadUniverses()
  }

  async loadUniverses() {
    try {
      const result = await window.pluginManager.call('sql', 'query',
        'SELECT id, name, short_name FROM opr_universes ORDER BY name'
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)
      
      this.elements.universeSelect.innerHTML = '<option value="">-- Select Universe --</option>'
      lines.forEach(line => {
        const [id, name, shortName] = line
        const option = document.createElement('option')
        option.value = id
        option.textContent = `${name} (${shortName})`
        this.elements.universeSelect.appendChild(option)
      })
    } catch (error) {
      console.error('Error loading universes:', error)
    }
  }

  async onUniverseChange() {
    const universeId = this.elements.universeSelect.value
    this.state.selectedUniverse = universeId
    this.state.selectedArmy = null
    this.state.selectedUnit = null
    
    this.elements.armySelect.disabled = !universeId
    this.elements.unitSelect.disabled = true
    this.elements.armySelect.innerHTML = '<option value="">-- Select Army --</option>'
    this.elements.unitSelect.innerHTML = '<option value="">-- Select Unit --</option>'
    this.hideUnitDisplay()
    
    if (!universeId) return
    
    try {
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT id, name FROM opr_armies WHERE universe_id = '${universeId}' ORDER BY name`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)
      
      lines.forEach(line => {
        const [id, name] = line
        const option = document.createElement('option')
        option.value = id
        option.textContent = name
        this.elements.armySelect.appendChild(option)
      })
    } catch (error) {
      console.error('Error loading armies:', error)
    }
  }

  async onArmyChange() {
    const armyId = this.elements.armySelect.value
    this.state.selectedArmy = armyId
    this.state.selectedUnit = null
    
    this.elements.unitSelect.disabled = !armyId
    this.elements.unitSelect.innerHTML = '<option value="">-- Select Unit --</option>'
    this.hideUnitDisplay()
    
    if (!armyId) return
    
    try {
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT id, name, cost, unit_type FROM opr_units WHERE army_id = '${armyId}' ORDER BY cost, name`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)
      
      lines.forEach(line => {
        const [id, name, cost, type] = line
        const option = document.createElement('option')
        option.value = id
        option.textContent = `${name} (${cost}pts, ${type})`
        this.elements.unitSelect.appendChild(option)
      })
    } catch (error) {
      console.error('Error loading units:', error)
    }
  }

  async onUnitChange() {
    const unitId = this.elements.unitSelect.value
    this.state.selectedUnit = unitId
    
    if (!unitId) {
      this.hideUnitDisplay()
      return
    }
    
    await this.loadUnitDetails(unitId)
  }

  async loadUnitDetails(unitId) {
    try {
      // Get unit base stats
      const unitResult = await window.pluginManager.call('sql', 'query',
        `SELECT id, name, size, cost, quality, defense, unit_type, notes FROM opr_units WHERE id = '${unitId}'`
      )
      const unitCsv = DE.decode(unitResult.output)
      const unitLines = this.parseCSV(unitCsv)
      
      if (unitLines.length === 0) return
      
      const [id, name, size, cost, quality, defense, unitType, notes] = unitLines[0]
      this.state.baseCost = parseInt(cost)
      
      // Update unit header
      this.elements.unitName.textContent = name
      this.elements.unitSize.textContent = size
      this.elements.unitCost.textContent = cost
      this.elements.unitQuality.textContent = quality
      this.elements.unitDefense.textContent = defense
      this.elements.unitType.textContent = unitType
      
      // Load special rules
      await this.loadSpecialRules(unitId)
      
      // Load weapons
      await this.loadWeapons(unitId)
      
      // Load upgrades
      await this.loadUpgrades(unitId)
      
      // Show unit display
      this.showUnitDisplay()
      this.updateTotalCost()
    } catch (error) {
      console.error('Error loading unit details:', error)
    }
  }

  async loadSpecialRules(unitId) {
    try {
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT sr.name, sr.description, usr.rating
         FROM opr_unit_special_rules usr
         JOIN opr_special_rules sr ON usr.special_rule_id = sr.id
         WHERE usr.unit_id = '${unitId}'
         ORDER BY sr.name`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)
      
      if (lines.length === 0) {
        this.elements.specialRulesContainer.style.display = 'none'
        return
      }
      
      this.elements.specialRulesContainer.style.display = 'block'
      this.elements.specialRules.innerHTML = ''
      
      lines.forEach(line => {
        const [name, description, rating] = line
        const ruleDiv = document.createElement('div')
        ruleDiv.style.cssText = 'padding: var(--spacing-scale-2); background: var(--color-semantic-bg-secondary); border-radius: var(--border-radius-sm); border-left: 3px solid var(--color-semantic-border-accent);'
        
        // Handle NULL values from SQL (come through as empty string or "NULL")
        const hasRating = rating && rating !== '' && rating !== 'NULL'
        const ruleName = hasRating ? `${name}(${rating})` : name
        ruleDiv.innerHTML = `
          <div style="font-weight: 500; color: var(--color-semantic-text-primary); margin-bottom: var(--spacing-scale-1);">${ruleName}</div>
          <div style="font-size: var(--font-size-sm); color: var(--color-semantic-text-secondary);">${description}</div>
        `
        this.elements.specialRules.appendChild(ruleDiv)
      })
    } catch (error) {
      console.error('Error loading special rules:', error)
      this.elements.specialRulesContainer.style.display = 'none'
    }
  }

  async loadWeapons(unitId) {
    try {
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT w.name, w.range, w.attacks, w.ap, w.special, uw.count
         FROM opr_unit_weapons uw
         JOIN opr_weapons w ON uw.weapon_id = w.id
         WHERE uw.unit_id = '${unitId}' AND uw.is_default = 1
         ORDER BY w.range DESC, w.name`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)
      
      if (lines.length === 0) {
        this.elements.weaponsContainer.style.display = 'none'
        return
      }
      
      this.elements.weaponsContainer.style.display = 'block'
      this.elements.weapons.innerHTML = ''
      
      lines.forEach(line => {
        const [name, range, attacks, ap, special, count] = line
        const weaponDiv = document.createElement('div')
        weaponDiv.style.cssText = 'padding: var(--spacing-scale-2); background: var(--color-semantic-bg-secondary); border-radius: var(--border-radius-sm);'
        
        // Handle NULL values from SQL
        const hasRange = range && range !== '' && range !== 'NULL'
        const rangeText = hasRange ? `${range}"` : 'Melee'
        const apText = (ap && ap !== '0' && ap !== 'NULL') ? ` AP(${ap})` : ''
        const specialText = (special && special !== '' && special !== 'NULL') ? ` ${special}` : ''
        
        weaponDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 500; color: var(--color-semantic-text-primary);">${name}</span>
              <span style="font-size: var(--font-size-sm); color: var(--color-semantic-text-tertiary);"> (${count}x)</span>
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-semantic-text-secondary);">
              Range: ${rangeText} | Attacks: ${attacks}${apText}${specialText}
            </div>
          </div>
        `
        this.elements.weapons.appendChild(weaponDiv)
      })
    } catch (error) {
      console.error('Error loading weapons:', error)
      this.elements.weaponsContainer.style.display = 'none'
    }
  }

  async loadUpgrades(unitId) {
    try {
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT id, name, cost, description
         FROM opr_upgrades
         WHERE unit_id = '${unitId}'
         ORDER BY cost, name`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)
      
      if (lines.length === 0) {
        this.elements.upgradesContainer.style.display = 'none'
        return
      }
      
      this.elements.upgradesContainer.style.display = 'block'
      this.elements.upgrades.innerHTML = ''
      this.state.selectedUpgrades.clear()
      
      lines.forEach(line => {
        const [id, name, cost, description] = line
        const upgradeDiv = document.createElement('label')
        upgradeDiv.style.cssText = 'display: flex; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2); background: var(--color-semantic-bg-secondary); border-radius: var(--border-radius-sm); cursor: pointer; align-items: center;'
        
        const costSign = parseInt(cost) >= 0 ? '+' : ''
        upgradeDiv.innerHTML = `
          <input type="checkbox" data-upgrade-id="${id}" data-upgrade-cost="${cost}" style="cursor: pointer;">
          <div style="flex: 1;">
            <div style="font-weight: 500; color: var(--color-semantic-text-primary);">${name} <span style="color: var(--color-semantic-text-accent);">${costSign}${cost}pts</span></div>
            <div style="font-size: var(--font-size-sm); color: var(--color-semantic-text-secondary);">${description}</div>
          </div>
        `
        
        const checkbox = upgradeDiv.querySelector('input[type="checkbox"]')
        checkbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.state.selectedUpgrades.add({ id, cost: parseInt(cost) })
          } else {
            this.state.selectedUpgrades.forEach(upgrade => {
              if (upgrade.id === id) {
                this.state.selectedUpgrades.delete(upgrade)
              }
            })
          }
          this.updateTotalCost()
        })
        
        this.elements.upgrades.appendChild(upgradeDiv)
      })
    } catch (error) {
      console.error('Error loading upgrades:', error)
      this.elements.upgradesContainer.style.display = 'none'
    }
  }

  updateTotalCost() {
    let total = this.state.baseCost
    this.state.selectedUpgrades.forEach(upgrade => {
      total += upgrade.cost
    })
    this.elements.totalCost.textContent = `${total}pts`
  }

  async generateRandomUnit() {
    if (!this.state.selectedArmy) {
      alert('Please select an army first')
      return
    }
    
    try {
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT id FROM opr_units WHERE army_id = '${this.state.selectedArmy}' ORDER BY RANDOM() LIMIT 1`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)
      
      if (lines.length > 0) {
        const [unitId] = lines[0]
        this.elements.unitSelect.value = unitId
        this.state.selectedUnit = unitId
        await this.loadUnitDetails(unitId)
      }
    } catch (error) {
      console.error('Error generating random unit:', error)
    }
  }

  exportJSON() {
    if (!this.state.selectedUnit) {
      alert('No unit selected')
      return
    }
    
    const data = {
      unitId: this.state.selectedUnit,
      unitName: this.elements.unitName.textContent,
      size: this.elements.unitSize.textContent,
      baseCost: this.state.baseCost,
      quality: this.elements.unitQuality.textContent,
      defense: this.elements.unitDefense.textContent,
      type: this.elements.unitType.textContent,
      selectedUpgrades: Array.from(this.state.selectedUpgrades),
      totalCost: this.elements.totalCost.textContent
    }
    
    console.log('Unit JSON:', JSON.stringify(data, null, 2))
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    alert('Unit JSON copied to clipboard!')
  }

  showUnitDisplay() {
    this.elements.unitDisplay.style.display = 'flex'
    this.elements.emptyState.style.display = 'none'
  }

  hideUnitDisplay() {
    this.elements.unitDisplay.style.display = 'none'
    this.elements.emptyState.style.display = 'flex'
  }

  parseCSV(csv) {
    const lines = csv.trim().split('\n')
    if (lines.length <= 1) return [] // Skip header or empty
    
    return lines.slice(1).map(line => {
      // Simple CSV parsing (handles basic cases)
      const values = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current)
          current = ''
        } else {
          current += char
        }
      }
      values.push(current)
      
      return values
    })
  }
}
