module github.com/justgook/gams

go 1.25.2

require (
	github.com/justgook/wpm/pdk v0.0.0-20251221185913-c7c21b35f640
	github.com/justgook/wpm/sdk v0.0.0-20251221185913-c7c21b35f640
)

require (
	github.com/tetratelabs/wazero v1.11.0 // indirect
	golang.org/x/sys v0.38.0 // indirect
)

replace github.com/justgook/wpm/pdk => ./third_party/wpm/pdk

replace github.com/justgook/wpm/sdk => ./third_party/wpm/sdk
