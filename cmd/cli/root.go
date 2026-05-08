package main

import "github.com/spf13/cobra"

func newRootCommand() *cobra.Command {
	a := newApp()

	cmd := &cobra.Command{
		Use:          "gams",
		Short:        "Headless GAMS runtime",
		SilenceUsage: true,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if cmd.Name() == "help" {
				return nil
			}
			return a.load()
		},
	}

	cmd.PersistentFlags().StringVar(&a.configFile, "config", "", "Config file path")
	cmd.PersistentFlags().String("workdir", "", "Base working directory for relative paths")
	cmd.PersistentFlags().String("plugins-dir", "", "Directory with plugin wasm files")
	cmd.PersistentFlags().String("migrations-dir", "", "Directory with migration files")
	cmd.PersistentFlags().String("database", "", "SQLite database file path")
	cmd.PersistentFlags().Bool("load-global-plugins", true, "Load enabled global plugins")
	cmd.PersistentFlags().Bool("save-database-on-exit", true, "Save database on exit")
	cmd.PersistentFlags().String("log-level", "", "Logging level")

	_ = a.v.BindPFlag("paths.workdir", cmd.PersistentFlags().Lookup("workdir"))
	_ = a.v.BindPFlag("paths.plugins", cmd.PersistentFlags().Lookup("plugins-dir"))
	_ = a.v.BindPFlag("paths.migrations", cmd.PersistentFlags().Lookup("migrations-dir"))
	_ = a.v.BindPFlag("paths.database", cmd.PersistentFlags().Lookup("database"))
	_ = a.v.BindPFlag("runtime.load_global_plugins", cmd.PersistentFlags().Lookup("load-global-plugins"))
	_ = a.v.BindPFlag("runtime.save_database_on_exit", cmd.PersistentFlags().Lookup("save-database-on-exit"))
	_ = a.v.BindPFlag("logging.level", cmd.PersistentFlags().Lookup("log-level"))

	cmd.AddCommand(newConfigCommand(a))
	cmd.AddCommand(newPluginsCommand(a))
	cmd.AddCommand(newDBCommand(a))
	cmd.AddCommand(newRunCommand(a))

	return cmd
}
