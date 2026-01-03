/**
 * OPR Unit Builder View v2
 * Advanced unit builder with:
 * - Normalized weapon/rule tooltips
 * - Upgrade groups (radio/checkbox)
 * - Clear weapon replacement costs
 * - Multi-unit card system
 * 
 * Workflow: Universe → Army → Unit → Build → Add to List
 */

import { toast } from "../systems/toast.js"

const DE = new TextDecoder()

export class ViewOPRUnitBuilder extends HTMLElement {
  constructor() {
    super()
    this.state = {
      selectedUniverse: null,
      selectedArmy: null,
      selectedUnit: null,
      selectedUpgrades: new Set(),
      baseCost: 0,
      currentWeapons: new Map(), // Track current weapon loadout
      specialRulesCache: new Map(), // Cache special rule descriptions
      weaponSpecialRulesCache: new Map() // Cache weapon special rules
    }
    this.unitCards = [] // Array of built units
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
    // this.cacheSpecialRules()
  }

  async cacheSpecialRules() {
    try {
      const result = await window.pluginManager.call('sql', 'query',
        'SELECT id, name, description FROM opr_special_rules'
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)

      lines.forEach(line => {
        const [id, name, description] = line
        this.state.specialRulesCache.set(id, { name, description })
        // Also cache by lowercase name for easy lookup
        this.state.specialRulesCache.set(name.toLowerCase(), { name, description })
      })
    } catch (error) {
      console.error('Error caching special rules:', error)
    }
  }

