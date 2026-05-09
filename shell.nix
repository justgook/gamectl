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
}
