use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
enum Mount {
    HttpManifest { files: BTreeMap<String, PathBuf> },
    Native { root: PathBuf },
    Internal { root: PathBuf },
    WebDav { base_url: String },
}

#[derive(Debug)]
struct ResolvedPath<'a> {
    mount_name: String,
    mount: &'a Mount,
    path: String,
}

pub struct VirtualFs {
    repo_root: PathBuf,
    mounts: BTreeMap<String, Mount>,
}

#[derive(Deserialize)]
struct GamsConfig {
    fs: FsConfig,
}

#[derive(Deserialize)]
struct FsConfig {
    mount: BTreeMap<String, MountConfig>,
}

#[derive(Deserialize)]
#[serde(tag = "driver")]
enum MountConfig {
    #[serde(rename = "http")]
    Http { files: Vec<HttpFileConfig> },
    #[serde(rename = "native")]
    Native { root: String },
    #[serde(rename = "internal")]
    Internal { root: Option<String> },
    #[serde(rename = "webdav")]
    WebDav { #[serde(rename = "baseUrl")] base_url: String },
}

#[derive(Deserialize)]
struct HttpFileConfig {
    path: String,
    url: String,
}

impl VirtualFs {
    pub fn load_default() -> Result<Self, String> {
        let repo_root = find_repo_root()?;
        let config_path = repo_root.join("examples/demo/gams.json");
        let bytes = std::fs::read(&config_path)
            .map_err(|error| format!("failed to read {}: {error}", config_path.display()))?;
        let config: GamsConfig = serde_json::from_slice(&bytes)
            .map_err(|error| format!("failed to parse {}: {error}", config_path.display()))?;

        let mut mounts = BTreeMap::new();
        for (raw_name, mount) in config.fs.mount {
            let name = normalize_mount_name(&raw_name)?;
            if mounts.contains_key(&name) {
                return Err(format!("duplicate mount '{name}'"));
            }

            let mount = match mount {
                MountConfig::Http { files } => {
                    let mut mapped_files = BTreeMap::new();
                    for file in files {
                        let path = normalize_path(&file.path)?;
                        let target = resolve_http_manifest_url(&repo_root, &file.url)?;
                        mapped_files.insert(path, target);
                    }
                    Mount::HttpManifest { files: mapped_files }
                }
                MountConfig::Native { root } => Mount::Native { root: PathBuf::from(root) },
                MountConfig::Internal { root } => {
                    let root = root
                        .map(PathBuf::from)
                        .unwrap_or_else(|| repo_root.join(".gams/internal"));
                    Mount::Internal { root }
                }
                MountConfig::WebDav { base_url } => Mount::WebDav { base_url },
            };

            mounts.insert(name, mount);
        }

        mounts.entry("internal".to_string()).or_insert_with(|| Mount::Internal {
            root: repo_root.join(".gams/internal"),
        });

        Ok(Self { repo_root, mounts })
    }

    pub fn call(&self, method: &str, input: Vec<u8>) -> Result<Vec<u8>, String> {
        match method {
            "read" => self.read(input_as_path(&input)?),
            "readText" | "read_text" => self.read(input_as_path(&input)?),
            "write" => self.write_json(&input),
            "writeText" | "write_text" => self.write_text_json(&input),
            "list" => json_bytes(&self.list(input_as_path(&input)?)?),
            "stat" => json_bytes(&self.stat(input_as_path(&input)?)?),
            "exists" => json_bytes(&self.exists(input_as_path(&input)?)),
            "mounts" => json_bytes(&self.mounts_json()),
            _ => Err(format!("fs does not implement method '{method}'")),
        }
    }

    pub fn call_driver(&self, driver: &str, method: &str, _input: Vec<u8>) -> Result<Vec<u8>, String> {
        match method {
            "ping" => Ok(format!("{driver}:pong").into_bytes()),
            "info" => json_bytes(&serde_json::json!({
                "id": format!("fs-{driver}"),
                "driver": driver,
                "mounted": self.mounts.values().filter(|mount| mount.driver() == driver).count()
            })),
            _ => Err(format!("fs-{driver} does not implement method '{method}' yet")),
        }
    }

    fn read(&self, path: &str) -> Result<Vec<u8>, String> {
        let resolved = self.resolve(path)?;
        match resolved.mount {
            Mount::HttpManifest { files } => {
                let target = files.get(&resolved.path).ok_or_else(|| {
                    format!("mounted file not found: {}/{}", resolved.mount_name, resolved.path)
                })?;
                std::fs::read(target).map_err(|error| format!("failed to read {}: {error}", target.display()))
            }
            Mount::Native { root } | Mount::Internal { root } => {
                let target = safe_join(root, &resolved.path)?;
                std::fs::read(&target).map_err(|error| format!("failed to read {}: {error}", target.display()))
            }
            Mount::WebDav { .. } => Err("webdav read is not implemented yet".to_string()),
        }
    }

