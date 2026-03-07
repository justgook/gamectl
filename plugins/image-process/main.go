package main

import (
	"encoding/json"

	"github.com/justgook/wpm/pdk"
)

type compatResponse struct {
	OK      bool   `json:"ok"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func compatError() []byte {
	data, _ := json.Marshal(compatResponse{
		OK:      false,
		Code:    "deprecated_plugin",
		Message: "image-process is deprecated; use the image plugin instead",
	})
	return data
}

func failDeprecated() int32 {
	pdk.Output(compatError())
	return 1
}

//go:wasmexport info
func Info() int32 { return failDeprecated() }

//go:wasmexport decode
func Decode() int32 { return failDeprecated() }

//go:wasmexport getData
func GetData() int32 { return failDeprecated() }

//go:wasmexport setData
func SetData() int32 { return failDeprecated() }

//go:wasmexport freeData
func FreeData() int32 { return failDeprecated() }

//go:wasmexport encode
func Encode() int32 { return failDeprecated() }

//go:wasmexport crop
func Crop() int32 { return failDeprecated() }

//go:wasmexport cropAlpha
func CropAlpha() int32 { return failDeprecated() }

//go:wasmexport split
func Split() int32 { return failDeprecated() }

//go:wasmexport combine
func Combine() int32 { return failDeprecated() }

func main() {}
