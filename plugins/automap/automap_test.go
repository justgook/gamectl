package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"

	"github.com/justgook/gams/pkg/tilemap"
)

func TestAutomapFixturesMatchTiled(t *testing.T) {
	for _, caseName := range fixtureCases(t) {
		t.Run(caseName, func(t *testing.T) {
			inputMap := loadFixtureMap(t, caseName, "input.json")
			rulesMap := loadFixtureMap(t, caseName, "rules.json")
			expected := loadFixtureMap(t, caseName, "output.json")

			result, err := AutomapApply(rulesMap, inputMap)
			if err != nil {
				t.Fatalf("AutomapApply returned error: %v", err)
			}

			assertTileMapEqual(t, canonicalTileMap(result), canonicalTileMap(expected))
		})
	}
}

func TestExtractRulesUsesEightWayConnectivity(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{
		"rule_Empty":    "1028",
		"rule_NonEmpty": "1027",
	}

	input := tilemap.NewTileLayer(2, 2)
	input.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	input.Data[0] = 1027

	output := tilemap.NewTileLayer(2, 2)
	output.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#0"}
	output.Data[3] = 7

	rulesMap.Layers = []tilemap.TileLayer{*input, *output}
	config, err := ParseGlobalConfig(rulesMap.Props)
	if err != nil {
		t.Fatalf("ParseGlobalConfig returned error: %v", err)
	}

	rules, err := ExtractRules(rulesMap, config)
	if err != nil {
		t.Fatalf("ExtractRules returned error: %v", err)
	}

	if len(rules) != 1 {
		t.Fatalf("expected 1 diagonally connected rule, got %d", len(rules))
	}
}

func TestAutomapApplyAppliesRulesInRuleOrder(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{"rule_NonEmpty": "1027"}

	inputA := tilemap.NewTileLayer(3, 1)
	inputA.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	inputA.Data[0] = 1027

	outputA := tilemap.NewTileLayer(3, 1)
	outputA.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#0"}
	outputA.Data[0] = 2

	inputB := tilemap.NewTileLayer(3, 1)
	inputB.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	inputB.Data[2] = 1027

	outputB := tilemap.NewTileLayer(3, 1)
	outputB.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#0"}
	outputB.Data[2] = 3

	rulesMap.Layers = []tilemap.TileLayer{*inputA, *outputA, *inputB, *outputB}
	inputMap := singleLayerMap(1, 1)
	inputMap.Layers[0].Data[0] = 1

	result, err := AutomapApply(rulesMap, inputMap)
	if err != nil {
		t.Fatalf("AutomapApply returned error: %v", err)
	}

	if got := result.Layers[0].Data[0]; got != 3 {
		t.Fatalf("expected later rule to overwrite earlier one, got %d", got)
	}
}

func TestAutomapApplyMatchesMissingTargetLayerAsEmpty(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{"rule_Empty": "1028"}

	input := tilemap.NewTileLayer(1, 1)
	input.Props = map[string]string{"rule_role": "input", "rule_target_layer": "[missing]"}
	input.Data[0] = 1028

	output := tilemap.NewTileLayer(1, 1)
	output.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#0"}
	output.Data[0] = 9

	rulesMap.Layers = []tilemap.TileLayer{*input, *output}
	inputMap := singleLayerMap(1, 1)

	result, err := AutomapApply(rulesMap, inputMap)
	if err != nil {
		t.Fatalf("AutomapApply returned error: %v", err)
	}

	if got := result.Layers[0].Data[0]; got != 9 {
		t.Fatalf("expected missing layer to be treated as empty and write 9, got %d", got)
	}
}

func TestAutomapApplyToTargetDoesNotCopyInputIntoNewMap(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{"rule_NonEmpty": "1027"}

	input := tilemap.NewTileLayer(1, 1)
	input.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	input.Data[0] = 1027

	output := tilemap.NewTileLayer(1, 1)
	output.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#1", "name": "decor"}
	output.Data[0] = 9

	rulesMap.Layers = []tilemap.TileLayer{*input, *output}

	inputMap := singleLayerMap(1, 1)
	inputMap.Layers[0].Data[0] = 7
	inputMap.Layers[0].Props["name"] = "source"

	targetMap := tilemap.NewTileMap()
	result, err := AutomapApplyToTarget(rulesMap, inputMap, targetMap)
	if err != nil {
		t.Fatalf("AutomapApplyToTarget returned error: %v", err)
	}

	if len(result.Layers) != 2 {
		t.Fatalf("expected 2 layers to satisfy #1 output selector, got %d", len(result.Layers))
	}
	if got := result.Layers[0].Data[0]; got != 0 {
		t.Fatalf("expected layer #0 to remain empty, got %d", got)
	}
	if got := result.Layers[1].Data[0]; got != 9 {
		t.Fatalf("expected output layer to receive automap tile, got %d", got)
	}
}

