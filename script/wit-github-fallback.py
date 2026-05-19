#!/usr/bin/env python3
"""Build a WIT package without the WKG/GHCR registry path.

This is a fallback for machines where `wkg wit build` cannot resolve WASI
packages from ghcr.io (for example, stale/invalid GitHub bearer tokens). It
copies the local WIT package into build.nosync, downloads referenced WASI WIT
packages directly from GitHub, and asks `wasm-tools component wit --wasm` to
produce the same binary WIT package that wit-bindgen/tinygo expect.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD_ROOT = ROOT / "build.nosync" / "wit-github-fallback"

WASI_REPOS = {
    "cli": "wasi-cli",
    "clocks": "wasi-clocks",
    "filesystem": "wasi-filesystem",
    "io": "wasi-io",
    "random": "wasi-random",
    "sockets": "wasi-sockets",
}

REF_RE = re.compile(r"\bwasi:([a-z0-9-]+)/[A-Za-z0-9_.%-]+@([0-9]+\.[0-9]+\.[0-9]+)")
PACKAGE_RE = re.compile(r"\bpackage\s+([^;\s]+)")


def fail(message: str) -> None:
    print(f"wit-github-fallback: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def collect_wasi_refs(wit_tree: Path) -> set[tuple[str, str]]:
    refs: set[tuple[str, str]] = set()
    for path in wit_tree.rglob("*.wit"):
        refs.update(REF_RE.findall(read_text(path)))
    return refs


def package_name(package_dir: Path) -> str:
    for path in package_dir.glob("*.wit"):
        match = PACKAGE_RE.search(read_text(path))
        if match:
            return match.group(1).split(":", 1)[1].split("@", 1)[0]
    return package_dir.name


def github_json(url: str):
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def download_url(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"Accept": "application/octet-stream"})
    with urllib.request.urlopen(request, timeout=30) as response:
        destination.write_bytes(response.read())


def github_ref(repo: str, version: str) -> str:
    return f"v{version}"


def download_github_dir(repo: str, ref: str, github_path: str, destination: Path) -> None:
    url = f"https://api.github.com/repos/WebAssembly/{repo}/contents/{github_path}?ref={ref}"
    try:
        entries = github_json(url)
    except urllib.error.HTTPError as exc:
        fail(f"cannot fetch WebAssembly/{repo}/{github_path} at {ref}: HTTP {exc.code}")
    destination.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        target = destination / entry["name"]
        if entry["type"] == "file":
            print(f"  download {entry['path']}")
            download_url(entry["download_url"], target)
        elif entry["type"] == "dir":
            download_github_dir(repo, ref, entry["path"], target)


def copy_nested_deps_to_top_level(deps_dir: Path) -> None:
    # wasm-tools resolves dependency packages from one top-level deps directory.
    # Some WASI repositories vendor their own deps under <pkg>/deps; flatten those.
    changed = True
    while changed:
        changed = False
        for nested in list(deps_dir.glob("*/deps/*")):
            if not nested.is_dir():
                continue
            name = package_name(nested)
            target = deps_dir / name
            if target.exists():
                continue
            shutil.copytree(nested, target)
            changed = True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wit-dir", default="wit", help="local WIT directory")
    parser.add_argument("--output", required=True, help="output .wasm WIT package path")
    args = parser.parse_args()

    source_wit = Path(args.wit_dir).resolve()
    output = Path(args.output).resolve()
    if not source_wit.is_dir():
        fail(f"WIT directory does not exist: {source_wit}")

    try:
        output_key = output.parent.resolve().relative_to(ROOT).as_posix().replace("/", "__")
    except ValueError:
        output_key = hashlib.sha256(str(output.parent.resolve()).encode("utf-8")).hexdigest()[:16]
    work = BUILD_ROOT / output_key / output.name
    if work.exists():
        shutil.rmtree(work)
    work_wit = work / "wit"
    shutil.copytree(source_wit, work_wit)
    deps_dir = work_wit / "deps"
    deps_dir.mkdir(parents=True, exist_ok=True)

    refs = collect_wasi_refs(work_wit)
    if not refs:
        fail(f"no WASI package references found in {source_wit}")

    print("wit-github-fallback: downloading WASI WIT dependencies directly from GitHub")
    for package, version in sorted(refs):
        repo = WASI_REPOS.get(package)
        if repo is None:
            fail(f"no GitHub repository mapping for wasi:{package}@{version}")
        target = deps_dir / package
        if target.exists():
            continue
        print(f"fetch wasi:{package}@{version} from WebAssembly/{repo}")
        download_github_dir(repo, github_ref(repo, version), "wit", target)
        copy_nested_deps_to_top_level(deps_dir)

    # Newly flattened dependency WIT can reference more WASI packages. Resolve until stable.
    while True:
        unresolved = [(p, v) for p, v in sorted(collect_wasi_refs(work_wit)) if not (deps_dir / p).exists()]
        if not unresolved:
            break
        for package, version in unresolved:
            repo = WASI_REPOS.get(package)
            if repo is None:
                fail(f"no GitHub repository mapping for wasi:{package}@{version}")
            print(f"fetch wasi:{package}@{version} from WebAssembly/{repo}")
            download_github_dir(repo, github_ref(repo, version), "wit", deps_dir / package)
            copy_nested_deps_to_top_level(deps_dir)

    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "wasm-tools",
        "component",
        "wit",
        str(work_wit),
        "--wasm",
        "-o",
        str(output),
    ], check=True)
    print(f"wit-github-fallback: wrote {output}")


if __name__ == "__main__":
    main()
