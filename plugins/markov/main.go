package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gams/pkg/tilemap"
	"github.com/justgook/gams/pkg/util"
	"github.com/justgook/gams/plugins/markov/mj"
	"github.com/justgook/wpm/pdk"
)

type Resources struct {
	Root string `json:"root,omitempty"`
}

type Output struct {
	Grid    string `json:"grid,omitempty"`
	Tilemap string `json:"tilemap,omitempty"`
}

type Initial struct {
	Cells string `json:"cells,omitempty"`
}

type RunInput struct {
	Model    string            `json:"model,omitempty"`
	ModelXML string            `json:"modelXml,omitempty"`
	Width    int               `json:"width"`
	Height   int               `json:"height"`
	Depth    int               `json:"depth,omitempty"`
	Seed     uint64            `json:"seed,omitempty"`
	Steps    int               `json:"steps,omitempty"`
	Initial  Initial           `json:"initial,omitempty"`
	Output   Output            `json:"output,omitempty"`
	TileIDs  map[string]uint32 `json:"tileIds,omitempty"`
}

type RunModelEntryInput struct {
	ModelsXML  string            `json:"modelsXml"`
	Name       string            `json:"name"`
	Occurrence int               `json:"occurrence,omitempty"`
	Seed       uint64            `json:"seed,omitempty"`
	Steps      int               `json:"steps,omitempty"`
	Initial    Initial           `json:"initial,omitempty"`
	Output     Output            `json:"output,omitempty"`
	TileIDs    map[string]uint32 `json:"tileIds,omitempty"`
}

type InspectInput struct {
	Model    string `json:"model,omitempty"`
	ModelXML string `json:"modelXml,omitempty"`
}

func readFile(path string) ([]byte, error) {
	status, output, callErr := pdk.Call("fs", "read", []byte(path))
	if callErr != nil {
		return nil, callErr
	}
	if status != 0 {
		return nil, fmt.Errorf("%s", string(output))
	}
	return output, nil
}

func writeFile(path string, data []byte) error {
	input := make([]byte, 0, len(path)+1+len(data))
	input = append(input, path...)
	input = append(input, 0)
	input = append(input, data...)
	_, output, callErr := pdk.Call("fs", "write", input)
	if callErr != nil {
		return callErr
	}
	if len(output) > 0 && string(output) != "OK" {
		return fmt.Errorf("%s", string(output))
	}
	return nil
}

func loadModel(path, inline string) (*mj.Model, error) {
	if inline != "" {
		return mj.ParseXMLWithOptions([]byte(inline), mj.ParseOptions{ReadFile: readFile})
	}
	if path == "" {
		return nil, fmt.Errorf("model or modelXml is required")
	}
	data, err := readFile(path)
	if err != nil {
		return nil, err
	}
	return mj.ParseXMLWithOptions(data, mj.ParseOptions{ResourceRoot: resourceRootForModel(path), ReadFile: readFile})
}

//go:wasmexport run
func Run() int32 {
	var input RunInput
	if err := json.Unmarshal(pdk.Input(), &input); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}
	if input.Depth == 0 {
		input.Depth = 1
	}
	model, err := loadModel(input.Model, input.ModelXML)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load model: " + err.Error()))
		return 1
	}
	result, err := mj.Run(model, mj.RunOptions{Width: input.Width, Height: input.Height, Depth: input.Depth, Seed: input.Seed, Steps: input.Steps, InitialCells: input.Initial.Cells})
	if err != nil {
		pdk.Output(util.ErrorResponse("generation failed: " + err.Error()))
		return 1
	}
	if input.Output.Grid != "" {
		data, err := json.Marshal(result)
		if err != nil {
			pdk.Output(util.ErrorResponse("failed to marshal grid: " + err.Error()))
			return 1
		}
		if err := writeFile(input.Output.Grid, data); err != nil {
			pdk.Output(util.ErrorResponse("failed to write grid: " + err.Error()))
			return 1
		}
	}
	if input.Output.Tilemap != "" {
		if result.Depth != 1 {
			pdk.Output(util.ErrorResponse("tilemap output requires depth 1"))
			return 1
		}
		if len(input.TileIDs) == 0 {
			pdk.Output(util.ErrorResponse("tileIds is required when output.tilemap is set"))
			return 1
		}
		data, err := json.Marshal(toTileMap(result, input.TileIDs))
		if err != nil {
			pdk.Output(util.ErrorResponse("failed to marshal tilemap: " + err.Error()))
			return 1
		}
		if err := writeFile(input.Output.Tilemap, data); err != nil {
			pdk.Output(util.ErrorResponse("failed to write tilemap: " + err.Error()))
			return 1
		}
	}
	data, err := json.Marshal(result)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal response: " + err.Error()))
		return 1
	}
	pdk.Output(data)
	return 0
}

