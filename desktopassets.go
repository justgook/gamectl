package desktopassets

import "embed"

//go:embed cmd/browser/app.js
//go:embed cmd/browser/base.css
//go:embed cmd/browser/coi-serviceworker.js
//go:embed cmd/browser/favicon.svg
//go:embed cmd/browser/index.html
//go:embed cmd/browser/MaterialSymbolsRounded*.woff2
//go:embed cmd/browser/reset.css
//go:embed cmd/browser/core/**
//go:embed demo/**
//go:embed cmd/browser/fonts/**
//go:embed cmd/browser/themes/**
//go:embed cmd/browser/ui-plugins/**
//go:embed cmd/browser/util/**
//go:embed cmd/browser/views/**
//go:embed cmd/browser/widgets/**
//go:embed build.nosync/plugins/*.wasm
var FS embed.FS
