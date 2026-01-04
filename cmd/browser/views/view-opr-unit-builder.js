/**
 * OPR Unit Builder View v3
 * Updated for schema v3 with unified equipment design:
 * - Equipment (weapons/items/mounts) from opr_equipment
 * - Upgrade groups with flexible selection (radio/checkbox/counter)
 * - Equipment grants (items → weapons)
 * - All data from database (no hardcoded values)
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
      selectedUpgrades: new Map(), // Map: optionId → { optionId, groupId, equipmentId, cost, count }
      baseCost: 0,
      baseSize: null, // Track current base size
      specialRulesCache: new Map(), // Cache special rule descriptions by ID
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
  }

  async cacheSpecialRules(armyId) {
    try {
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT id, name, description FROM opr_special_rules WHERE army_id = '${armyId}' OR army_id IS NULL`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)

      this.state.specialRulesCache.clear()
      lines.forEach(line => {
        const [id, name, description] = line
        this.state.specialRulesCache.set(id, { name, description })
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

    // Cache special rules for this army
    await this.cacheSpecialRules(armyId)

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
        `SELECT u.id, u.name, u.size, u.cost, u.quality, u.defense, u.unit_type, bs.shape, bs.dimensions
         FROM opr_units u
         LEFT JOIN opr_base_sizes bs ON u.base_size_id = bs.id
         WHERE u.id = '${unitId}'`
      )
      const unitCsv = DE.decode(unitResult.output)

      if (unitResult.returnCode) {
        toast.error(`loadUnitDetails failed: ${unitCsv || 'Unknown error'}`, { duration: 5000 })
        return
      }

      const unitLines = this.parseCSV(unitCsv)
      if (unitLines.length === 0) return

      const [id, name, size, cost, quality, defense, unitType, baseShape, baseDimensions] = unitLines[0]
      this.state.baseCost = parseInt(cost)
      this.state.baseSize = baseShape && baseDimensions && baseShape !== 'NULL' 
        ? `${baseDimensions} ${baseShape}` 
        : null

      // Update unit header
      this.elements.unitName.textContent = name
      this.elements.unitSize.textContent = size
      this.elements.unitCost.textContent = cost
      this.elements.unitQuality.textContent = `${quality}+`
      this.elements.unitDefense.textContent = `${defense}+`
      this.elements.unitType.textContent = unitType

      // Load special rules (including Tough)
      await this.loadSpecialRules(unitId)

      // Load equipment (weapons/items/mounts)
      await this.loadEquipment(unitId)

      // Load equipment grants (items that include weapons)
      await this.loadEquipmentGrants(unitId)

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

  async loadEquipment(unitId) {
    try {
      // Get equipment (weapons/items/mounts) with special rules
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT 
           e.id, 
           e.name, 
           e.type,
           e.range, 
           e.attacks, 
           ue.count,
           GROUP_CONCAT(
             CASE 
               WHEN esr.rating > 0 
               THEN sr.name || '(' || esr.rating || ')'
               ELSE sr.name
             END,
             ', '
           ) as special_rules
         FROM opr_unit_equipment ue
         JOIN opr_equipment e ON ue.equipment_id = e.id
         LEFT JOIN opr_equipment_special_rules esr ON e.id = esr.equipment_id
         LEFT JOIN opr_special_rules sr ON esr.special_rule_id = sr.id
         WHERE ue.unit_id = '${unitId}'
         GROUP BY e.id, e.name, e.type, e.range, e.attacks, ue.count
         ORDER BY 
           CASE e.type 
             WHEN 'weapon' THEN 1 
             WHEN 'item' THEN 2 
             WHEN 'mount' THEN 3 
             ELSE 4 
           END,
           e.range DESC, 
           e.name`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)

      if (lines.length === 0) {
        this.elements.weaponsContainer.style.display = 'none'
        return
      }

      this.elements.weaponsContainer.style.display = 'block'
      this.elements.weapons.innerHTML = ''

      // Group equipment by type
      const weapons = []
      const items = []
      const mounts = []
      const other = []

      lines.forEach(line => {
        const [equipId, name, type, range, attacks, count, specialRulesStr] = line
        const equipData = { equipId, name, type, range, attacks, count, specialRulesStr }
        
        if (type === 'weapon' || (!type || type === 'NULL')) {
          weapons.push(equipData)
        } else if (type === 'item') {
          items.push(equipData)
        } else if (type === 'mount') {
          mounts.push(equipData)
        } else {
          other.push(equipData)
        }
      })

      // Render weapons table
      if (weapons.length > 0) {
        this.renderEquipmentTable('Weapons', weapons, true)
      }

      // Render items table (without weapon columns)
      if (items.length > 0) {
        this.renderEquipmentTable('Items', items, false)
      }

      // Render mounts table
      if (mounts.length > 0) {
        this.renderEquipmentTable('Mounts', mounts, false)
      }

      // Render other equipment
      if (other.length > 0) {
        this.renderEquipmentTable('Equipment', other, false)
      }
    } catch (error) {
      console.error('Error loading equipment:', error)
      this.elements.weaponsContainer.style.display = 'none'
    }
  }

  async loadEquipmentGrants(unitId) {
    try {
      // Get equipment that grants other equipment (e.g., Combat Shield grants Bash)
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT 
           parent.name as parent_name,
           granted.name as granted_name,
           granted.type as granted_type,
           granted.range as granted_range,
           granted.attacks as granted_attacks,
           eg.count,
           GROUP_CONCAT(
             CASE 
               WHEN esr.rating > 0 
               THEN sr.name || '(' || esr.rating || ')'
               ELSE sr.name
             END,
             ', '
           ) as special_rules
         FROM opr_equipment_grants eg
         JOIN opr_equipment parent ON eg.parent_equipment_id = parent.id
         JOIN opr_equipment granted ON eg.granted_equipment_id = granted.id
         LEFT JOIN opr_equipment_special_rules esr ON granted.id = esr.equipment_id
         LEFT JOIN opr_special_rules sr ON esr.special_rule_id = sr.id
         WHERE eg.parent_equipment_id IN (
           SELECT equipment_id 
           FROM opr_unit_equipment 
           WHERE unit_id = '${unitId}'
         )
         GROUP BY parent.name, granted.name, granted.type, granted.range, granted.attacks, eg.count
         ORDER BY parent.name, granted.name`
      )
      const csv = DE.decode(result.output)
      const lines = this.parseCSV(csv)

      if (lines.length === 0) return

      // Render granted equipment section
      const grantedDiv = document.createElement('div')
      grantedDiv.style.cssText = 'margin-bottom: var(--spacing-scale-3);'

      let tableHTML = `
        <div style="font-weight: 600; margin-bottom: var(--spacing-scale-2); color: var(--color-semantic-text-primary);">Granted Equipment</div>
        <table style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm);">
          <thead>
            <tr style="border-bottom: 2px solid var(--color-semantic-border-default);">
              <th style="text-align: left; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">From</th>
              <th style="text-align: left; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">Grants</th>
              <th style="text-align: center; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">RNG</th>
              <th style="text-align: center; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">ATK</th>
              <th style="text-align: left; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">SPE</th>
            </tr>
          </thead>
          <tbody>
      `

      lines.forEach(line => {
        const [parentName, grantedName, grantedType, range, attacks, count, specialRulesStr] = line

        const hasRange = range && range !== '' && range !== 'NULL' && range !== '0'
        const rangeText = hasRange ? `${range}"` : '-'
        const attacksText = attacks && attacks !== '' && attacks !== 'NULL' && attacks !== '0' ? `A${attacks}` : '-'

        // Build special rules with tooltips
        let specialRulesHTML = '-'
        if (specialRulesStr && specialRulesStr !== 'NULL' && specialRulesStr !== '') {
          const rules = specialRulesStr.split(', ')
          const ruleElements = rules.map(ruleText => {
            const match = ruleText.match(/^(.+?)(?:\((\d+)\))?$/)
            if (!match) return ruleText
            
            const [_, ruleName, rating] = match
            
            let ruleData = null
            for (const [key, value] of this.state.specialRulesCache.entries()) {
              if (value.name === ruleName) {
                ruleData = value
                break
              }
            }
            
            if (ruleData) {
              return `<abbr data-tooltip="${ruleData.description.replace(/"/g, '&quot;')}" style="text-decoration: underline dashed; text-underline-offset: 4px; cursor: help;">${ruleText}</abbr>`
            }
            return ruleText
          })
          
          specialRulesHTML = ruleElements.join(', ')
        }

        tableHTML += `
          <tr style="border-bottom: 1px solid var(--color-semantic-border-subtle);">
            <td style="padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-tertiary); font-style: italic;">${parentName}</td>
            <td style="padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-primary);">${grantedName}</td>
            <td style="text-align: center; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">${rangeText}</td>
            <td style="text-align: center; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">${attacksText}</td>
            <td style="padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">${specialRulesHTML}</td>
          </tr>
        `
      })

      tableHTML += `
          </tbody>
        </table>
      `

      grantedDiv.innerHTML = tableHTML
      this.elements.weapons.appendChild(grantedDiv)
    } catch (error) {
      console.error('Error loading equipment grants:', error)
    }
  }

  renderEquipmentTable(title, equipmentList, isWeapon) {
    const tableDiv = document.createElement('div')
    tableDiv.style.cssText = 'margin-bottom: var(--spacing-scale-3);'

    let tableHTML = `
      <div style="font-weight: 600; margin-bottom: var(--spacing-scale-2); color: var(--color-semantic-text-primary);">${title}</div>
      <table style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm);">
        <thead>
          <tr style="border-bottom: 2px solid var(--color-semantic-border-default);">
            <th style="text-align: left; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">${isWeapon ? 'Weapon' : 'Name'}</th>
    `

    if (isWeapon) {
      tableHTML += `
            <th style="text-align: center; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">RNG</th>
            <th style="text-align: center; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">ATK</th>
      `
    }

    tableHTML += `
            <th style="text-align: left; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">SPE</th>
          </tr>
        </thead>
        <tbody>
    `

    equipmentList.forEach(equip => {
      const { name, range, attacks, count, specialRulesStr } = equip
      
      const hasRange = range && range !== '' && range !== 'NULL' && range !== '0'
      const rangeText = hasRange ? `${range}"` : '-'
      const attacksText = attacks && attacks !== '' && attacks !== 'NULL' && attacks !== '0' ? `A${attacks}` : '-'

      // Build special rules with tooltips
      let specialRulesHTML = '-'
      if (specialRulesStr && specialRulesStr !== 'NULL' && specialRulesStr !== '') {
        const rules = specialRulesStr.split(', ')
        const ruleElements = rules.map(ruleText => {
          // Parse "RuleName" or "RuleName(X)"
          const match = ruleText.match(/^(.+?)(?:\((\d+)\))?$/)
          if (!match) return ruleText
          
          const [_, ruleName, rating] = match
          
          // Find in cache by name
          let ruleData = null
          for (const [key, value] of this.state.specialRulesCache.entries()) {
            if (value.name === ruleName) {
              ruleData = value
              break
            }
          }
          
          if (ruleData) {
            return `<abbr data-tooltip="${ruleData.description.replace(/"/g, '&quot;')}" style="text-decoration: underline dashed; text-underline-offset: 4px; cursor: help;">${ruleText}</abbr>`
          }
          return ruleText
        })
        
        specialRulesHTML = ruleElements.join(', ')
      }

      tableHTML += `
          <tr style="border-bottom: 1px solid var(--color-semantic-border-subtle);">
            <td style="padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-primary);">${name}</td>
      `

      if (isWeapon) {
        tableHTML += `
            <td style="text-align: center; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">${rangeText}</td>
            <td style="text-align: center; padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">${attacksText}</td>
        `
      }

      tableHTML += `
            <td style="padding: var(--spacing-scale-1) var(--spacing-scale-2); color: var(--color-semantic-text-secondary);">${specialRulesHTML}</td>
          </tr>
      `
    })

    tableHTML += `
        </tbody>
      </table>
    `

    tableDiv.innerHTML = tableHTML
    this.elements.weapons.appendChild(tableDiv)
  }

  async loadUpgrades(unitId) {
    try {
      // Load upgrade groups with what they replace
      const groupsResult = await window.pluginManager.call('sql', 'query',
        `SELECT 
           ug.id,
           ug.label,
           ug.select_min,
           ug.select_max,
           ug.affects,
           ug.affects_count,
           ug.sort_order,
           GROUP_CONCAT(e_replace.name, ', ') as replaces_equipment_names
         FROM opr_upgrade_groups ug
         LEFT JOIN opr_upgrade_group_replaces ugr ON ug.id = ugr.group_id
         LEFT JOIN opr_equipment e_replace ON ugr.equipment_id = e_replace.id
         WHERE ug.unit_id = '${unitId}'
         GROUP BY ug.id
         ORDER BY ug.sort_order`
      )
      const groupsCsv = DE.decode(groupsResult.output)
      const groups = this.parseCSV(groupsCsv)

      if (groups.length === 0) {
        this.elements.upgradesContainer.style.display = 'none'
        return
      }

      this.elements.upgradesContainer.style.display = 'block'
      this.elements.upgrades.innerHTML = ''
      this.state.selectedUpgrades.clear()

      // Render each group
      for (const groupLine of groups) {
        const [groupId, label, selectMin, selectMax, affects, affectsCount, sortOrder, replacesNames] = groupLine

        // Load options for this group
        const optionsResult = await window.pluginManager.call('sql', 'query',
          `SELECT 
             uo.id,
             uo.equipment_id,
             uo.cost,
             uo.overrides_base_size_id,
             uo.sort_order,
             e.name,
             e.type,
             e.range,
             e.attacks,
             bs.shape as new_base_shape,
             bs.dimensions as new_base_dimensions,
             GROUP_CONCAT(
               CASE 
                 WHEN esr.rating > 0 
                 THEN sr.name || '(' || esr.rating || ')'
                 ELSE sr.name
               END,
               ', '
             ) as special_rules
           FROM opr_upgrade_options uo
           JOIN opr_equipment e ON uo.equipment_id = e.id
           LEFT JOIN opr_base_sizes bs ON uo.overrides_base_size_id = bs.id
           LEFT JOIN opr_equipment_special_rules esr ON e.id = esr.equipment_id
           LEFT JOIN opr_special_rules sr ON esr.special_rule_id = sr.id
           WHERE uo.group_id = '${groupId}'
           GROUP BY uo.id
           ORDER BY uo.sort_order`
        )
        const optionsCsv = DE.decode(optionsResult.output)
        const options = this.parseCSV(optionsCsv)

        if (options.length > 0) {
          this.renderUpgradeGroup(groupId, label, selectMin, selectMax, affects, affectsCount, replacesNames, options)
        }
      }
    } catch (error) {
      console.error('Error loading upgrades:', error)
      this.elements.upgradesContainer.style.display = 'none'
    }
  }

  renderUpgradeGroup(groupId, label, selectMin, selectMax, affects, affectsCount, replacesNames, options) {
    const groupDiv = document.createElement('div')
    groupDiv.style.cssText = 'margin-bottom: var(--spacing-scale-4); padding: var(--spacing-scale-3); background: var(--color-semantic-bg-primary); border-radius: var(--border-radius-md); border: 1px solid var(--color-semantic-border-subtle);'

    // Determine selection mode
    const isRadio = selectMax === '1'
    const isUnlimited = !selectMax || selectMax === 'NULL'
    const isCounter = !isRadio && !isUnlimited && parseInt(selectMax) > 1

    // Header
    const headerDiv = document.createElement('div')
    headerDiv.style.cssText = 'margin-bottom: var(--spacing-scale-3);'

    let headerText = `<div style="font-weight: 600; color: var(--color-semantic-text-primary); margin-bottom: var(--spacing-scale-1);">${label}</div>`

    // Selection info
    let selectionInfo = ''
    if (isRadio) {
      selectionInfo = '<span style="color: var(--color-semantic-text-accent); font-size: var(--font-size-sm);">Choose 1</span>'
    } else if (isUnlimited) {
      selectionInfo = '<span style="color: var(--color-semantic-text-tertiary); font-size: var(--font-size-sm);">Any amount</span>'
    } else {
      selectionInfo = `<span style="color: var(--color-semantic-text-tertiary); font-size: var(--font-size-sm);">Up to ${selectMax} total</span>`
    }

    // Affects scope
    let scopeInfo = ''
    if (affects && affects !== 'NULL') {
      const scope = this.formatAppliesTo(affects, affectsCount)
      scopeInfo = ` <span style="color: var(--color-semantic-text-secondary); font-size: var(--font-size-sm);">(${scope})</span>`
    }

    // Replaces info
    let replacesInfo = ''
    if (replacesNames && replacesNames !== 'NULL') {
      replacesInfo = `<div style="font-size: var(--font-size-sm); color: var(--color-semantic-text-secondary); font-style: italic;">Replaces: ${replacesNames}</div>`
    }

    headerDiv.innerHTML = `${headerText}<div>${selectionInfo}${scopeInfo}</div>${replacesInfo}`
    groupDiv.appendChild(headerDiv)

    // Render options based on selection mode
    if (isRadio) {
      // Radio buttons
      options.forEach(optionLine => {
        const optionDiv = this.renderUpgradeOption(optionLine, groupId, 'radio')
        groupDiv.appendChild(optionDiv)
      })
    } else if (isUnlimited) {
      // Checkboxes
      options.forEach(optionLine => {
        const optionDiv = this.renderUpgradeOption(optionLine, groupId, 'checkbox')
        groupDiv.appendChild(optionDiv)
      })
    } else {
      // Counter controls
      options.forEach(optionLine => {
        const optionDiv = this.renderUpgradeOption(optionLine, groupId, 'counter', selectMax)
        groupDiv.appendChild(optionDiv)
      })
    }

    this.elements.upgrades.appendChild(groupDiv)
  }

  renderUpgradeOption(optionLine, groupId, mode, maxCount = null) {
    const [optionId, equipmentId, cost, overridesBaseSize, sortOrder, name, type, range, attacks, newBaseShape, newBaseDimensions, specialRulesStr] = optionLine

    const optionDiv = document.createElement('div')
    optionDiv.style.cssText = 'padding: var(--spacing-scale-2); background: var(--color-semantic-bg-secondary); border-radius: var(--border-radius-sm); margin-bottom: var(--spacing-scale-1);'
    optionDiv.dataset.optionId = optionId
    optionDiv.dataset.groupId = groupId

    // Build equipment display with stats
    let equipmentDisplay = `<span style="font-weight: 500; color: var(--color-semantic-text-primary);">${name}</span>`
    
    // Add weapon stats if applicable
    if ((type === 'weapon' || !type || type === 'NULL') && (range || attacks)) {
      const rangeText = range && range !== 'NULL' && range !== '0' ? `${range}"` : 'Melee'
      const attacksText = attacks && attacks !== 'NULL' && attacks !== '0' ? `A${attacks}` : ''
      equipmentDisplay += ` <span style="font-size: var(--font-size-sm); color: var(--color-semantic-text-tertiary);">(${rangeText}${attacksText ? ', ' + attacksText : ''})</span>`
    }

    // Add special rules with tooltips
    if (specialRulesStr && specialRulesStr !== 'NULL') {
      const rules = specialRulesStr.split(', ')
      const ruleElements = rules.map(ruleText => {
        const match = ruleText.match(/^(.+?)(?:\((\d+)\))?$/)
        if (!match) return ruleText
        
        const [_, ruleName, rating] = match
        
        let ruleData = null
        for (const [key, value] of this.state.specialRulesCache.entries()) {
          if (value.name === ruleName) {
            ruleData = value
            break
          }
        }
        
        if (ruleData) {
          return `<abbr data-tooltip="${ruleData.description.replace(/"/g, '&quot;')}" style="text-decoration: underline dashed; text-underline-offset: 4px; cursor: help;">${ruleText}</abbr>`
        }
        return ruleText
      })
      
      equipmentDisplay += ` <span style="font-size: var(--font-size-sm); color: var(--color-semantic-text-secondary);">${ruleElements.join(', ')}</span>`
    }

    // Base size override badge
    let baseSizeBadge = ''
    if (overridesBaseSize && overridesBaseSize !== 'NULL' && newBaseShape && newBaseDimensions) {
      baseSizeBadge = ` <span style="display: inline-block; padding: 2px 6px; background: var(--color-semantic-bg-accent); color: var(--color-semantic-text-on-accent); font-size: var(--font-size-xs); border-radius: var(--border-radius-sm);">⭘ ${newBaseDimensions} ${newBaseShape}</span>`
    }

    // Cost display
    const costLabel = `<span style="color: var(--color-semantic-text-accent); margin-left: var(--spacing-scale-2);">${cost >= 0 ? '+' : ''}${cost}pts</span>`

    if (mode === 'radio') {
      optionDiv.innerHTML = `
        <label style="display: flex; gap: var(--spacing-scale-2); align-items: center; cursor: pointer;">
          <input type="radio" name="upgrade-group-${groupId}" 
                 data-option-id="${optionId}" 
                 data-equipment-id="${equipmentId}"
                 data-cost="${cost}"
                 style="cursor: pointer;">
          <div style="flex: 1;">
            ${equipmentDisplay}${baseSizeBadge}${costLabel}
          </div>
        </label>
      `
      
      const input = optionDiv.querySelector('input')
      input.addEventListener('change', () => {
        if (input.checked) {
          this.handleUpgradeSelection(groupId, optionId, equipmentId, parseInt(cost), 1, 'radio')
        }
      })
    } else if (mode === 'checkbox') {
      optionDiv.innerHTML = `
        <label style="display: flex; gap: var(--spacing-scale-2); align-items: center; cursor: pointer;">
          <input type="checkbox"
                 data-option-id="${optionId}"
                 data-equipment-id="${equipmentId}"
                 data-cost="${cost}"
                 style="cursor: pointer;">
          <div style="flex: 1;">
            ${equipmentDisplay}${baseSizeBadge}${costLabel}
          </div>
        </label>
      `
      
      const input = optionDiv.querySelector('input')
      input.addEventListener('change', () => {
        this.handleUpgradeSelection(groupId, optionId, equipmentId, parseInt(cost), input.checked ? 1 : 0, 'checkbox')
      })
    } else if (mode === 'counter') {
      optionDiv.innerHTML = `
        <div style="display: flex; gap: var(--spacing-scale-2); align-items: center;">
          <div style="flex: 1;">
            ${equipmentDisplay}${baseSizeBadge}${costLabel}
          </div>
          <div style="display: flex; gap: var(--spacing-scale-1); align-items: center;">
            <button type="button" data-action="decrement" 
                    style="width: 28px; height: 28px; border: 1px solid var(--color-semantic-border-default); background: var(--color-semantic-bg-primary); color: var(--color-semantic-text-primary); border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 600;">−</button>
            <span data-element="count" style="min-width: 20px; text-align: center; font-weight: 500;">0</span>
            <span style="color: var(--color-semantic-text-tertiary);">/ ${maxCount}</span>
            <button type="button" data-action="increment"
                    style="width: 28px; height: 28px; border: 1px solid var(--color-semantic-border-default); background: var(--color-semantic-bg-primary); color: var(--color-semantic-text-primary); border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 600;">+</button>
          </div>
        </div>
      `
      
      const decrementBtn = optionDiv.querySelector('[data-action="decrement"]')
      const incrementBtn = optionDiv.querySelector('[data-action="increment"]')
      const countSpan = optionDiv.querySelector('[data-element="count"]')
      
      decrementBtn.addEventListener('click', () => {
        const currentCount = parseInt(countSpan.textContent)
        if (currentCount > 0) {
          const newCount = currentCount - 1
          countSpan.textContent = newCount
          this.handleUpgradeSelection(groupId, optionId, equipmentId, parseInt(cost), newCount, 'counter', maxCount)
        }
      })
      
      incrementBtn.addEventListener('click', () => {
        const currentCount = parseInt(countSpan.textContent)
        const groupTotal = this.getGroupTotal(groupId)
        if (groupTotal < parseInt(maxCount)) {
          const newCount = currentCount + 1
          countSpan.textContent = newCount
          this.handleUpgradeSelection(groupId, optionId, equipmentId, parseInt(cost), newCount, 'counter', maxCount)
        }
      })
    }

    return optionDiv
  }

  formatAppliesTo(affects, affectsCount) {
    if (affects === 'one-model') return 'one model'
    if (affects === 'all-models') return 'all models'
    if (affects === 'any-model') return 'any model'
    if (affects === 'up-to-X' && affectsCount) return `up to ${affectsCount} models`
    return affects
  }

  getGroupTotal(groupId) {
    let total = 0
    for (const [optionId, data] of this.state.selectedUpgrades.entries()) {
      if (data.groupId === groupId) {
        total += data.count
      }
    }
    return total
  }

  handleUpgradeSelection(groupId, optionId, equipmentId, cost, count, mode, maxCount = null) {
    if (mode === 'radio') {
      // Clear other selections in this group
      for (const [key, data] of this.state.selectedUpgrades.entries()) {
        if (data.groupId === groupId) {
          this.state.selectedUpgrades.delete(key)
        }
      }
      
      // Add this selection
      if (count > 0) {
        this.state.selectedUpgrades.set(optionId, {
          optionId,
          groupId,
          equipmentId,
          cost,
          count
        })
      }
    } else if (mode === 'checkbox') {
      if (count > 0) {
        this.state.selectedUpgrades.set(optionId, {
          optionId,
          groupId,
          equipmentId,
          cost,
          count
        })
      } else {
        this.state.selectedUpgrades.delete(optionId)
      }
    } else if (mode === 'counter') {
      // Check group total limit
      const groupTotal = this.getGroupTotal(groupId)
      const currentSelection = this.state.selectedUpgrades.get(optionId)
      const currentCount = currentSelection ? currentSelection.count : 0
      const newTotal = groupTotal - currentCount + count
      
      if (newTotal > parseInt(maxCount)) {
        toast.error(`Cannot exceed ${maxCount} total selections in this group`, { duration: 3000 })
        return
      }
      
      if (count > 0) {
        this.state.selectedUpgrades.set(optionId, {
          optionId,
          groupId,
          equipmentId,
          cost,
          count
        })
      } else {
        this.state.selectedUpgrades.delete(optionId)
      }
    }

    this.updateTotalCost()
  }

  updateTotalCost() {
    let total = this.state.baseCost
    for (const [optionId, data] of this.state.selectedUpgrades.entries()) {
      total += data.cost * data.count
    }
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
      toast.error('No unit selected', { duration: 3000 })
      return
    }

    const upgrades = []
    for (const [optionId, data] of this.state.selectedUpgrades.entries()) {
      upgrades.push({
        optionId: data.optionId,
        equipmentId: data.equipmentId,
        cost: data.cost,
        count: data.count
      })
    }

    const data = {
      unitId: this.state.selectedUnit,
      unitName: this.elements.unitName.textContent,
      size: this.elements.unitSize.textContent,
      baseCost: this.state.baseCost,
      quality: this.elements.unitQuality.textContent,
      defense: this.elements.unitDefense.textContent,
      type: this.elements.unitType.textContent,
      baseSize: this.state.baseSize,
      selectedUpgrades: upgrades,
      totalCost: parseInt(this.elements.totalCost.textContent)
    }

    console.log('Unit JSON:', JSON.stringify(data, null, 2))
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast.success('Unit JSON copied to clipboard!', { duration: 3000 })
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
