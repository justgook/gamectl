package main

import "github.com/spf13/cobra"

func newConfigCommand(a *app) *cobra.Command {
	configCmd := &cobra.Command{
		Use:   "config",
		Short: "Inspect effective configuration",
	}

	configCmd.AddCommand(&cobra.Command{
		Use:   "show",
		Short: "Print effective configuration",
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			return a.printJSON(a.effectiveConfig())
		}),
	})

	return configCmd
}
