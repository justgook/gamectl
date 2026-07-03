package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestFixturesMatchGoldenOutputs(t *testing.T) {
	for _, name := range []string{"simple", "multiple-actions"} {
		name := name
		t.Run(name, func(t *testing.T) {
			tmp := filepath.Join(t.TempDir(), name+".bulletml.json")
			input := filepath.Join("fixtures", name+".xml")
			if err := convertFile(input, tmp, false); err != nil {
				t.Fatalf("convertFile() error = %v", err)
			}

			actual := readJSONFile(t, tmp)
			expected := readJSONFile(t, filepath.Join("testdata", "golden", name+".bulletml.json"))
			if !reflect.DeepEqual(actual, expected) {
				t.Fatalf("converted fixture differs from golden\nactual: %#v\nexpected: %#v", actual, expected)
			}
		})
	}
}

func TestZeroTopLevelActionsFails(t *testing.T) {
	err := convertFile(filepath.Join("fixtures", "zero-actions.xml"), filepath.Join(t.TempDir(), "out.bulletml.json"), false)
	if err == nil {
		t.Fatal("expected zero top-level actions to fail")
	}
	if !strings.Contains(err.Error(), "at least one top-level action") {
		t.Fatalf("expected top-level action error, got %v", err)
	}
}

func TestTopLabelActionsAreRootWrappers(t *testing.T) {
	input := filepath.Join(t.TempDir(), "top-labels.xml")
	output := filepath.Join(t.TempDir(), "top-labels.bulletml.json")
	if err := os.WriteFile(input, []byte(`<?xml version="1.0"?>
<bulletml type="vertical">
  <action label="helper"><repeat><times>$1</times><action><wait>1</wait></action></repeat></action>
  <action label="top"><wait>1</wait></action>
</bulletml>`), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	if err := convertFile(input, output, false); err != nil {
		t.Fatalf("convertFile() error = %v", err)
	}
	actual := readJSONFile(t, output).(map[string]any)
	actions := actual["actions"].([]any)
	firstAction := actions[0].([]any)
	firstCommand := firstAction[0].(map[string]any)
	ref, exists := firstCommand["actionRef"]
	if !exists || ref != float64(2) {
		t.Fatalf("expected action 0 to wrap labeled top action, got %#v", firstAction)
	}
}

func TestExampleCorpusCompiles(t *testing.T) {
	inputs := globXML(t, filepath.Join("examples", "*.xml"))
	inputs = append(inputs, globXML(t, filepath.Join("examples", "mini", "*.xml"))...)
	if len(inputs) == 0 {
		t.Fatal("expected BulletML examples")
	}
	for _, input := range inputs {
		input := input
		t.Run(outputNameForInput(input), func(t *testing.T) {
			if err := convertFile(input, filepath.Join(t.TempDir(), "out.bulletml.json"), false); err != nil {
				t.Fatalf("convertFile() error = %v", err)
			}
		})
	}
}

func globXML(t *testing.T, pattern string) []string {
	t.Helper()
	matches, err := filepath.Glob(pattern)
	if err != nil {
		t.Fatalf("Glob(%q) error = %v", pattern, err)
	}
	return matches
}

func outputNameForInput(input string) string {
	return strings.TrimSuffix(filepath.Base(input), filepath.Ext(input)) + ".bulletml.json"
}

func readJSONFile(t *testing.T, path string) any {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile(%q) error = %v", path, err)
	}
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatalf("Unmarshal(%q) error = %v", path, err)
	}
	return value
}
