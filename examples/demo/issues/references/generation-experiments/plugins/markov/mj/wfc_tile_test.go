package mj

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

func TestTileWFCRuns(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "resources", "tilesets", "Tiny")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "resources", "tilesets", "Tiny.xml"), []byte(`<tileset><tiles><tile name="A"/><tile name="B"/></tiles><neighbors><neighbor left="A" right="A"/><neighbor left="A" right="B"/><neighbor left="B" right="A"/><neighbor left="B" right="B"/></neighbors></tileset>`), 0o644); err != nil {
		t.Fatal(err)
	}
	writeTinyVox(t, filepath.Join(dir, "A.vox"), 1)
	writeTinyVox(t, filepath.Join(dir, "B.vox"), 2)
	model, err := ParseXMLWithOptions([]byte(`<wfc values="AB" tileset="Tiny" tries="5"/>`), ParseOptions{ResourceRoot: root, ReadFile: os.ReadFile})
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 2, Height: 2, Depth: 1, Seed: 1, Steps: 10})
	if err != nil {
		t.Fatal(err)
	}
	if result.Width != 2 || result.Height != 2 || result.Values != "AB" {
		t.Fatalf("result = %#v", result)
	}
}

func writeTinyVox(t *testing.T, path string, color byte) {
	size := make([]byte, 12)
	binary.LittleEndian.PutUint32(size[0:4], 1)
	binary.LittleEndian.PutUint32(size[4:8], 1)
	binary.LittleEndian.PutUint32(size[8:12], 1)
	xyzi := make([]byte, 8)
	binary.LittleEndian.PutUint32(xyzi[0:4], 1)
	xyzi[4], xyzi[5], xyzi[6], xyzi[7] = 0, 0, 0, color
	chunks := append(chunk("SIZE", size, nil), chunk("XYZI", xyzi, nil)...)
	body := append([]byte{'V', 'O', 'X', ' '}, []byte{150, 0, 0, 0}...)
	body = append(body, chunk("MAIN", nil, chunks)...)
	if err := os.WriteFile(path, body, 0o644); err != nil {
		t.Fatal(err)
	}
}

func chunk(id string, content, children []byte) []byte {
	out := []byte(id)
	buf := make([]byte, 8)
	binary.LittleEndian.PutUint32(buf[0:4], uint32(len(content)))
	binary.LittleEndian.PutUint32(buf[4:8], uint32(len(children)))
	out = append(out, buf...)
	out = append(out, content...)
	out = append(out, children...)
	return out
}
