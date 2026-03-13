package desktopassets

import "embed"

//go:embed cmd/browser/app.js
//go:embed cmd/browser/base.css
//go:embed cmd/browser/coi-serviceworker.js
//go:embed cmd/browser/favicon.svg
//go:embed cmd/browser/index.html
//go:embed cmd/browser/MaterialSymbolsRounded*.woff2
//go:embed cmd/browser/reset.css
//go:embed cmd/browser/splash-screen.js
//go:embed cmd/browser/timeline-mock.html
//go:embed cmd/browser/timeline-mock2.html
//go:embed cmd/browser/assets/**
//go:embed cmd/browser/data/**
//go:embed cmd/browser/example/**
//go:embed cmd/browser/fonts/**
//go:embed cmd/browser/splash/**
//go:embed cmd/browser/systems/**
//go:embed cmd/browser/themes/**
//go:embed cmd/browser/util/**
//go:embed cmd/browser/views/**
//go:embed build.nosync/plugins/*.wasm
var FS embed.FS
