from pathlib import Path
import subprocess
import sys


def output_path(src: Path) -> Path:
    if src.parent == Path("."):
        return src.with_suffix(src.suffix + ".odin")
    return src.with_name(f"gen__{src.stem}.odin")


def expected_package(src: Path) -> str:
    return "game2" if src.parent == Path(".") else src.parent.name


def normalize_package(src: Path, out: Path) -> None:
    lines = out.read_text().splitlines()
    if lines and lines[0].startswith("package ") and lines[0] == "package main":
        lines[0] = f"package {expected_package(src)}"
        out.write_text("\n".join(lines) + "\n")


def main() -> int:
    shdc = Path(sys.argv[1])
    for src in sorted(Path(".").rglob("*.glsl")):
        out = output_path(src)
        subprocess.run(
            [
                str(shdc),
                "-i",
                str(src),
                "-o",
                str(out),
                "-l",
                "glsl300es:metal_macos",
                "-f",
                "sokol_odin",
            ],
            check=True,
        )
        normalize_package(src, out)
    return 0


raise SystemExit(main())
