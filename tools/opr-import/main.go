package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
)

// ============================================================================
// OPR API Data Structures
// ============================================================================

type ArmyBook struct {
	UID             string           `json:"uid"`
	Name            string           `json:"name"`
	GameSystemID    int              `json:"gameSystemId"`
	VersionString   string           `json:"versionString"`
	Background      string           `json:"background"`
	Units           []Unit           `json:"units"`
	SpecialRules    []SpecialRule    `json:"specialRules"`
	UpgradePackages []UpgradePackage `json:"upgradePackages"`
}

type Unit struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Size     int      `json:"size"`
	Cost     int      `json:"cost"`
	Quality  int      `json:"quality"`
	Defense  int      `json:"defense"`
	Weapons  []Weapon `json:"weapons"`
	Items    []Item   `json:"items"`
	Rules    []Rule   `json:"rules"`
	Upgrades []string `json:"upgrades"` // Array of upgrade package UIDs
}

type Weapon struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Count        int    `json:"count"`
	Range        int    `json:"range"`
	Attacks      int    `json:"attacks"`
	SpecialRules []Rule `json:"specialRules"`
}

type Item struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Count   int       `json:"count"`
	Content []Content `json:"content"`
}

type Content struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"` // ArmyBookWeapon, ArmyBookRule
	Range   int    `json:"range"`
	Attacks int    `json:"attacks"`
	Rating  int    `json:"rating"`
}

type Rule struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Rating int    `json:"rating"`
}

type SpecialRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpgradePackage struct {
	UID      string    `json:"uid"`
	Hint     string    `json:"hint"`
	Sections []Section `json:"sections"`
}

type Section struct {
	ID      string   `json:"id"`
	UID     string   `json:"uid"`
	Label   string   `json:"label"`
	Variant string   `json:"variant"` // replace, upgrade, attachment
	Targets []string `json:"targets"`
	Options []Option `json:"options"`
	Select  *struct {
		Type  string `json:"type"` // exactly, up to
		Value int    `json:"value"`
	} `json:"select"`
}

type Option struct {
	ID    string `json:"id"`
	UID   string `json:"uid"`
	Label string `json:"label"`
	Cost  int    `json:"cost"`
	Costs []struct {
		Cost   int    `json:"cost"`
		UnitID string `json:"unitId"`
	} `json:"costs"`
	Gains []Gains `json:"gains"`
}

type Gains struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Type         string  `json:"type"` // ArmyBookWeapon, ArmyBookRule, ArmyBookItem
	Range        int     `json:"range"`
	Attacks      int     `json:"attacks"`
	Rating       int     `json:"rating"`
	Count        int     `json:"count"`
	SpecialRules []Rule  `json:"specialRules"`
	Content      []Gains `json:"content"`
}

// ============================================================================
// SQL Generation
// ============================================================================

type SQLGenerator struct {
	armyID          string
	universeID      string
	equipmentMap    map[string]*EquipmentDef
	specialRules    map[string]*SpecialRule
	upgradePackages map[string]*UpgradePackage
	sortOrder       int
}

type EquipmentDef struct {
	ID           string
	Name         string
	Type         string // weapon, item, mount
	Range        int
	Attacks      int
	SpecialRules []RuleDef
	Grants       []string // IDs of granted equipment
}

type RuleDef struct {
	ID     string
	Rating int
}

func NewSQLGenerator(universeID, armyID string) *SQLGenerator {
	return &SQLGenerator{
		armyID:          armyID,
		universeID:      universeID,
		equipmentMap:    make(map[string]*EquipmentDef),
		specialRules:    make(map[string]*SpecialRule),
		upgradePackages: make(map[string]*UpgradePackage),
	}
}

func (g *SQLGenerator) Generate(book *ArmyBook) string {
	var b strings.Builder

	b.WriteString("-- ============================================================================\n")
	b.WriteString(fmt.Sprintf("-- Army: %s\n", book.Name))
	b.WriteString(fmt.Sprintf("-- Generated from OPR API\n"))
	b.WriteString("-- ============================================================================\n\n")

	// 1. Universe
	b.WriteString(g.generateUniverse())

	// 2. Army
	b.WriteString(g.generateArmy(book))

	// 3. Special Rules
	b.WriteString(g.generateSpecialRules(book))

	// 4. Process all equipment
	g.processAllEquipment(book)

	// 5. Generate equipment SQL
	b.WriteString(g.generateEquipment())

	// 6. Store upgrade packages
	for _, pkg := range book.UpgradePackages {
		g.upgradePackages[pkg.UID] = &pkg
	}

	// 7. Units
	b.WriteString(g.generateUnits(book))

	return b.String()
}

