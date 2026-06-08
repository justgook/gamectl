package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
)

func TestFixturesConvertToDemoOutputs(t *testing.T) {
	fixtures := []string{"simple", "sequence", "aimed"}
	for _, name := range fixtures {
		t.Run(name, func(t *testing.T) {
			tmp := filepath.Join(t.TempDir(), name+".gbml.json")
			input := filepath.Join("fixtures", name+".xml")
			if err := convertFile(input, tmp, false); err != nil {
				t.Fatalf("convertFile() error = %v", err)
			}

			actual := readJSONFile(t, tmp)
			expected := readJSONFile(t, filepath.Join("..", "..", "examples", "demo", "bulletML", name+".gbml.json"))
			if !reflect.DeepEqual(actual, expected) {
				t.Fatalf("converted fixture differs from demo output\nactual: %#v\nexpected: %#v", actual, expected)
			}
		})
	}
}

func TestFixturesValidateAgainstDTD(t *testing.T) {
	if _, err := exec.LookPath("xmllint"); err != nil {
		t.Skip("xmllint not available")
	}
	fixtures := []string{"simple", "sequence", "aimed"}
	for _, name := range fixtures {
		t.Run(name, func(t *testing.T) {
			cmd := exec.Command(
				"xmllint",
				"--noout",
				"--dtdvalid",
				"bulletml.dtd",
				filepath.Join("fixtures", name+".xml"),
			)
			if output, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("xmllint failed: %v\n%s", err, output)
			}
		})
	}
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
