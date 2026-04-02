package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolvePaths(t *testing.T) {
	paths, err := resolvePaths(PathsConfig{
		Workdir:    "/tmp/gams",
		Plugins:    "build/plugins",
		Migrations: "migrations",
		Database:   "database.sqlite",
	})
	if err != nil {
		t.Fatalf("resolvePaths returned error: %v", err)
	}

	if paths.Workdir != "/tmp/gams" {
		t.Fatalf("unexpected workdir: %s", paths.Workdir)
	}
	if paths.Plugins != filepath.Clean("/tmp/gams/build/plugins") {
		t.Fatalf("unexpected plugins path: %s", paths.Plugins)
	}
	if paths.Migrations != filepath.Clean("/tmp/gams/migrations") {
		t.Fatalf("unexpected migrations path: %s", paths.Migrations)
	}
	if paths.Database != filepath.Clean("/tmp/gams/database.sqlite") {
		t.Fatalf("unexpected database path: %s", paths.Database)
	}
}

func TestFirstCommandIndex(t *testing.T) {
	if got := firstCommandIndex([]string{"--config", "cfg.yaml", "query", "SELECT 1"}); got != 2 {
		t.Fatalf("unexpected command index: %d", got)
	}
	if got := firstCommandIndex([]string{"run", "sql", "query"}); got != 0 {
		t.Fatalf("unexpected command index: %d", got)
	}
}

func TestExpandAliasArgs(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "gams.yaml")
	config := []byte("aliases:\n  query: run sql query --input\n")
	if err := os.WriteFile(configPath, config, 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	args, expanded, err := expandAliasArgs([]string{"--config", configPath, "query", "SELECT 1"})
	if err != nil {
		t.Fatalf("expandAliasArgs returned error: %v", err)
	}
	if !expanded {
		t.Fatalf("expected alias expansion")
	}
	want := []string{"--config", configPath, "run", "sql", "query", "--input", "SELECT 1"}
	if len(args) != len(want) {
		t.Fatalf("unexpected arg count: got %v want %v", args, want)
	}
	for i := range want {
		if args[i] != want[i] {
			t.Fatalf("unexpected args: got %v want %v", args, want)
		}
	}
}
