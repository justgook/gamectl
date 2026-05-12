{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "tauri-app";

  nativeBuildInputs = [
    pkgs.git
    pkgs.which
    pkgs.rustc
    pkgs.cargo
    pkgs.cargo-binstall
    pkgs.libiconv
    pkgs.curl
    pkgs.gnutar
    pkgs.gzip
    pkgs.cacert
  ];

  shellHook = ''
    set -euo pipefail

    export GAMS_DEV_TOOLS="$PWD/.dev-tools"
    export CARGO_INSTALL_ROOT="$GAMS_DEV_TOOLS/cargo"
    export PATH="$CARGO_INSTALL_ROOT/bin:$PATH"

    install_cargo_tool() {
      local bin="$1"
      local crate="$2"
      shift 2

      if ! command -v "$bin" >/dev/null 2>&1; then
        echo "Installing $crate into $CARGO_INSTALL_ROOT ..."
        cargo install --root "$CARGO_INSTALL_ROOT" "$@" "$crate"
      fi
    }

    install_cargo_binary_tool() {
      local bin="$1"
      local crate="$2"
      shift 2

      if ! command -v "$bin" >/dev/null 2>&1; then
        echo "Installing prebuilt $crate into $CARGO_INSTALL_ROOT ..."
        cargo binstall --root "$CARGO_INSTALL_ROOT" --no-confirm --disable-strategies compile "$@" "$crate"
      fi
    }

    install_cargo_tool wit-bindgen wit-bindgen-cli
    install_cargo_tool wasm-tools wasm-tools --locked
    install_cargo_binary_tool wkg wkg
    install_cargo_binary_tool cargo-tauri tauri-cli

    wasi_sdk_release="33"
    wasi_sdk_version="33.0"

    case "$(uname -s)-$(uname -m)" in
      Darwin-x86_64) wasi_sdk_platform="x86_64-macos" ;;
      Darwin-arm64)  wasi_sdk_platform="arm64-macos" ;;
      Linux-x86_64)  wasi_sdk_platform="x86_64-linux" ;;
      Linux-aarch64) wasi_sdk_platform="arm64-linux" ;;
      *) echo "Unsupported WASI SDK platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
    esac

    wasi_sdk_dir="$GAMS_DEV_TOOLS/wasi-sdk-$wasi_sdk_version-$wasi_sdk_platform"

    prepare_macos_wasi_sdk() {
      if [ "$(uname -s)" != "Darwin" ]; then
        return
      fi

      local prepared_stamp="$wasi_sdk_dir/.gams-macos-prepared"
      if [ -f "$prepared_stamp" ]; then
        return
      fi

      echo "Preparing WASI SDK for macOS Gatekeeper ..."

      # GitHub release archives can arrive with quarantine metadata depending on
      # local download policy. Remove every extended attribute, not just the
      # quarantine one, so symlink targets and helper tools are covered too.
      /usr/bin/xattr -cr "$wasi_sdk_dir"

      # Only sign executable tools in bin/. Signing every Mach-O in the SDK is
      # very slow on macOS and rewrites large dylibs unnecessarily. The tools in
      # bin/ are what Gatekeeper blocks interactively, e.g. clang-22/lld.
      while IFS= read -r -d "" f; do
        if /usr/bin/file "$f" | grep -q "Mach-O"; then
          if ! /usr/bin/codesign --verify "$f" >/dev/null 2>&1; then
            /usr/bin/codesign --force --sign - "$f"
          fi
        fi
      done < <(find "$wasi_sdk_dir/bin" -type f -perm -111 -print0)

      touch "$prepared_stamp"
    }

    if [ ! -x "$wasi_sdk_dir/bin/clang" ]; then
      wasi_sdk_archive="wasi-sdk-$wasi_sdk_version-$wasi_sdk_platform.tar.gz"
      wasi_sdk_url="https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-$wasi_sdk_release/$wasi_sdk_archive"

      echo "Installing WASI SDK $wasi_sdk_version into $GAMS_DEV_TOOLS ..."
      mkdir -p "$GAMS_DEV_TOOLS"
      tmpdir="$(mktemp -d)"
      trap 'rm -rf "$tmpdir"' EXIT
      curl --fail --location "$wasi_sdk_url" --output "$tmpdir/$wasi_sdk_archive"
      tar -xzf "$tmpdir/$wasi_sdk_archive" -C "$GAMS_DEV_TOOLS"
      rm -rf "$tmpdir"
      trap - EXIT
    fi

    prepare_macos_wasi_sdk

    export WASI_SDK_PATH="$wasi_sdk_dir"
    export WASI_SYSROOT="$WASI_SDK_PATH/share/wasi-sysroot"

    # Keep native host builds native. Tauri/macOS crates use `clang` for
    # Objective-C/C build scripts, so the WASI SDK must not shadow the host
    # compiler. WASI tools such as `wasm32-wasip2-clang` remain available via
    # the appended SDK path.
    export PATH="$PATH:$WASI_SDK_PATH/bin"

    echo "GAMS dev tools ready:"
    echo "  cargo tools: $CARGO_INSTALL_ROOT/bin"
    echo "  WASI_SDK_PATH: $WASI_SDK_PATH"
  '';
}
