use crate::fs::VirtualFs;

pub struct Runtime {
    fs: VirtualFs,
}

impl Runtime {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            fs: VirtualFs::load_default()?,
        })
    }

    pub fn call(&self, plugin: &str, method: &str, input: Vec<u8>) -> Result<Vec<u8>, String> {
        match plugin {
            "runtime" => self.call_runtime(method, input),
            "fs" => self.fs.call(method, input),
            "fs-http" => self.fs.call_driver("http", method, input),
            "fs-internal" => self.fs.call_driver("internal", method, input),
            "fs-native" => self.fs.call_driver("native", method, input),
            "fs-webdav" => self.fs.call_driver("webdav", method, input),
            _ => Err(format!("unknown runtime plugin '{plugin}'")),
        }
    }

    fn call_runtime(&self, method: &str, input: Vec<u8>) -> Result<Vec<u8>, String> {
        match method {
            "ping" => Ok(b"pong".to_vec()),
            "plugins" => serde_json::to_vec(&serde_json::json!([
                "runtime",
                "fs",
                "fs-http",
                "fs-internal",
                "fs-native",
                "fs-webdav"
            ]))
            .map_err(|error| error.to_string()),
            "echo" => Ok(input),
            _ => Err(format!("runtime does not implement method '{method}'")),
        }
    }
}
