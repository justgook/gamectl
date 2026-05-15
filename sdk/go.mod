module github.com/kkgams/sdk

go 1.25.2

require (
	github.com/bytecodealliance/wasmtime-go/v43 v43.0.2
	github.com/justgook/wpm/pdk v0.0.0-20251221185913-c7c21b35f640
)

replace github.com/justgook/wpm/pdk => ../third_party/wpm/pdk