func TestAutomapApplyToTargetUpdatesExistingOutputMapOnly(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{"rule_NonEmpty": "1027"}

	input := tilemap.NewTileLayer(1, 1)
	input.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	input.Data[0] = 1027

	output := tilemap.NewTileLayer(1, 1)
	output.Props = map[string]string{"rule_role": "output", "rule_target_layer": "[name=\"decor\"]"}
	output.Data[0] = 9

	rulesMap.Layers = []tilemap.TileLayer{*input, *output}

	inputMap := singleLayerMap(1, 1)
	inputMap.Layers[0].Data[0] = 7

	targetMap := tilemap.NewTileMap()
	base := tilemap.NewTileLayer(1, 1)
	base.Props["name"] = "base"
	base.Data[0] = 5
	decor := tilemap.NewTileLayer(1, 1)
	decor.Props["name"] = "decor"
	targetMap.Layers = []tilemap.TileLayer{*base, *decor}

	result, err := AutomapApplyToTarget(rulesMap, inputMap, targetMap)
	if err != nil {
		t.Fatalf("AutomapApplyToTarget returned error: %v", err)
	}

	if got := result.Layers[0].Data[0]; got != 5 {
		t.Fatalf("expected existing non-target layer to be preserved, got %d", got)
	}
	if got := result.Layers[1].Data[0]; got != 9 {
		t.Fatalf("expected target layer to be updated, got %d", got)
	}
}

func TestAutomapApplyToTargetCreatesMissingLayerInExistingMap(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{"rule_NonEmpty": "1027"}

	input := tilemap.NewTileLayer(1, 1)
	input.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	input.Data[0] = 1027

	output := tilemap.NewTileLayer(1, 1)
	output.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#1"}
	output.Data[0] = 3

	rulesMap.Layers = []tilemap.TileLayer{*input, *output}

	inputMap := singleLayerMap(1, 1)
	inputMap.Layers[0].Data[0] = 4

	targetMap := singleLayerMap(1, 1)
	result, err := AutomapApplyToTarget(rulesMap, inputMap, targetMap)
	if err != nil {
		t.Fatalf("AutomapApplyToTarget returned error: %v", err)
	}

	if len(result.Layers) != 2 {
		t.Fatalf("expected missing indexed output layer to be created, got %d layers", len(result.Layers))
	}
	if got := result.Layers[0].Data[0]; got != 0 {
		t.Fatalf("expected original target layer to remain unchanged, got %d", got)
	}
	if got := result.Layers[1].Data[0]; got != 3 {
		t.Fatalf("expected created target layer to receive output, got %d", got)
	}
}

func TestAutomapApplyMatchesDifferentFromBoundReference(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{
		"rule_Ignore":    "900",
		"rule_Different": "901",
	}

	input := tilemap.NewTileLayer(2, 1)
	input.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	input.Data[0] = 900
	input.Data[1] = 901

	output := tilemap.NewTileLayer(2, 1)
	output.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#0"}
	output.Data[1] = 7

	rulesMap.Layers = []tilemap.TileLayer{*input, *output}
	inputMap := singleLayerMap(2, 1)
	inputMap.Layers[0].Data[0] = 17
	inputMap.Layers[0].Data[1] = 8

	result, err := AutomapApply(rulesMap, inputMap)
	if err != nil {
		t.Fatalf("AutomapApply returned error: %v", err)
	}

	if got := result.Layers[0].Data[1]; got != 7 {
		t.Fatalf("expected Different to match and write 7, got %d", got)
	}
}

func TestAutomapApplyRejectsDifferentEqualToBoundReference(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{
		"rule_Ignore":    "900",
		"rule_Different": "901",
	}

	input := tilemap.NewTileLayer(2, 1)
	input.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	input.Data[0] = 900
	input.Data[1] = 901

	output := tilemap.NewTileLayer(2, 1)
	output.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#0"}
	output.Data[1] = 7

	rulesMap.Layers = []tilemap.TileLayer{*input, *output}
	inputMap := singleLayerMap(2, 1)
	inputMap.Layers[0].Data[0] = 17
	inputMap.Layers[0].Data[1] = 17

	_, err := AutomapApply(rulesMap, inputMap)
	if err == nil {
		t.Fatalf("expected Different to reject a tile equal to the bound reference")
	}
}

func TestExtractRulesRejectsDifferentBeforeReference(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{"rule_Different": "901"}

	input := tilemap.NewTileLayer(1, 1)
	input.Props = map[string]string{"rule_role": "input", "rule_target_layer": "#0"}
	input.Data[0] = 901

	output := tilemap.NewTileLayer(1, 1)
	output.Props = map[string]string{"rule_role": "output", "rule_target_layer": "#0"}
	output.Data[0] = 7

	rulesMap.Layers = []tilemap.TileLayer{*input, *output}
	config, err := ParseGlobalConfig(rulesMap.Props)
	if err != nil {
		t.Fatalf("ParseGlobalConfig returned error: %v", err)
	}

	if _, err := ExtractRules(rulesMap, config); err == nil {
		t.Fatalf("expected Different before a reference binder to fail validation")
	}
}

