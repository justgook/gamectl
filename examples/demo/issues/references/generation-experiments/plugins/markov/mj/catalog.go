package mj

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
)

type ModelEntry struct {
	Name   string
	Length int
	Width  int
	Height int
	Dim    int
	Steps  int
	Amount int
	Index  int
}

type modelsXML struct {
	Entries []modelEntryXML `xml:"model"`
}

type modelEntryXML struct {
	Name   string `xml:"name,attr"`
	Size   string `xml:"size,attr"`
	D      string `xml:"d,attr"`
	Length string `xml:"length,attr"`
	Width  string `xml:"width,attr"`
	Height string `xml:"height,attr"`
	Steps  string `xml:"steps,attr"`
	Amount string `xml:"amount,attr"`
}

func ParseModelsXML(data []byte) ([]ModelEntry, error) {
	var doc modelsXML
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	entries := make([]ModelEntry, 0, len(doc.Entries))
	for i, x := range doc.Entries {
		if strings.TrimSpace(x.Name) == "" {
			return nil, fmt.Errorf("model entry %d has empty name", i)
		}
		size := parseIntDefault(x.Size, -1)
		dim := parseIntDefault(x.D, 2)
		length := parseIntDefault(x.Length, size)
		width := parseIntDefault(x.Width, size)
		heightDefault := 1
		if dim != 2 {
			heightDefault = size
		}
		height := parseIntDefault(x.Height, heightDefault)
		steps := parseIntDefault(x.Steps, 0)
		amount := parseIntDefault(x.Amount, 2)
		entries = append(entries, ModelEntry{Name: x.Name, Length: length, Width: width, Height: height, Dim: dim, Steps: steps, Amount: amount, Index: i})
	}
	return entries, nil
}

func FindModelEntry(entries []ModelEntry, name string, occurrence int) (ModelEntry, error) {
	seen := 0
	for _, entry := range entries {
		if entry.Name != name {
			continue
		}
		if seen == occurrence {
			return entry, nil
		}
		seen++
	}
	if occurrence == 0 {
		return ModelEntry{}, fmt.Errorf("model entry not found: %s", name)
	}
	return ModelEntry{}, fmt.Errorf("model entry not found: %s occurrence %d", name, occurrence)
}

func parseIntDefault(s string, def int) int {
	if strings.TrimSpace(s) == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}
