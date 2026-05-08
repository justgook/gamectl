package main

import (
	"github.com/justgook/gams/pkg/wasmhost"
	"github.com/spf13/cobra"
)

func newDBCommand(a *app) *cobra.Command {
	dbCmd := &cobra.Command{
		Use:   "db",
		Short: "Database bootstrap commands",
	}

	dbCmd.AddCommand(&cobra.Command{
		Use:   "migrate",
		Short: "Bootstrap the SQLite database and apply pending migrations",
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			runtime, err := a.newRuntime(wasmhost.ModuleConfig{Name: "sql", Source: "local:/plugins/sql.wasm"})
			if err != nil {
				return err
			}
			defer runtime.Close()

			status, err := a.bootstrapDatabase(runtime)
			if err != nil {
				return err
			}

			return a.printJSON(map[string]any{
				"database":   status,
				"migrations": a.paths.Migrations,
				"saved":      a.config.Runtime.SaveDatabaseOnExit,
			})
		}),
	})

	return dbCmd
}