func TestPrepareMapForEdgeMatchingTreatsOverflowAsMatchOutsideMap(t *testing.T) {
	rulesMap := tilemap.NewTileMap()
	rulesMap.Props = map[string]string{"rule_OverflowBorder": "true"}

	inputMap := singleLayerMap(2, 2)
	rules := []*Rule{{
		InputGroups: []*InputGroup{{Cells: []InputCell{{Point: Point{X: 1, Y: 0}, Matchers: []InputMatcher{{Value: 1}}}}}},
		Outputs:     &RuleOutputs{},
		Config:      &GlobalConfig{},
	}}

	workingMap, ctx := PrepareMapForEdgeMatching(rulesMap, inputMap, rules)
	if !ctx.WasExtended {
		t.Fatalf("expected overflow border to imply MatchOutsideMap")
	}
	if workingMap.Layers[0].Width <= inputMap.Layers[0].Width {
		t.Fatalf("expected extended map width, got %d", workingMap.Layers[0].Width)
	}
}

func loadFixtureMap(t *testing.T, caseName, fileName string) *tilemap.TileMap {
	t.Helper()

	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve test file path")
	}

	fixturePath := filepath.Join(filepath.Dir(file), "testdata", caseName, fileName)
	content, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture %s: %v", fixturePath, err)
	}

	var tm tilemap.TileMap
	if err := json.Unmarshal(content, &tm); err != nil {
		t.Fatalf("failed to parse fixture %s: %v", fixturePath, err)
	}

	return &tm
}

func singleLayerMap(width, height int) *tilemap.TileMap {
	tm := tilemap.NewTileMap()
	layer := tilemap.NewTileLayer(width, height)
	layer.Props["name"] = "base"
	tm.Layers = append(tm.Layers, *layer)
	return tm
}

func fillRect(layer *tilemap.TileLayer, minX, minY, maxX, maxY int, value uint32) {
	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			layer.Data[y*layer.Width+x] = value
		}
	}
}

func assertLayerData(t *testing.T, got, want []uint32) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("layer data length mismatch: got %d want %d", len(got), len(want))
	}

	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("layer data mismatch at index %d: got %d want %d", i, got[i], want[i])
		}
	}
}

func assertTileMapEqual(t *testing.T, got, want *tilemap.TileMap) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		gotJSON, _ := json.MarshalIndent(got, "", "  ")
		wantJSON, _ := json.MarshalIndent(want, "", "  ")
		t.Fatalf("tilemaps differ\n got: %s\nwant: %s", gotJSON, wantJSON)
	}
}

func canonicalTileMap(tm *tilemap.TileMap) *tilemap.TileMap {
	canonical := cloneTileMap(tm)
	if canonical.Props == nil {
		canonical.Props = map[string]string{}
	}
	for i := range canonical.Layers {
		if canonical.Layers[i].Props == nil {
			canonical.Layers[i].Props = map[string]string{}
		}
	}
	return canonical
}

func TestFixtureOutputsExist(t *testing.T) {
	for _, caseName := range fixtureCases(t) {
		if _, err := os.Stat(filepath.Join("testdata", caseName, "output.json")); err != nil {
			t.Fatalf("missing generated output fixture for %s: %v", caseName, err)
		}
	}
}

func TestFixtureLayerNamesAreStable(t *testing.T) {
	for _, caseName := range fixtureCases(t) {
		inputMap := loadFixtureMap(t, caseName, "input.json")
		for i := range inputMap.Layers {
			if inputMap.Layers[i].Props["name"] == "" {
				t.Fatalf("fixture %s input layer %d is missing a name", caseName, i)
			}
		}
	}
}

func TestFixtureGoldenShape(t *testing.T) {
	for _, caseName := range fixtureCases(t) {
		outputMap := loadFixtureMap(t, caseName, "output.json")
		if len(outputMap.Layers) == 0 {
			t.Fatalf("fixture %s output has no layers", caseName)
		}
		for i, layer := range outputMap.Layers {
			if got, want := len(layer.Data), layer.Width*layer.Height(); got != want {
				t.Fatalf("fixture %s output layer %d has invalid shape: got %d want %d", caseName, i, got, want)
			}
		}
	}
}

func fixtureCases(t *testing.T) []string {
	t.Helper()

	content, err := os.ReadFile(filepath.Join("testdata", "cases.json"))
	if err != nil {
		t.Fatalf("failed to read fixture case list: %v", err)
	}

	var cases []string
	if err := json.Unmarshal(content, &cases); err != nil {
		t.Fatalf("failed to parse fixture case list: %v", err)
	}

	return cases
}