//go:wasmexport runModelEntry
func RunModelEntry() int32 {
	var input RunModelEntryInput
	if err := json.Unmarshal(pdk.Input(), &input); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}
	if input.ModelsXML == "" {
		pdk.Output(util.ErrorResponse("modelsXml is required"))
		return 1
	}
	if input.Name == "" {
		pdk.Output(util.ErrorResponse("name is required"))
		return 1
	}
	catalogData, err := readFile(input.ModelsXML)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to read modelsXml: " + err.Error()))
		return 1
	}
	entries, err := mj.ParseModelsXML(catalogData)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to parse modelsXml: " + err.Error()))
		return 1
	}
	entry, err := mj.FindModelEntry(entries, input.Name, input.Occurrence)
	if err != nil {
		pdk.Output(util.ErrorResponse(err.Error()))
		return 1
	}
	modelPath := joinPath(dirname(input.ModelsXML), "models/"+entry.Name+".xml")
	model, err := loadModel(modelPath, "")
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load model: " + err.Error()))
		return 1
	}
	steps := entry.Steps
	if input.Steps != 0 {
		steps = input.Steps
	}
	result, err := mj.Run(model, mj.RunOptions{Width: entry.Length, Height: entry.Width, Depth: entry.Height, Seed: input.Seed, Steps: steps, InitialCells: input.Initial.Cells})
	if err != nil {
		pdk.Output(util.ErrorResponse("generation failed: " + err.Error()))
		return 1
	}
	if input.Output.Grid != "" {
		data, err := json.Marshal(result)
		if err != nil {
			pdk.Output(util.ErrorResponse("failed to marshal grid: " + err.Error()))
			return 1
		}
		if err := writeFile(input.Output.Grid, data); err != nil {
			pdk.Output(util.ErrorResponse("failed to write grid: " + err.Error()))
			return 1
		}
	}
	if input.Output.Tilemap != "" {
		if result.Depth != 1 {
			pdk.Output(util.ErrorResponse("tilemap output requires depth 1"))
			return 1
		}
		if len(input.TileIDs) == 0 {
			pdk.Output(util.ErrorResponse("tileIds is required when output.tilemap is set"))
			return 1
		}
		data, err := json.Marshal(toTileMap(result, input.TileIDs))
		if err != nil {
			pdk.Output(util.ErrorResponse("failed to marshal tilemap: " + err.Error()))
			return 1
		}
		if err := writeFile(input.Output.Tilemap, data); err != nil {
			pdk.Output(util.ErrorResponse("failed to write tilemap: " + err.Error()))
			return 1
		}
	}
	data, err := json.Marshal(result)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal response: " + err.Error()))
		return 1
	}
	pdk.Output(data)
	return 0
}

//go:wasmexport inspect
func Inspect() int32 {
	var input InspectInput
	if err := json.Unmarshal(pdk.Input(), &input); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}
	model, err := loadModel(input.Model, input.ModelXML)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load model: " + err.Error()))
		return 1
	}
	data, err := json.Marshal(mj.Inspect(model))
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal response: " + err.Error()))
		return 1
	}
	pdk.Output(data)
	return 0
}

func resourceRootForModel(modelPath string) string {
	dir := dirname(modelPath)
	if basename(dir) == "models" {
		return dirname(dir)
	}
	return dir
}

func basename(path string) string {
	path = strings.TrimRight(path, "/")
	idx := strings.LastIndex(path, "/")
	if idx < 0 {
		return path
	}
	return path[idx+1:]
}

func dirname(path string) string {
	idx := strings.LastIndex(path, "/")
	if idx < 0 {
		return ""
	}
	return path[:idx]
}

func joinPath(base, rel string) string {
	if base == "" {
		return rel
	}
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(rel, "/")
}

func toTileMap(result *mj.RunResult, tileIDs map[string]uint32) *tilemap.TileMap {
	layer := tilemap.TileLayer{Width: result.Width, Data: make([]uint32, result.Width*result.Height), Props: map[string]string{"name": "markov"}}
	rows := strings.Split(result.Cells, "/")
	for y, row := range rows {
		for x := 0; x < len(row); x++ {
			layer.Data[x+y*result.Width] = tileIDs[string(row[x])]
		}
	}
	return &tilemap.TileMap{Layers: []tilemap.TileLayer{layer}, Props: map[string]string{"generator": "markov"}}
}

func main() {}
