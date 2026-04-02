package main

import (
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"
)

func newRunCommand(a *app) *cobra.Command {
	var input string
	var inputFile string
	var useStdin bool

	cmd := &cobra.Command{
		Use:   "run <plugin> <function>",
		Short: "Prepare and invoke a plugin function",
		Args:  cobra.ExactArgs(2),
		RunE: withAppRun(a, func(cmd *cobra.Command, args []string) error {
			pluginName := args[0]
			functionName := args[1]

			payload, err := resolveInput(input, inputFile, useStdin)
			if err != nil {
				return err
			}

			runtime, err := a.newRuntime()
			if err != nil {
				return err
			}

			if _, err := runtime.PluginPath(pluginName); err != nil {
				return err
			}

			result, err := runtime.Call(pluginName, functionName, payload)
			if err != nil {
				return err
			}

			return a.printJSON(map[string]any{
				"plugin":   pluginName,
				"function": functionName,
				"result":   result,
			})
		}),
	}

	cmd.Flags().StringVar(&input, "input", "", "Inline string input")
	cmd.Flags().StringVar(&inputFile, "input-file", "", "Read input from file")
	cmd.Flags().BoolVar(&useStdin, "stdin", false, "Read input from stdin")

	return cmd
}

func resolveInput(input, inputFile string, useStdin bool) ([]byte, error) {
	selected := 0
	if input != "" {
		selected++
	}
	if inputFile != "" {
		selected++
	}
	if useStdin {
		selected++
	}
	if selected > 1 {
		return nil, fmt.Errorf("choose only one input mode")
	}

	if input != "" {
		return []byte(input), nil
	}
	if inputFile != "" {
		return os.ReadFile(inputFile)
	}
	if useStdin {
		return ioReadAll(os.Stdin)
	}

	return []byte{}, nil
}

func ioReadAll(file *os.File) ([]byte, error) {
	return io.ReadAll(file)
}