    fn write_json(&self, input: &[u8]) -> Result<Vec<u8>, String> {
        #[derive(Deserialize)]
        struct WriteInput {
            path: String,
            bytes: Vec<u8>,
        }
        let input: WriteInput = serde_json::from_slice(input).map_err(|error| error.to_string())?;
        self.write_bytes(&input.path, &input.bytes)
    }

    fn write_text_json(&self, input: &[u8]) -> Result<Vec<u8>, String> {
        #[derive(Deserialize)]
        struct WriteTextInput {
            path: String,
            text: String,
        }
        let input: WriteTextInput = serde_json::from_slice(input).map_err(|error| error.to_string())?;
        self.write_bytes(&input.path, input.text.as_bytes())
    }

    fn write_bytes(&self, path: &str, bytes: &[u8]) -> Result<Vec<u8>, String> {
        let resolved = self.resolve(path)?;
        match resolved.mount {
            Mount::Native { root } | Mount::Internal { root } => {
                let target = safe_join(root, &resolved.path)?;
                let parent = target.parent().ok_or_else(|| format!("invalid target path {}", target.display()))?;
                std::fs::create_dir_all(parent).map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
                std::fs::write(&target, bytes).map_err(|error| format!("failed to write {}: {error}", target.display()))?;
                Ok(Vec::new())
            }
            Mount::HttpManifest { .. } => Err("http manifest mounts are read-only".to_string()),
            Mount::WebDav { .. } => Err("webdav write is not implemented yet".to_string()),
        }
    }

    fn list(&self, path: &str) -> Result<Value, String> {
        let normalized = normalize_input_path(path)?;
        if normalized.is_empty() {
            return Ok(Value::Array(self.mounts.keys().map(|name| entry_json(name, name, "directory", 0)).collect()));
        }

        if let Some(mount) = self.mounts.get(&normalized) {
            return self.list_mount_root(&normalized, mount);
        }

        let resolved = self.resolve(&normalized)?;
        match resolved.mount {
            Mount::HttpManifest { files } => {
                let prefix = if resolved.path.is_empty() { String::new() } else { format!("{}/", resolved.path) };
                let mut children = BTreeSet::new();
                for path in files.keys() {
                    if !path.starts_with(&prefix) { continue; }
                    let rest = &path[prefix.len()..];
                    if rest.is_empty() { continue; }
                    children.insert(rest.split('/').next().unwrap().to_string());
                }
                Ok(Value::Array(children.into_iter().map(|name| {
                    entry_json(&name, &format!("{}/{}/{}", resolved.mount_name, resolved.path, name).replace("//", "/"), "unknown", 0)
                }).collect()))
            }
            Mount::Native { root } | Mount::Internal { root } => {
                let dir = safe_join(root, &resolved.path)?;
                let mut entries = Vec::new();
                for item in std::fs::read_dir(&dir).map_err(|error| format!("failed to list {}: {error}", dir.display()))? {
                    let item = item.map_err(|error| error.to_string())?;
                    let metadata = item.metadata().map_err(|error| error.to_string())?;
                    let name = item.file_name().to_string_lossy().to_string();
                    let kind = if metadata.is_dir() { "directory" } else { "file" };
                    entries.push(entry_json(&name, &format!("{}/{}/{}", resolved.mount_name, resolved.path, name).replace("//", "/"), kind, metadata.len()));
                }
                Ok(Value::Array(entries))
            }
            Mount::WebDav { .. } => Err("webdav list is not implemented yet".to_string()),
        }
    }

    fn stat(&self, path: &str) -> Result<Value, String> {
        let normalized = normalize_input_path(path)?;
        if let Some(mount) = self.mounts.get(&normalized) {
            return Ok(entry_json(&normalized, &normalized, mount.root_kind(), 0));
        }

        let resolved = self.resolve(&normalized)?;
        match resolved.mount {
            Mount::HttpManifest { files } => {
                if let Some(target) = files.get(&resolved.path) {
                    let size = std::fs::metadata(target).map(|meta| meta.len()).unwrap_or(0);
                    Ok(entry_json(file_name(&resolved.path), &normalized, "file", size))
                } else {
                    Err(format!("mounted path not found: {normalized}"))
                }
            }
            Mount::Native { root } | Mount::Internal { root } => {
                let target = safe_join(root, &resolved.path)?;
                let metadata = std::fs::metadata(&target).map_err(|error| format!("failed to stat {}: {error}", target.display()))?;
                Ok(entry_json(file_name(&resolved.path), &normalized, if metadata.is_dir() { "directory" } else { "file" }, metadata.len()))
            }
            Mount::WebDav { .. } => Err("webdav stat is not implemented yet".to_string()),
        }
    }

