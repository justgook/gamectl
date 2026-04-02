package main

import (
	"os"

	"github.com/spf13/cobra"
)

func newDBCommand(a *app) *cobra.Command {
	dbCmd := &cobra.Command{
		Use:   "db",
		Short: "Database bootstrap commands",
	}

	dbCmd.AddCommand(&cobra.Command{
		Use:   "migrate",
		Short: "Validate database and migration inputs for CLI bootstrap",
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			databaseExists := false
			if _, err := os.Stat(a.paths.Database); err == nil {
				databaseExists = true
			} else if !os.IsNotExist(err) {
				return err
			}

			migrationIndex := a.paths.Migrations + string(os.PathSeparator) + "index.json"
			if _, err := os.Stat(migrationIndex); err != nil {
				return err
			}

			return a.printJSON(map[string]any{
				"database": map[string]any{
					"path":   a.paths.Database,
					"exists": databaseExists,
				},
				"migrations": map[string]any{
					"path":  a.paths.Migrations,
					"index": migrationIndex,
				},
				"status": "bootstrap validation complete; migration runtime not implemented yet",
			})
		}),
	})

	return dbCmd
}
