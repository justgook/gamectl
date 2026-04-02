package wasmhost

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestListPlugins(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "b.wasm"), []byte("b"), 0o644); err != nil {
		t.Fatalf("write b.wasm: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "a.wasm"), []byte("a"), 0o644); err != nil {
		t.Fatalf("write a.wasm: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write readme.txt: %v", err)
	}

	runtime, err := New(Config{PluginsDir: dir})
	if err != nil {
		t.Fatalf("new runtime: %v", err)
	}

	plugins, err := runtime.ListPlugins()
	if err != nil {
		t.Fatalf("list plugins: %v", err)
	}

	want := []string{"a", "b"}
	if !reflect.DeepEqual(plugins, want) {
		t.Fatalf("unexpected plugins: got %v want %v", plugins, want)
	}
}