  async loadUniverses() {
    try {
      const result = await window.pluginManager.call('sql', 'query',
        'SELECT id, name FROM opr_universes ORDER BY name'
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)

      this.elements.universeSelect.innerHTML = '<option value="">-- Select Universe --</option>'
      lines.forEach(line => {
        const [id, name] = line
        const option = document.createElement('option')
        option.value = id
        option.textContent = name
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
        `SELECT id, name, size, cost, quality, defense, tough, unit_type, notes FROM opr_units WHERE id = '${unitId}'`
      )
      const unitCsv = DE.decode(unitResult.output)

      if (unitResult.returnCode) {
        toast.error(`loadUnitDetailsfailed: ${unitCsv || 'Unknown error'}`, { duration: 5000 })
      }

      const unitLines = this.parseCSV(unitCsv)
      if (unitLines.length === 0) return

      const [id, name, size, cost, quality, defense, tough, unitType, notes] = unitLines[0]
      this.state.baseCost = parseInt(cost)

      // Update unit header
      this.elements.unitName.textContent = name
      this.elements.unitSize.textContent = size
      this.elements.unitCost.textContent = cost
      this.elements.unitQuality.textContent = `${quality}+`
      this.elements.unitDefense.textContent = `${defense}+`

      // Add Tough if present with tooltip
      if (tough && tough !== 'NULL' && tough !== '') {
        const toughData = this.state.specialRulesCache.get('tough')
        if (toughData) {
          this.elements.unitDefense.innerHTML = `${defense}+ (<abbr data-tooltip="${toughData.description}" style="text-decoration: underline dotted; cursor: help; text-decoration-color: var(--color-semantic-border-accent);">Tough(${tough})</abbr>)`
        } else {
          this.elements.unitDefense.textContent = `${defense}+ (Tough ${tough})`
        }
      }

      this.elements.unitType.textContent = unitType

      // Load special rules with tooltips
      await this.loadSpecialRules(unitId)

      // Load weapons with special rules tooltips
      await this.loadWeapons(unitId)

      // Load upgrades with groups
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
        `SELECT sr.id, sr.name, sr.description, usr.rating
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
        const [id, name, description, rating] = line
        const ruleDiv = document.createElement('div')
        ruleDiv.style.cssText = 'display: inline-block; margin-right: var(--spacing-scale-2); margin-bottom: var(--spacing-scale-1);'

        const hasRating = rating && rating !== '' && rating !== 'NULL'
        const ruleName = hasRating ? `${name}(${rating})` : name

        ruleDiv.innerHTML = `
          <abbr data-tooltip="${description}" style="
            text-decoration: underline dotted;
            cursor: help;
            text-decoration-color: var(--color-semantic-border-accent);
            padding: var(--spacing-scale-1) var(--spacing-scale-2);
            background: var(--color-semantic-bg-secondary);
            border-radius: var(--border-radius-sm);
            font-size: var(--font-size-sm);
          ">${ruleName}</abbr>
        `
        this.elements.specialRules.appendChild(ruleDiv)
      })
    } catch (error) {
      console.error('Error loading special rules:', error)
      this.elements.specialRulesContainer.style.display = 'none'
    }
  }

  wrapPropertyWithTooltip(property) {
    // Helper function to wrap weapon properties with tooltips
    // Matches patterns like "AP(1)", "Blast(3)", "Reliable", etc.
    const match = property.match(/^([A-Za-z]+)(?:\((\d+)\))?$/)
    if (!match) return property

    const [_, ruleName, rating] = match
    const ruleData = this.state.specialRulesCache.get(ruleName.toLowerCase())

    if (!ruleData) return property

    const displayName = rating ? `${ruleName}(${rating})` : ruleName
    return `<abbr data-tooltip="${ruleData.description}" style="text-decoration: underline dotted; cursor: help; text-decoration-color: var(--color-semantic-border-accent);">${displayName}</abbr>`
  }

  async loadWeapons(unitId) {
    try {
      // Get weapons with special rules
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT w.id, w.name, w.range, w.attacks, w.ap, uw.count,
                GROUP_CONCAT(wsr.special_rule_id || ':' || COALESCE(wsr.rating, '')) as special_rules
         FROM opr_unit_weapons uw
         JOIN opr_weapons w ON uw.weapon_id = w.id
         LEFT JOIN opr_weapon_special_rules wsr ON w.id = wsr.weapon_id
         WHERE uw.unit_id = '${unitId}' AND uw.is_default = 1
         GROUP BY w.id, w.name, w.range, w.attacks, w.ap, uw.count
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

      // Initialize current weapons
      this.state.currentWeapons.clear()

      lines.forEach(line => {
        const [weaponId, name, range, attacks, ap, count, specialRulesStr] = line

        // Track current weapons
        this.state.currentWeapons.set(weaponId, { name, count: parseInt(count) })

        const weaponDiv = document.createElement('div')
        weaponDiv.style.cssText = 'padding: var(--spacing-scale-2); background: var(--color-semantic-bg-secondary); border-radius: var(--border-radius-sm); margin-bottom: var(--spacing-scale-1);'

        const hasRange = range && range !== '' && range !== 'NULL'
        const rangeText = hasRange ? `${range}"` : 'Melee'

        // Wrap AP with tooltip if present
        let apText = ''
        if (ap && ap !== '0' && ap !== 'NULL') {
          apText = ` ${this.wrapPropertyWithTooltip(`AP(${ap})`)}`
        }

        // Parse special rules
        let specialRulesHTML = ''
        if (specialRulesStr && specialRulesStr !== 'NULL' && specialRulesStr !== '') {
          const rules = specialRulesStr.split(',')
          const ruleElements = rules.map(rule => {
            const [ruleId, rating] = rule.split(':')
            const ruleData = this.state.specialRulesCache.get(ruleId)
            if (!ruleData) return ''

            const ruleName = rating && rating !== '' ? `${ruleData.name}(${rating})` : ruleData.name
            return `<abbr data-tooltip="${ruleData.description}" style="text-decoration: underline dotted; cursor: help; text-decoration-color: var(--color-semantic-border-accent);">${ruleName}</abbr>`
          }).filter(r => r !== '')

          if (ruleElements.length > 0) {
            specialRulesHTML = ` ${ruleElements.join(', ')}`
          }
        }

        weaponDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 500; color: var(--color-semantic-text-primary);">${name}</span>
              <span style="font-size: var(--font-size-sm); color: var(--color-semantic-text-tertiary);"> (${count}x)</span>
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-semantic-text-secondary);">
              Range: ${rangeText} | Attacks: ${attacks}${apText}${specialRulesHTML}
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
      // Load upgrade groups
      const groupsResult = await window.pluginManager.call('sql', 'query',
        `SELECT id, label, selection_type, min_selections, max_selections, applies_to, applies_count
         FROM opr_upgrade_groups
         WHERE unit_id = '${unitId}'
         ORDER BY sort_order`
      )
      const groupsCsv = DE.decode(groupsResult.output)
      const groups = this.parseCSV(groupsCsv)

      // Load upgrades
      const upgradesResult = await window.pluginManager.call('sql', 'query',
        `SELECT u.id, u.group_id, u.name, u.cost, u.description, u.upgrade_type,
                u.replaces_weapon_id, u.adds_weapon_id, u.adds_special_rule_id
         FROM opr_upgrades u
         WHERE u.unit_id = '${unitId}'
         ORDER BY u.group_id, u.sort_order`
      )
      const upgradesCsv = DE.decode(upgradesResult.output)
      const upgrades = this.parseCSV(upgradesCsv)

      if (groups.length === 0 && upgrades.length === 0) {
        this.elements.upgradesContainer.style.display = 'none'
        return
      }

      this.elements.upgradesContainer.style.display = 'block'
      this.elements.upgrades.innerHTML = ''
      this.state.selectedUpgrades.clear()

      // Render groups
      for (const groupLine of groups) {
        const [groupId, label, selectionType, minSel, maxSel, appliesTo, appliesCount] = groupLine
        const groupUpgrades = upgrades.filter(u => u[1] === groupId)

        if (groupUpgrades.length === 0) continue

        await this.renderUpgradeGroup(groupId, label, selectionType, maxSel, appliesTo, appliesCount, groupUpgrades)
      }

      // Handle ungrouped upgrades
      const ungroupedUpgrades = upgrades.filter(u => !u[1] || u[1] === 'NULL' || u[1] === '')
      if (ungroupedUpgrades.length > 0) {
        const ungroupedDiv = document.createElement('div')
        ungroupedDiv.style.cssText = 'margin-top: var(--spacing-scale-3);'

        for (const upgradeLine of ungroupedUpgrades) {
          const upgradeDiv = await this.renderUpgrade(upgradeLine, null, 'pick-any', null)
          ungroupedDiv.appendChild(upgradeDiv)
        }

        this.elements.upgrades.appendChild(ungroupedDiv)
      }
    } catch (error) {
      console.error('Error loading upgrades:', error)
      this.elements.upgradesContainer.style.display = 'none'
    }
  }

