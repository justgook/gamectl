package main

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func newConfigCommand(a *app) *cobra.Command {
	configCmd := &cobra.Command{
		Use:   "config",
		Short: "Inspect and update configuration",
	}

	configCmd.AddCommand(&cobra.Command{
		Use:   "show",
		Short: "Print effective configuration",
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			return a.printJSON(a.effectiveConfig())
		}),
	})

	configCmd.AddCommand(&cobra.Command{
		Use:   "get <key>",
		Short: "Get a configuration value",
		Args:  cobra.ExactArgs(1),
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			key := normalizeConfigKey(args[0])
			value := a.getConfigValue(key)
			if value == nil {
				return fmt.Errorf("config key %q is not set", key)
			}
			return a.printJSON(map[string]any{
				"key":   key,
				"value": value,
			})
		}),
	})

	configCmd.AddCommand(&cobra.Command{
		Use:   "set <key> <value>",
		Short: "Set a configuration value",
		Args:  cobra.ExactArgs(2),
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			key := normalizeConfigKey(args[0])
			if err := a.setConfigValue(key, args[1]); err != nil {
				return err
			}
			return a.printJSON(map[string]any{
				"key":   key,
				"value": a.getConfigValue(key),
				"saved": a.configFilePath(),
			})
		}),
	})

	configCmd.AddCommand(&cobra.Command{
		Use:   "unset <key>",
		Short: "Unset a configuration value",
		Args:  cobra.ExactArgs(1),
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			key := normalizeConfigKey(args[0])
			if err := a.unsetConfigValue(key); err != nil {
				return err
			}
			return a.printJSON(map[string]any{
				"key":   key,
				"saved": a.configFilePath(),
			})
		}),
	})

	return configCmd
}

func normalizeConfigKey(key string) string {
	trimmed := strings.TrimSpace(key)
	trimmed = strings.TrimPrefix(trimmed, "config.")
	return trimmed
}
