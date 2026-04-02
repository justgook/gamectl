package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"unicode/utf8"

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

			runtime, modules, bootstrap, err := a.prepareRuntimeForRun(pluginName)
			if err != nil {
				return err
			}
			defer runtime.Close()

			if _, err := runtime.PluginPath(pluginName); err != nil {
				return err
			}

			result, err := runtime.Call(pluginName, functionName, payload)
			if err != nil {
				return err
			}
			if a.config.Runtime.SaveDatabaseOnExit {
				if err := a.saveDatabase(runtime); err != nil {
					return err
				}
			}

			return a.printJSON(map[string]any{
				"plugin":   pluginName,
				"function": functionName,
				"modules":  modules,
				"database": bootstrap,
				"result": map[string]any{
					"return_code":   result.ReturnCode,
					"output_base64": base64.StdEncoding.EncodeToString(result.Output),
					"output_text":   outputText(result.Output),
					"output_json":   outputJSON(result.Output),
				},
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

func outputText(data []byte) any {
	if len(data) == 0 {
		return ""
	}
	if !utf8.Valid(data) {
		return nil
	}
	return string(data)
}

func outputJSON(data []byte) any {
	if len(data) == 0 || !utf8.Valid(data) {
		return nil
	}
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		return nil
	}
	return value
}