  async renderUpgradeGroup(groupId, label, selectionType, maxSel, appliesTo, appliesCount, upgrades) {
    const groupDiv = document.createElement('div')
    groupDiv.style.cssText = 'margin-bottom: var(--spacing-scale-4); padding: var(--spacing-scale-3); background: var(--color-semantic-bg-primary); border-radius: var(--border-radius-md); border: 1px solid var(--color-semantic-border-subtle);'

    // Header
    const headerDiv = document.createElement('div')
    headerDiv.style.cssText = 'margin-bottom: var(--spacing-scale-3); display: flex; justify-content: space-between; align-items: baseline;'

    let headerText = `<span style="font-weight: 600; color: var(--color-semantic-text-primary);">${label}</span>`

    if (appliesTo && appliesTo !== 'NULL') {
      const scope = this.formatAppliesTo(appliesTo, appliesCount)
      headerText += ` <span style="font-weight: normal; color: var(--color-semantic-text-secondary); font-size: var(--font-size-sm);">(${scope})</span>`
    }

    const selectionInfo = selectionType === 'pick-one'
      ? `<span style="color: var(--color-semantic-text-accent); font-size: var(--font-size-sm);">Choose 1</span>`
      : `<span style="color: var(--color-semantic-text-tertiary); font-size: var(--font-size-sm);">Up to ${maxSel || '∞'}</span>`

    headerDiv.innerHTML = `${headerText} ${selectionInfo}`
    groupDiv.appendChild(headerDiv)

    // Render upgrades
    for (const upgradeLine of upgrades) {
      const upgradeDiv = await this.renderUpgrade(upgradeLine, groupId, selectionType, maxSel)
      groupDiv.appendChild(upgradeDiv)
    }

    this.elements.upgrades.appendChild(groupDiv)
  }

  async renderUpgrade(upgradeLine, groupId, selectionType, maxSel) {
    const [id, _groupId, name, cost, description, upgradeType, replacesWeaponId, addsWeaponId, addsSpecialRuleId] = upgradeLine

    const upgradeDiv = document.createElement('label')
    upgradeDiv.style.cssText = 'display: flex; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2); background: var(--color-semantic-bg-secondary); border-radius: var(--border-radius-sm); cursor: pointer; align-items: flex-start; margin-bottom: var(--spacing-scale-1); transition: background 0.15s ease;'
    upgradeDiv.onmouseover = () => upgradeDiv.style.background = 'var(--color-semantic-bg-hover)'
    upgradeDiv.onmouseout = () => upgradeDiv.style.background = 'var(--color-semantic-bg-secondary)'

    // Determine if this is a weapon replacement and calculate real cost
    let displayCost = parseInt(cost)
    let costLabel = ''

    if (upgradeType === 'replace-weapon' && replacesWeaponId && replacesWeaponId !== 'NULL') {
      // This replaces a weapon, so the cost is really the difference
      costLabel = `${cost >= 0 ? '+' : ''}${cost}pts`
    } else {
      costLabel = `${cost >= 0 ? '+' : ''}${cost}pts`
    }

    const inputType = selectionType === 'pick-one' ? 'radio' : 'checkbox'
    const inputName = groupId ? `upgrade-group-${groupId}` : `upgrade-${id}`

    // Process upgrade name and add tooltips
    let displayName = name

    // For add-rule upgrades, extract and wrap special rule with tooltip
    if (upgradeType === 'add-rule' && addsSpecialRuleId && addsSpecialRuleId !== 'NULL') {
      const match = name.match(/^(.+?)\s*\(([^)]+)\)$/)
      if (match) {
        const baseName = match[1]
        const ruleName = match[2]
        const ruleData = this.state.specialRulesCache.get(addsSpecialRuleId)

        if (ruleData) {
          const ruleTooltip = `<abbr data-tooltip="${ruleData.description.replace(/"/g, '&quot;')}" style="text-decoration: underline dotted; cursor: help; color: var(--color-semantic-text-accent);">${ruleName}</abbr>`
          displayName = `${baseName} (${ruleTooltip})`
        }
      }
    }

