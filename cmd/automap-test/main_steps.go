package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// findProjectRoot finds the project root by looking for go.mod
func findProjectRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not find project root (go.mod)")
		}
		dir = parent
	}
}

func mainSteps() {
	fmt.Println("=== Automap Step-by-Step Validation ===\n")

	// Determine project root
	projectRoot, err := findProjectRoot()
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		os.Exit(1)
	}

	// Paths to test files
	rulesPath := filepath.Join(projectRoot, "example/rules1.tmj")
	testgroundPath := filepath.Join(projectRoot, "example/testground.tmj")

	fmt.Println("📄 Loading test data...")

	// Load rules map
	rulesMap, err := LoadTiledMap(rulesPath)
	if err != nil {
		fmt.Printf("❌ Failed to load rules: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ Rules map loaded: %dx%d, %d layers\n",
		rulesMap.Layers[0].Width,
		rulesMap.Layers[0].Height(),
		len(rulesMap.Layers))

	// Add metadata
	rulesMap.Layers[0].Props["rule_role"] = "input"
	rulesMap.Layers[0].Props["rule_target_layer"] = "#0"
	if len(rulesMap.Layers) > 1 {
		rulesMap.Layers[1].Props["rule_role"] = "output"
		rulesMap.Layers[1].Props["rule_target_layer"] = "#0"
	}

	// Add special tile definitions
	rulesMap.Props["rule_Negate"] = "1"
	rulesMap.Props["rule_Ignore"] = "2"
	rulesMap.Props["rule_NonEmpty"] = "3"
	rulesMap.Props["rule_Empty"] = "4"
	rulesMap.Props["rule_Other"] = "5"
	rulesMap.Props["rule_MatchOutsideMap"] = "true"
	rulesMap.Props["rule_OverflowBorder"] = "true"

	// Parse config
	config, err := ParseGlobalConfig(rulesMap.Props)
	if err != nil {
		fmt.Printf("❌ Failed to parse config: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ Config parsed: MatchOutsideMap=%v, OverflowBorder=%v\n",
		config.MatchOutsideMap, config.OverflowBorder)

	// Load test input
	testMap, err := LoadTiledMap(testgroundPath)
	if err != nil {
		fmt.Printf("❌ Failed to load test map: %v\n", err)
		os.Exit(1)
	}

	inputMap, err := ExtractLayer(testMap, "walls")
	if err != nil {
		fmt.Printf("❌ Failed to extract input layer: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ Input map loaded: %dx%d\n",
		inputMap.Layers[0].Width,
		inputMap.Layers[0].Height())

	expectedMap, err := ExtractLayer(testMap, "result")
	if err != nil {
		fmt.Printf("❌ Failed to extract expected output: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ Expected output loaded\n")

	// Create output map
	outputMap := CreateEmptyOutput(inputMap)

	// ========================================
	// STEP 1: Validate Region Extraction
	// ========================================
	regions, err := Step1ValidateRegions(rulesMap, config)
	if err != nil {
		fmt.Printf("❌ Step 1 FAILED: %v\n", err)
		os.Exit(1)
	}

	// Extract rules from regions
	rules, err := ExtractRulesFromRegions(regions, rulesMap, config)
	if err != nil {
		fmt.Printf("❌ Failed to extract rules: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("\n✓ Extracted %d rules from regions\n", len(rules))

	// Show rule tile counts (for debugging)
	fmt.Println("\nRule Specificity (sorted by tile count):")
	for i := 0; i < min(10, len(rules)); i++ {
		tileCount := 0
		for _, input := range rules[i].InputLayers {
			tileCount += len(input.Tiles)
		}
		fmt.Printf("  Rule %2d: %d input tiles\n", i, tileCount)
	}
	if len(rules) > 10 {
		fmt.Printf("  ... and %d more rules\n", len(rules)-10)
	}

	// ========================================
	// STEP 2: Validate Pattern Matching
	// ========================================
	matches, err := Step2ValidateMatching(rulesMap, inputMap, config, rules)
	if err != nil {
		fmt.Printf("❌ Step 2 FAILED: %v\n", err)
		os.Exit(1)
	}

	// ========================================
	// STEP 3: Validate Output Placement
	// ========================================
	err = Step3ValidateOutput(outputMap, matches, config)
	if err != nil {
		fmt.Printf("❌ Step 3 FAILED: %v\n", err)
		os.Exit(1)
	}

	// ========================================
	// STEP 4: Compare with Expected Output
	// ========================================
	fmt.Println("\n=== STEP 4: Compare with Expected Output ===")

	matches_result, total, diffs := CompareLayerData(&outputMap.Layers[0], &expectedMap.Layers[0])
	accuracy := float64(matches_result) * 100.0 / float64(total)

	fmt.Printf("Accuracy: %.1f%% (%d/%d tiles match)\n", accuracy, matches_result, total)

	if len(diffs) > 0 {
		PrintDiffDetails(diffs, 10)
	}

	// Save output for inspection
	SaveMapToJSON(outputMap, filepath.Join(projectRoot, "build.nosync/automap-step-output.json"))

	if accuracy < 100.0 {
		fmt.Printf("\n⚠️  Accuracy is %.1f%% - debugging needed\n", accuracy)

		// Show side-by-side comparison
		fmt.Println("\nVisual Comparison (first 10x10):")
		PrintMap(inputMap, "Input", 10, 10)
		PrintMap(outputMap, "Actual Output", 10, 10)
		PrintMap(expectedMap, "Expected Output", 10, 10)

		os.Exit(1)
	}

	fmt.Println("\n✅ ALL STEPS PASSED: 100% accuracy achieved!")
}