    fn exists(&self, path: &str) -> bool {
        self.stat(path).is_ok()
    }

    fn mounts_json(&self) -> Value {
        Value::Array(self.mounts.iter().map(|(name, mount)| serde_json::json!({
            "name": name,
            "driver": mount.driver(),
        })).collect())
    }

    fn list_mount_root(&self, mount_name: &str, mount: &Mount) -> Result<Value, String> {
        match mount {
            Mount::HttpManifest { files } => {
                let children: BTreeSet<_> = files.keys().filter_map(|path| path.split('/').next()).collect();
                Ok(Value::Array(children.into_iter().map(|name| entry_json(name, &format!("{mount_name}/{name}"), "unknown", 0)).collect()))
            }
            Mount::Native { root } | Mount::Internal { root } => list_local_dir(mount_name, "", root),
            Mount::WebDav { .. } => Err("webdav list is not implemented yet".to_string()),
        }
    }

    fn resolve(&self, path: &str) -> Result<ResolvedPath<'_>, String> {
        let normalized = normalize_input_path(path)?;
        let (mount_name, rest) = normalized.split_once('/').unwrap_or((&normalized, ""));
        let mount = self.mounts.get(mount_name).ok_or_else(|| format!("unknown fs mount '{mount_name}'"))?;
        let path = normalize_path(rest)?;
        Ok(ResolvedPath { mount_name: mount_name.to_string(), mount, path })
    }
}

impl Mount {
    fn driver(&self) -> &'static str {
        match self {
            Mount::HttpManifest { .. } => "http",
            Mount::Native { .. } => "native",
            Mount::Internal { .. } => "internal",
            Mount::WebDav { .. } => "webdav",
        }
    }

    fn root_kind(&self) -> &'static str {
        "directory"
    }
}

fn find_repo_root() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for candidate in [
        manifest_dir.join("../../../"),
        std::env::current_dir().map_err(|error| error.to_string())?.join("../../"),
    ] {
        let candidate = candidate.canonicalize().map_err(|error| error.to_string())?;
        if candidate.join("examples/demo/gams.json").exists() {
            return Ok(candidate);
        }
    }
    Err("failed to locate repo root containing demo/gams.json".to_string())
}

fn resolve_http_manifest_url(repo_root: &Path, url: &str) -> Result<PathBuf, String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        return Err(format!("remote http url is not implemented yet: {url}"));
    }
    Ok(safe_join(repo_root, url.trim_start_matches('/'))?)
}

fn safe_join(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let normalized = normalize_path(relative)?;
    let mut target = root.to_path_buf();
    if !normalized.is_empty() {
        for part in normalized.split('/') {
            target.push(part);
        }
    }
    Ok(target)
}

fn normalize_mount_name(name: &str) -> Result<String, String> {
    let name = normalize_path(name)?;
    if name.is_empty() || !name.split('/').all(|part| {
        let mut chars = part.chars();
        matches!(chars.next(), Some(c) if c.is_ascii_alphabetic())
            && chars.all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
    }) {
        return Err(format!("invalid mount name '{name}'"));
    }
    Ok(name)
}

fn normalize_input_path(path: &str) -> Result<String, String> {
    normalize_path(path)
}

fn normalize_path(path: &str) -> Result<String, String> {
    let raw = path.replace('\\', "/");
    let parts: Vec<&str> = raw.split('/').filter(|part| !part.is_empty() && *part != ".").collect();
    if parts.iter().any(|part| *part == "..") {
        return Err(format!("invalid fs path '{path}'"));
    }
    Ok(parts.join("/"))
}

fn input_as_path(input: &[u8]) -> Result<&str, String> {
    std::str::from_utf8(input).map_err(|error| error.to_string())
}

fn json_bytes<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    serde_json::to_vec(value).map_err(|error| error.to_string())
}

fn list_local_dir(mount_name: &str, relative: &str, dir: &Path) -> Result<Value, String> {
    let mut entries = Vec::new();
    for item in std::fs::read_dir(dir).map_err(|error| format!("failed to list {}: {error}", dir.display()))? {
        let item = item.map_err(|error| error.to_string())?;
        let metadata = item.metadata().map_err(|error| error.to_string())?;
        let name = item.file_name().to_string_lossy().to_string();
        let kind = if metadata.is_dir() { "directory" } else { "file" };
        let path = if relative.is_empty() {
            format!("{mount_name}/{name}")
        } else {
            format!("{mount_name}/{relative}/{name}")
        };
        entries.push(entry_json(&name, &path, kind, metadata.len()));
    }
    Ok(Value::Array(entries))
}

fn entry_json(name: &str, path: &str, kind: &str, size: u64) -> Value {
    serde_json::json!({
        "name": name,
        "path": path,
        "type": kind,
        "size": size,
    })
}

fn file_name(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}
