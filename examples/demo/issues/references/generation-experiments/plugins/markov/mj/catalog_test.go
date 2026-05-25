package mj

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseModelsXML(t *testing.T) {
	entries, err := ParseModelsXML([]byte(`<models><model name="Basic" size="60" steps="1000"/><model name="Three" size="8" d="3"/></models>`))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("len = %d", len(entries))
	}
	if entries[0].Length != 60 || entries[0].Width != 60 || entries[0].Height != 1 || entries[0].Steps != 1000 {
		t.Fatalf("basic entry = %#v", entries[0])
	}
	if entries[1].Height != 8 || entries[1].Dim != 3 {
		t.Fatalf("3d entry = %#v", entries[1])
	}
}

func TestMarkovJuniorCompatibilityReport(t *testing.T) {
	root := filepath.Join("..", "..", "..", "tmp", "MarkovJunior")
	catalogPath := filepath.Join(root, "models.xml")
	catalogData, err := os.ReadFile(catalogPath)
	if err != nil {
		t.Skipf("MarkovJunior checkout not available: %v", err)
	}
	entries, err := ParseModelsXML(catalogData)
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	parsed := 0
	unsupported := map[string]int{}
	for _, entry := range entries {
		if seen[entry.Name] {
			continue
		}
		seen[entry.Name] = true
		data, err := os.ReadFile(filepath.Join(root, "models", entry.Name+".xml"))
		if err != nil {
			unsupported["missing model file"]++
			continue
		}
		_, err = ParseXMLWithOptions(data, ParseOptions{ResourceRoot: root, ReadFile: os.ReadFile})
		if err != nil {
			unsupported[classifyUnsupported(err.Error())]++
			continue
		}
		parsed++
	}
	t.Logf("MarkovJunior compatibility parse report: parsed=%d unsupported=%d uniqueModels=%d", parsed, len(seen)-parsed, len(seen))
	for reason, count := range unsupported {
		t.Logf("unsupported[%s]=%d", reason, count)
	}
}

func classifyUnsupported(msg string) string {
	switch {
	case strings.Contains(msg, "unsupported node type"):
		return msg
	case strings.Contains(msg, "file-backed"):
		return "file-backed rules"
	case strings.Contains(msg, "rule requires in and out"):
		return "rule file/fin/fout or incomplete rule attrs"
	case strings.Contains(msg, "root values is required"):
		return "root values missing"
	default:
		return msg
	}
}