func (g *SQLGenerator) generateUniverse() string {
	var b strings.Builder
	b.WriteString("-- Universe\n")
	b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_universes (id, name) VALUES ('%s', '%s');\n\n",
		g.universeID, toTitle(g.universeID)))
	return b.String()
}

func (g *SQLGenerator) generateArmy(book *ArmyBook) string {
	var b strings.Builder
	b.WriteString("-- Army\n")
	b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_armies (id, universe_id, name, version, background) VALUES\n"))
	b.WriteString(fmt.Sprintf("  ('%s', '%s', %s, %s, %s);\n\n",
		g.armyID,
		g.universeID,
		sqlString(book.Name),
		sqlString(book.VersionString),
		sqlString(book.Background)))
	return b.String()
}

func (g *SQLGenerator) generateSpecialRules(book *ArmyBook) string {
	var b strings.Builder
	b.WriteString("-- Special Rules\n")

	for _, rule := range book.SpecialRules {
		ruleID := slugify(g.armyID + "-" + rule.Name)
		g.specialRules[rule.Name] = &SpecialRule{
			ID:          ruleID,
			Name:        rule.Name,
			Description: rule.Description,
		}
		b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES\n"))
		b.WriteString(fmt.Sprintf("  ('%s', %s, %s, '%s');\n",
			ruleID, sqlString(rule.Name), sqlString(rule.Description), g.armyID))
	}
	b.WriteString("\n")
	return b.String()
}

func (g *SQLGenerator) processAllEquipment(book *ArmyBook) {
	// Process base equipment from units
	for _, unit := range book.Units {
		// Weapons
		for _, weapon := range unit.Weapons {
			g.addEquipment(weapon.Name, "weapon", weapon.Range, weapon.Attacks, weapon.SpecialRules, nil)
		}

		// Items
		for _, item := range unit.Items {
			var grants []string
			for _, content := range item.Content {
				if content.Type == "ArmyBookWeapon" {
					subID := g.addEquipment(content.Name, "weapon", content.Range, content.Attacks, nil, nil)
					grants = append(grants, subID)
				}
			}
			g.addEquipmentWithGrants(item.Name, "item", 0, 0, nil, grants)
		}
	}

	// Process upgrade equipment
	for _, pkg := range book.UpgradePackages {
		for _, section := range pkg.Sections {
			for _, option := range section.Options {
				for _, gain := range option.Gains {
					g.processGain(gain)
				}
			}
		}
	}
}

func (g *SQLGenerator) processGain(gain Gains) {
	equipType := "weapon"
	if gain.Type == "ArmyBookItem" {
		equipType = "item"
	} else if gain.Type == "ArmyBookRule" {
		return // Rules are handled separately
	}

	// Check if it's a mount/item (contains weapons/rules)
	var grants []string
	if len(gain.Content) > 0 {
		if equipType == "item" {
			equipType = "mount"
		}
		for _, content := range gain.Content {
			if content.Type == "ArmyBookWeapon" {
				subID := g.addEquipment(content.Name, "weapon", content.Range, content.Attacks, nil, nil)
				grants = append(grants, subID)
			}
		}
	}

	g.addEquipment(gain.Name, equipType, gain.Range, gain.Attacks, gain.SpecialRules, grants)
}

func (g *SQLGenerator) addEquipment(name, equipType string, rng, attacks int, specialRules []Rule, grants []string) string {
	return g.addEquipmentWithGrants(name, equipType, rng, attacks, specialRules, grants)
}

