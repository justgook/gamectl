{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "tauri-app";

  nativeBuildInputs = [
    pkgs.git
    pkgs.which
    pkgs.rustc
    pkgs.cargo
    pkgs.libiconv
  ];

  # Keep build_odin.sh on the toolchain provided by this shell instead of any
  # clang/llvm-config that may be installed in the user's global profile.
  # CXX = "clang++";
  # LLVM_CONFIG = "llvm-config";
}
