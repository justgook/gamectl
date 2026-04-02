package main

import (
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
			runtime, err := a.newRuntime()
			if err != nil {
				return err
			}
			plugins, err := runtime.ListPlugins()
			if err != nil {
				return err
			}
			return a.printJSON(map[string]any{
				"plugins_dir": a.paths.Plugins,
				"plugins":     plugins,
			})
		}),
	})

	return pluginsCmd
}