func (g *SQLGenerator) addEquipmentWithGrants(name, equipType string, rng, attacks int, specialRules []Rule, grants []string) string {
	// Clean name (remove special rule annotations in parentheses for ID)
	cleanName := regexp.MustCompile(`\s*\([^)]*\)`).ReplaceAllString(name, "")
	cleanName = strings.TrimSpace(cleanName)
	eqID := slugify(g.armyID + "-" + cleanName)

	if _, exists := g.equipmentMap[eqID]; exists {
		return eqID
	}

	var rules []RuleDef
	for _, rule := range specialRules {
		ruleID := g.getRuleID(rule.Name)
		rules = append(rules, RuleDef{ID: ruleID, Rating: rule.Rating})
	}

	g.equipmentMap[eqID] = &EquipmentDef{
		ID:           eqID,
		Name:         cleanName,
		Type:         equipType,
		Range:        rng,
		Attacks:      attacks,
		SpecialRules: rules,
		Grants:       grants,
	}

	return eqID
}

func (g *SQLGenerator) getRuleID(ruleName string) string {
	// Try to find in army rules first
	if rule, exists := g.specialRules[ruleName]; exists {
		return rule.ID
	}
	// Otherwise create a universal rule ID
	return slugify("universal-" + ruleName)
}

func (g *SQLGenerator) generateEquipment() string {
	var b strings.Builder
	b.WriteString("-- Equipment\n")

	// Sort for consistent output
	var ids []string
	for id := range g.equipmentMap {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	for _, id := range ids {
		eq := g.equipmentMap[id]
		b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES\n"))
		b.WriteString(fmt.Sprintf("  ('%s', '%s', %s, %s, %d, %d);\n",
			eq.ID, g.armyID, sqlString(eq.Name), sqlString(eq.Type), eq.Range, eq.Attacks))

		// Equipment special rules
		for _, rule := range eq.SpecialRules {
			b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES\n"))
			b.WriteString(fmt.Sprintf("  ('%s', '%s', %d);\n", eq.ID, rule.ID, rule.Rating))
		}

		// Equipment grants
		for _, grantID := range eq.Grants {
			b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_equipment_grants (parent_equipment_id, granted_equipment_id) VALUES\n"))
			b.WriteString(fmt.Sprintf("  ('%s', '%s');\n", eq.ID, grantID))
		}
	}

	b.WriteString("\n")
	return b.String()
}

func (g *SQLGenerator) generateUnits(book *ArmyBook) string {
	var b strings.Builder
	b.WriteString("-- Units\n")

	for _, unit := range book.Units {
		unitID := slugify(g.armyID + "-" + unit.Name)
		unitType := classifyUnitType(unit)

		b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES\n"))
		b.WriteString(fmt.Sprintf("  ('%s', '%s', %s, %d, %d, %d, %d, '%s');\n",
			unitID, g.armyID, sqlString(unit.Name), unit.Size, unit.Cost, unit.Quality, unit.Defense, unitType))

		// Unit special rules
		for _, rule := range unit.Rules {
			ruleID := g.getRuleID(rule.Name)
			b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES\n"))
			b.WriteString(fmt.Sprintf("  ('%s', '%s', %d);\n", unitID, ruleID, rule.Rating))
		}

		// Unit weapons
		for _, weapon := range unit.Weapons {
			eqID := slugify(g.armyID + "-" + weapon.Name)
			b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES\n"))
			b.WriteString(fmt.Sprintf("  ('%s', '%s', %d);\n", unitID, eqID, max(1, weapon.Count)))
		}

		// Unit items
		for _, item := range unit.Items {
			eqID := slugify(g.armyID + "-" + item.Name)
			b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES\n"))
			b.WriteString(fmt.Sprintf("  ('%s', '%s', %d);\n", unitID, eqID, max(1, item.Count)))
		}

		// Upgrades
		g.sortOrder = 0
		for _, packageUID := range unit.Upgrades {
			if pkg, exists := g.upgradePackages[packageUID]; exists {
				b.WriteString(g.generateUpgrade(unitID, unit.ID, pkg))
			}
		}

		b.WriteString("\n")
	}

	return b.String()
}

func (g *SQLGenerator) generateUpgrade(unitID, unitAPIID string, pkg *UpgradePackage) string {
	var b strings.Builder

	for _, section := range pkg.Sections {
		g.sortOrder++
		groupID := fmt.Sprintf("%s-grp-%d", unitID, g.sortOrder)

		// Determine affects
		affects := "one-model"
		if section.Select != nil {
			if section.Select.Type == "exactly" {
				affects = "exactly"
			} else if section.Select.Type == "up to" {
				affects = "up-to-X"
			}
		}

		selectMax := 1
		affectsCount := 1
		if section.Select != nil {
			selectMax = section.Select.Value
			affectsCount = section.Select.Value
		}

		b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES\n"))
		b.WriteString(fmt.Sprintf("  ('%s', '%s', %s, %d, '%s', %d, %d);\n",
			groupID, unitID, sqlString(section.Label), selectMax, affects, affectsCount, g.sortOrder))

		// Replaces (targets)
		for _, target := range section.Targets {
			eqID := slugify(g.armyID + "-" + target)
			b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES\n"))
			b.WriteString(fmt.Sprintf("  ('%s', '%s');\n", groupID, eqID))
		}

		// Options
		for optIdx, option := range section.Options {
			optionID := fmt.Sprintf("%s-opt-%d", groupID, optIdx)

			// Determine cost for this unit
			cost := option.Cost
			for _, costOverride := range option.Costs {
				if costOverride.UnitID == unitAPIID {
					cost = costOverride.Cost
					break
				}
			}

			// Determine main equipment from gains
			var mainEquipID string
			if len(option.Gains) > 0 {
				for _, gain := range option.Gains {
					if gain.Type == "ArmyBookWeapon" || gain.Type == "ArmyBookItem" {
						cleanName := regexp.MustCompile(`\s*\([^)]*\)`).ReplaceAllString(gain.Name, "")
						cleanName = strings.TrimSpace(cleanName)
						mainEquipID = slugify(g.armyID + "-" + cleanName)
						break
					}
				}
			}

			if mainEquipID != "" {
				b.WriteString(fmt.Sprintf("INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES\n"))
				b.WriteString(fmt.Sprintf("  ('%s', '%s', '%s', %d, %d);\n",
					optionID, groupID, mainEquipID, cost, optIdx))
			}
		}
	}

	return b.String()
}

// ============================================================================
// Utility Functions
// ============================================================================

func slugify(s string) string {
	s = strings.ToLower(s)
	s = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

func sqlString(s string) string {
	if s == "" {
		return "NULL"
	}
	escaped := strings.ReplaceAll(s, "'", "''")
	return fmt.Sprintf("'%s'", escaped)
}

func toTitle(s string) string {
	parts := strings.Split(s, "-")
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
	}
	return strings.Join(parts, " ")
}

func classifyUnitType(unit Unit) string {
	name := strings.ToLower(unit.Name)
	if strings.Contains(name, "hero") || strings.Contains(name, "lord") || strings.Contains(name, "master") || strings.Contains(name, "destroyer") {
		return "hero"
	}
	if strings.Contains(name, "bike") || strings.Contains(name, "cavalry") {
		return "cavalry"
	}
	if strings.Contains(name, "vehicle") || strings.Contains(name, "tank") {
		return "vehicle"
	}
	if strings.Contains(name, "beast") || strings.Contains(name, "hound") {
		return "beast"
	}
	if unit.Size > 1 {
		return "infantry"
	}
	return "hero"
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// ============================================================================
// Main
// ============================================================================

func main() {
	var (
		inputFile  = flag.String("input", "", "Path to OPR JSON file (required)")
		universeID = flag.String("universe", "", "Universe ID (e.g., 'grimdark-future')")
		armyID     = flag.String("army", "", "Army ID (e.g., 'gf-alien-hives')")
		outputFile = flag.String("output", "", "Output SQL file (default: stdout)")
	)
	flag.Parse()

	if *inputFile == "" || *universeID == "" || *armyID == "" {
		flag.Usage()
		fmt.Fprintf(os.Stderr, "\nExample:\n")
		fmt.Fprintf(os.Stderr, "  %s -input alien-hives.json -universe grimdark-future -army gf-alien-hives -output 10-gf-alien-hives.sql\n", os.Args[0])
		os.Exit(1)
	}

	// Read JSON
	data, err := os.ReadFile(*inputFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
		os.Exit(1)
	}

	// Parse JSON
	var book ArmyBook
	if err := json.Unmarshal(data, &book); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing JSON: %v\n", err)
		os.Exit(1)
	}

	// Generate SQL
	generator := NewSQLGenerator(*universeID, *armyID)
	sql := generator.Generate(&book)

	// Output
	if *outputFile != "" {
		if err := os.WriteFile(*outputFile, []byte(sql), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing file: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Generated: %s\n", *outputFile)
	} else {
		fmt.Print(sql)
	}
}
