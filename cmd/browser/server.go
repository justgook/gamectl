package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	port := flag.String("port", "8080", "Port to run the server on")
	flag.Parse()

	// Get the current working directory (should be project root when run with make)
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}

	// Serve cmd/browser directory
	browserDir := filepath.Join(cwd, "cmd", "browser")

	// Serve build.nosync directory for WASM plugins
	buildDir := filepath.Join(cwd, "build.nosync")

	fmt.Printf("🚀 GameCtl Browser IDE Server\n")
	fmt.Printf("   Current Working Directory: %s\n", cwd)
	fmt.Printf("   Browser files: %s\n", browserDir)
	fmt.Printf("   Build files:   %s\n", buildDir)
	fmt.Printf("   Starting server on http://localhost:%s\n\n", *port)

	// Create a file server for the browser directory
	http.Handle("/", http.FileServer(http.Dir(browserDir)))

	// Create a file server for the build directory
	http.Handle("/build.nosync/", http.StripPrefix("/build.nosync/", http.FileServer(http.Dir(buildDir))))

	// Add CORS headers for WASM
	handler := corsMiddleware(http.DefaultServeMux)

	log.Fatal(http.ListenAndServe(":"+*port, handler))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")

		// For WASM files
		if filepath.Ext(r.URL.Path) == ".wasm" {
			w.Header().Set("Content-Type", "application/wasm")
			w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")
		}

		next.ServeHTTP(w, r)
	})
}
