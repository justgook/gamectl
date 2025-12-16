package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// TiledMap represents a Tiled JSON map file
type TiledMap struct {
	Width      int             `json:"width"`
	Height     int             `json:"height"`
	Layers     []TiledLayer    `json:"layers"`
	Tilesets   []TiledTileset  `json:"tilesets"`
	Properties []TiledProperty `json:"properties"`
	TileWidth  int             `json:"tilewidth"`
	TileHeight int             `json:"tileheight"`
}

// TiledLayer represents a layer in Tiled format
type TiledLayer struct {
	Name       string          `json:"name"`
	Data       []uint32        `json:"data"`
	Width      int             `json:"width"`
	Height     int             `json:"height"`
	Properties []TiledProperty `json:"properties"`
	Type       string          `json:"type"`
	ID         int             `json:"id"`
}

// TiledTileset represents a tileset reference
type TiledTileset struct {
	FirstGid int    `json:"firstgid"`
	Source   string `json:"source"`
}

// TiledProperty represents a custom property
type TiledProperty struct {
	Name  string      `json:"name"`
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

// LoadTiledMap loads a Tiled JSON map file and converts it to gamectl format
func LoadTiledMap(path string) (*tilemap.TileMap, error) {
	// Read file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	// Parse JSON
	var tiled TiledMap
	if err := json.Unmarshal(data, &tiled); err != nil {
		return nil, fmt.Errorf("parse JSON: %w", err)
	}

	// Convert to gamectl format
	tm := tilemap.NewTileMap()
	tm.Props = make(map[string]string)

	// Set tile dimensions
	tm.Props["tw"] = fmt.Sprintf("%d", tiled.TileWidth)
	tm.Props["th"] = fmt.Sprintf("%d", tiled.TileHeight)

	// Convert map-level properties
	for _, prop := range tiled.Properties {
		tm.Props[prop.Name] = convertPropertyValue(prop)
	}

	// Convert layers
	for _, tiledLayer := range tiled.Layers {
		if tiledLayer.Type != "tilelayer" {
			continue // Skip non-tile layers (objects, etc.)
		}

		layer := tilemap.NewTileLayer(tiledLayer.Width, tiledLayer.Height)
		layer.Props = make(map[string]string)
		layer.Props["name"] = tiledLayer.Name

		// Copy tile data
		copy(layer.Data, tiledLayer.Data)

		// Convert layer properties
		for _, prop := range tiledLayer.Properties {
			layer.Props[prop.Name] = convertPropertyValue(prop)
		}

		tm.Layers = append(tm.Layers, *layer)
	}

	return tm, nil
}

// ExtractLayer extracts a specific layer by name from a tilemap
func ExtractLayer(tm *tilemap.TileMap, layerName string) (*tilemap.TileMap, error) {
	// Create new map with just the specified layer
	result := tilemap.NewTileMap()
	result.Props = make(map[string]string)
	for k, v := range tm.Props {
		result.Props[k] = v
	}

	// Find and copy the layer
	for i := range tm.Layers {
		layer := &tm.Layers[i]
		if layer.Props["name"] == layerName {
			newLayer := tilemap.NewTileLayer(layer.Width, layer.Height())
			newLayer.Props = make(map[string]string)
			for k, v := range layer.Props {
				newLayer.Props[k] = v
			}
			copy(newLayer.Data, layer.Data)
			result.Layers = append(result.Layers, *newLayer)
			return result, nil
		}
	}

	return nil, fmt.Errorf("layer '%s' not found", layerName)
}

// convertPropertyValue converts a Tiled property to a string
func convertPropertyValue(prop TiledProperty) string {
	switch prop.Type {
	case "bool":
		if b, ok := prop.Value.(bool); ok && b {
			return "true"
		}
		return "false"
	case "int", "float":
		return fmt.Sprintf("%v", prop.Value)
	default:
		return fmt.Sprintf("%v", prop.Value)
	}
}
