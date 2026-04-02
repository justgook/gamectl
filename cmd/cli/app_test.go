package main

import (
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