    // For weapon replacements and attack replacements, wrap weapon properties with tooltips
    if (upgradeType === 'replace-weapon' || upgradeType === 'replace-attacks') {
      // Match patterns like "AP(1)", "Blast(3)", "Deadly(3)", "Rending" within the weapon stats
      displayName = displayName.replace(/\b(AP|Blast|Deadly|Rending|Reliable|Bane|Takedown|Precise|Furious|Shred|Rupture|Unstoppable|Indirect|Strafing)(\((\d+)\))?/g, (match, ruleName, fullRating, rating) => {
        const ruleData = this.state.specialRulesCache.get(ruleName.toLowerCase())
        if (ruleData) {
          const displayText = rating ? `${ruleName}(${rating})` : ruleName
          return `<abbr data-tooltip="${ruleData.description.replace(/"/g, '&quot;')}" style="text-decoration: underline dotted; cursor: help; color: var(--color-semantic-text-accent);">${displayText}</abbr>`
        }
        return match
      })
    }

    const prefix = upgradeType === 'replace-weapon' ? '→ ' : ''

    upgradeDiv.innerHTML = `
      <input type="${inputType}" ${groupId ? `name="${inputName}"` : ''} 
             data-upgrade-id="${id}" 
             data-upgrade-cost="${cost}" 
             data-group-id="${groupId || ''}"
             data-upgrade-type="${upgradeType}"
             data-replaces-weapon="${replacesWeaponId || ''}"
             style="cursor: pointer; margin-top: 2px; flex-shrink: 0;">
      <div style="flex: 1;">
        <div style="font-weight: 500; color: var(--color-semantic-text-primary);">
          ${prefix}${displayName}
          <span style="color: var(--color-semantic-text-accent); margin-left: var(--spacing-scale-1);">${costLabel}</span>
        </div>
        ${description && description !== 'NULL' ? `<div style="font-size: var(--font-size-sm); color: var(--color-semantic-text-secondary); margin-top: var(--spacing-scale-1);">${description}</div>` : ''}
      </div>
    `

    const input = upgradeDiv.querySelector('input')
    input.addEventListener('change', (e) => {
      this.handleUpgradeSelection(e.target, id, groupId, cost, selectionType, maxSel)
    })

    return upgradeDiv
  }

  formatAppliesTo(appliesTo, appliesCount) {
    if (appliesTo === 'one-model') return 'one model'
    if (appliesTo === 'all-models') return 'all models'
    if (appliesTo === 'any-model') return 'any model'
    if (appliesTo === 'up-to-X-models' && appliesCount) return `up to ${appliesCount} models`
    return appliesTo
  }

  handleUpgradeSelection(input, upgradeId, groupId, cost, selectionType, maxSel) {
    const isChecked = input.checked

    if (selectionType === 'pick-one' && groupId) {
      // Radio: clear others in group
      if (isChecked) {
        this.state.selectedUpgrades.forEach(upgrade => {
          if (upgrade.groupId === groupId && upgrade.id !== upgradeId) {
            this.state.selectedUpgrades.delete(upgrade)
          }
        })
        this.state.selectedUpgrades.add({ id: upgradeId, groupId, cost: parseInt(cost) })
      }
    } else {
      // Checkbox: enforce max
      if (isChecked) {
        if (groupId && maxSel) {
          const groupSelections = Array.from(this.state.selectedUpgrades).filter(u => u.groupId === groupId)
          if (groupSelections.length >= parseInt(maxSel)) {
            input.checked = false
            alert(`You can only select up to ${maxSel} upgrades from this group`)
            return
          }
        }
        this.state.selectedUpgrades.add({ id: upgradeId, groupId: groupId || null, cost: parseInt(cost) })
      } else {
        this.state.selectedUpgrades.forEach(upgrade => {
          if (upgrade.id === upgradeId) {
            this.state.selectedUpgrades.delete(upgrade)
          }
        })
      }
    }

    this.updateTotalCost()
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
    if (lines.length <= 1) return []

    return lines.slice(1).map(line => {
      const values = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]

        if (char === '"') {
          // Check if this is an escaped quote ("") inside a quoted field
          if (inQuotes && nextChar === '"') {
            current += '"'  // Add single quote to output
            i++  // Skip the next quote
          } else {
            inQuotes = !inQuotes  // Toggle quote state
          }
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
