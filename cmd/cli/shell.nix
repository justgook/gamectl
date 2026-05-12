{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "my-wasm-component";

  nativeBuildInputs = [
    pkgs.git
    pkgs.which
    pkgs.rustc
    pkgs.cargo
    pkgs.wasmtime
    pkgs.libiconv
  ];
}
