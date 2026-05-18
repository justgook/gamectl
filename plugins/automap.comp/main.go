//go:generate go tool wit-bindgen-go generate --world automap-plugin --out internal ./gams:automap@1.0.0.wasm

package main

import (
	"sort"

	automapwit "github.com/kkgams/automap/internal/gams/automap/automap"
	"github.com/kkgams/sdk/go/tilemap"
	"go.bytecodealliance.org/cm"
)

func init() {
	automapwit.Exports.Apply = func(rules automapwit.TileMap, input automapwit.TileMap, target cm.Option[automapwit.TileMap]) cm.Result[automapwit.TileMapShape, automapwit.TileMap, string] {
		rulesMap := fromWITTileMap(rules)
		inputMap := fromWITTileMap(input)
		if len(inputMap.Layers) == 0 {
			return cm.Err[cm.Result[automapwit.TileMapShape, automapwit.TileMap, string]]("input map has no layers")
		}

		targetMap := tilemap.NewTileMap()
		targetMap.Props = cloneStringMap(inputMap.Props)
		if configuredTarget := target.Some(); configuredTarget != nil {
			targetMap = fromWITTileMap(*configuredTarget)
		}

		outputMap, err := AutomapApplyToTarget(rulesMap, inputMap, targetMap)
		if err != nil {
			return cm.Err[cm.Result[automapwit.TileMapShape, automapwit.TileMap, string]](err.Error())
		}
		return cm.OK[cm.Result[automapwit.TileMapShape, automapwit.TileMap, string]](toWITTileMap(outputMap))
	}
}

func fromWITTileMap(input automapwit.TileMap) *tilemap.TileMap {
	witLayers := input.Layers.Slice()
	layers := make([]tilemap.TileLayer, len(witLayers))
	for i, layer := range witLayers {
		layers[i] = tilemap.TileLayer{
			Width: int(layer.Width),
			Data:  append([]uint32(nil), layer.Data.Slice()...),
			Props: fromWITData(layer.Props),
		}
	}
	return &tilemap.TileMap{
		Layers: layers,
		Props:  fromWITData(input.Props),
	}
}

func toWITTileMap(tm *tilemap.TileMap) automapwit.TileMap {
	layers := make([]automapwit.TileLayer, len(tm.Layers))
	for i, layer := range tm.Layers {
		layers[i] = automapwit.TileLayer{
			Width: uint32(layer.Width),
			Data:  cm.ToList(layer.Data),
			Props: toWITData(layer.Props),
		}
	}
	return automapwit.TileMap{
		Layers: cm.ToList(layers),
		Props:  toWITData(tm.Props),
	}
}

func fromWITData(entries cm.List[automapwit.DataEntry]) map[string]string {
	data := make(map[string]string, entries.Len())
	for _, entry := range entries.Slice() {
		data[entry[0]] = entry[1]
	}
	return data
}

func toWITData(data map[string]string) cm.List[automapwit.DataEntry] {
	entries := make([]automapwit.DataEntry, 0, len(data))
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		entries = append(entries, automapwit.DataEntry{key, data[key]})
	}
	return cm.ToList(entries)
}

// main is required for the `wasi` target, even if it isn't used.
func main() {}
