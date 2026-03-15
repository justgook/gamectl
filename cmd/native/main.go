package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	desktopassets "github.com/justgook/gams"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	macoptions "github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func main() {
	inspectorEnabled := envEnabled("GAMS_OPEN_INSPECTOR", "GAMECTL_OPEN_INSPECTOR")
	debugLoggingEnabled := envEnabled("GAMS_DEBUG", "GAMECTL_DEBUG")
	serverAddr := firstEnv("GAMS_NATIVE_ADDR", "GAMECTL_NATIVE_ADDR")
	if serverAddr == "" {
		serverAddr = "127.0.0.1:38473"
	}
	var appCtx context.Context

	browserFS, err := fs.Sub(desktopassets.FS, "cmd/browser")
	if err != nil {
		log.Fatalf("browser assets: %v", err)
	}

	pluginFS, err := fs.Sub(desktopassets.FS, "build.nosync/plugins")
	if err != nil {
		log.Fatalf("plugin assets: %v", err)
	}

	loopbackServer, targetURL, err := startLoopbackServer(serverAddr, browserFS, pluginFS)
	if err != nil {
		log.Fatalf("loopback server: %v", err)
	}

	err = wails.Run(&options.App{
		Title:                    "GAMS",
		Width:                    1440,
		Height:                   960,
		MinWidth:                 960,
		MinHeight:                640,
		EnableDefaultContextMenu: true,
		Menu:                     buildApplicationMenu(func() { reloadWindow(appCtx) }, func() { openInspector(appCtx) }),
		AssetServer: &assetserver.Options{
			Handler: bootstrapHandler(targetURL),
			Middleware: func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					next.ServeHTTP(w, r)
				})
			},
		},
		BackgroundColour: &options.RGBA{R: 18, G: 22, B: 27, A: 1},
		Debug: options.Debug{
			OpenInspectorOnStartup: inspectorEnabled,
		},
		Mac: &macoptions.Options{
			TitleBar: macoptions.TitleBarHiddenInset(),
		},
		OnStartup: func(ctx context.Context) {
			appCtx = ctx
			if debugLoggingEnabled {
				log.Printf("[native] startup inspector=%t target=%s", inspectorEnabled, targetURL)
			}
		},
		OnShutdown: func(ctx context.Context) {
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			_ = loopbackServer.Shutdown(shutdownCtx)
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}

func envEnabled(names ...string) bool {
	return firstEnv(names...) == "1"
}

func firstEnv(names ...string) string {
	for _, name := range names {
		if value := os.Getenv(name); value != "" {
			return value
		}
	}
	return ""
}

func buildApplicationMenu(reload func(), openInspector func()) *menu.Menu {
	appMenu := menu.NewMenu()
	appMenu.Append(menu.AppMenu())
	appMenu.Append(menu.EditMenu())

	viewMenu := appMenu.AddSubmenu("View")
	viewMenu.AddText("Reload", keys.CmdOrCtrl("r"), func(_ *menu.CallbackData) {
		reload()
	})
	viewMenu.AddText("Open Inspector", keys.Combo("i", keys.CmdOrCtrlKey, keys.OptionOrAltKey), func(_ *menu.CallbackData) {
		openInspector()
	})

	appMenu.Append(menu.WindowMenu())
	return appMenu
}

func reloadWindow(ctx context.Context) {
	if ctx == nil {
		return
	}
	runtime.WindowReload(ctx)
}

func openInspector(ctx context.Context) {
	if ctx == nil {
		return
	}
	runtime.WindowExecJS(ctx, `(() => {
	  if (window.WailsInvoke) {
	    window.WailsInvoke("wails:openInspector")
	    return
	  }
	  if (window.chrome?.webview?.postMessage) {
	    window.chrome.webview.postMessage("wails:openInspector")
	    return
	  }
	  if (window.webkit?.messageHandlers?.external?.postMessage) {
	    window.webkit.messageHandlers.external.postMessage("wails:openInspector")
	  }
	})()`)
}

func startLoopbackServer(addr string, browserFS fs.FS, pluginFS fs.FS) (*http.Server, string, error) {
	server := &http.Server{
		Addr:    addr,
		Handler: isolationMiddleware(newEmbeddedAssetServer(browserFS, pluginFS)),
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, "", fmt.Errorf("listen on %s: %w", addr, err)
	}

	go func() {
		err := server.Serve(listener)
		if err != nil && err != http.ErrServerClosed {
			log.Printf("[native] loopback server stopped: %v", err)
		}
	}()

	targetURL := (&url.URL{Scheme: "http", Host: addr, Path: "/"}).String()
	healthURL := (&url.URL{Scheme: "http", Host: addr, Path: "/__native__/health"}).String()
	if err := waitForServer(healthURL, 2*time.Second); err != nil {
		return nil, "", err
	}

	return server, targetURL, nil
}

func waitForServer(healthURL string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(healthURL)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	return fmt.Errorf("timed out waiting for loopback server at %s", healthURL)
}

func bootstrapHandler(targetURL string) http.Handler {
	bootstrapHTML := fmt.Sprintf(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>GAMS</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b0c10; color: #e8eaf0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, sans-serif; }
      .card { padding: 20px 24px; border: 1px solid #262a36; background: #11131a; max-width: 520px; }
      code { color: #8fd3ff; }
    </style>
  </head>
  <body>
    <div class="card">
      Launching desktop workbench...<br>
      If this screen persists, open the inspector with <code>Cmd+Option+I</code>.
    </div>
    <script>window.location.replace(%q)</script>
  </body>
</html>`, targetURL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(bootstrapHTML))
	})
}

func isolationMiddleware(next http.Handler) http.Handler {
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

func newEmbeddedAssetServer(browserFS fs.FS, pluginFS fs.FS) http.Handler {
	browserHandler := http.FileServerFS(browserFS)
	pluginHandler := http.StripPrefix("/plugins/", http.FileServerFS(pluginFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := filepath.Clean(r.URL.Path)
		if cleanPath == "." {
			cleanPath = "/"
		}

		if cleanPath == "/__native__/health" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
			return
		}

		if strings.HasPrefix(cleanPath, "/plugins/") {
			pluginHandler.ServeHTTP(w, r)
			return
		}

		browserHandler.ServeHTTP(w, r)
	})
}
