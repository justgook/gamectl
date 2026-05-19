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
import io
import os
import re
import shutil
import subprocess
import sys
import tarfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD_ROOT = ROOT / "build.nosync" / "wit-github-fallback"
CACHE_ROOT = BUILD_ROOT / "cache"

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


def github_ref(repo: str, version: str) -> str:
    return f"v{version}"


def download_github_wit(repo: str, ref: str, destination: Path) -> None:
    # Use the repository tarball instead of the GitHub contents API. This is
    # one request per package and is much less likely to hit API rate limits.
    url = f"https://codeload.github.com/WebAssembly/{repo}/tar.gz/refs/tags/{ref}"
    request = urllib.request.Request(url, headers={"Accept": "application/octet-stream"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            archive = response.read()
    except urllib.error.HTTPError as exc:
        fail(f"cannot fetch WebAssembly/{repo} at {ref}: HTTP {exc.code}")

    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        for member in tar.getmembers():
            parts = Path(member.name).parts
            if len(parts) < 3 or parts[1] != "wit" or not member.isfile():
                continue
            relative = Path(*parts[2:])
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            source = tar.extractfile(member)
            if source is None:
                fail(f"cannot extract {member.name} from WebAssembly/{repo}@{ref}")
            target.write_bytes(source.read())


def cached_wasi_package(package: str, version: str, repo: str) -> Path:
    cache_dir = CACHE_ROOT / "wasi" / package / version
    marker = cache_dir / ".complete"
    if marker.exists():
        print(f"cache hit wasi:{package}@{version}")
        return cache_dir

    ref = github_ref(repo, version)
    tmp_dir = cache_dir.with_name(f".{version}.tmp")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    print(f"fetch wasi:{package}@{version} from WebAssembly/{repo}")
    download_github_wit(repo, ref, tmp_dir)
    cache_dir.parent.mkdir(parents=True, exist_ok=True)
    if cache_dir.exists():
        shutil.rmtree(cache_dir)
    tmp_dir.rename(cache_dir)
    (cache_dir / ".complete").write_text("ok\n", encoding="utf-8")
    return cache_dir


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

    print(f"wit-github-fallback: using WASI WIT cache at {CACHE_ROOT}")
    for package, version in sorted(refs):
        repo = WASI_REPOS.get(package)
        if repo is None:
            fail(f"no GitHub repository mapping for wasi:{package}@{version}")
        target = deps_dir / package
        if target.exists():
            continue
        shutil.copytree(cached_wasi_package(package, version, repo), target, ignore=shutil.ignore_patterns(".complete"))
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
            shutil.copytree(cached_wasi_package(package, version, repo), deps_dir / package, ignore=shutil.ignore_patterns(".complete"))
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
