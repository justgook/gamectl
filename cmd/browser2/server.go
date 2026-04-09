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
	port := flag.String("port", "8082", "Port to run the server on")
	flag.Parse()

	cwd, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}

	buildDirName := os.Getenv("BUILD_DIR")
	if buildDirName == "" {
		buildDirName = "build.nosync"
	}

	browserDir := filepath.Join(cwd, "cmd", "browser2")
	buildDir := filepath.Join(cwd, buildDirName)

	fmt.Printf("GAMS Browser2 IDE Server\n")
	fmt.Printf("   Current Working Directory: %s\n", cwd)
	fmt.Printf("   Browser files: %s\n", browserDir)
	fmt.Printf("   Build files:   %s (via /build/)\n", buildDir)
	fmt.Printf("   Starting server on http://localhost:%s\n\n", *port)

	http.Handle("/", http.FileServer(http.Dir(browserDir)))
	http.Handle(
		"/plugins/",
		http.StripPrefix(
			"/plugins/",
			http.FileServer(http.Dir(filepath.Join(buildDir, "plugins"))),
		),
	)

	handler := corsMiddleware(http.DefaultServeMux)

	log.Fatal(http.ListenAndServe(":"+*port, handler))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")

		if filepath.Ext(r.URL.Path) == ".wasm" {
			w.Header().Set("Content-Type", "application/wasm")
			w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")
		}

		next.ServeHTTP(w, r)
	})
}
