package main

import (
	"github.com/justgook/gams/pkg/wasmhost"
	"github.com/spf13/cobra"
)

func newPluginsCommand(a *app) *cobra.Command {
	pluginsCmd := &cobra.Command{
		Use:   "plugins",
		Short: "Inspect plugin runtime inputs",
	}

	pluginsCmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List plugin wasm files from configured plugins directory",
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			plugins, err := wasmhost.ListPlugins(a.paths.Plugins)
			if err != nil {
				return err
			}
			return a.printJSON(map[string]any{
				"plugins_dir": a.paths.Plugins,
				"plugins":     plugins,
			})
		}),
	})

	pluginsCmd.AddCommand(&cobra.Command{
		Use:   "active",
		Short: "List enabled global plugins from the database registry",
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			runtime, err := a.newRuntime(wasmhost.ModuleConfig{Name: "sql", Source: "local:/plugins/sql.wasm"})
			if err != nil {
				return err
			}
			defer runtime.Close()

			bootstrap, err := a.bootstrapDatabase(runtime)
			if err != nil {
				return err
			}

			plugins, err := a.enabledGlobalPlugins(runtime)
			if err != nil {
				return err
			}

			return a.printJSON(map[string]any{
				"database":      bootstrap,
				"plugins_dir":   a.paths.Plugins,
				"active_global": plugins,
			})
		}),
	})

	return pluginsCmd
}
