# Treat runtime.invoke as a compatibility API while typed calls are investigated

`runtime.invoke(target, args)` is useful as the current frontend-to-plugin call path, but GAMS is still investigating typed/wRPC-shaped calls over Tauri IPC and view-owned typed encoders. We will keep `runtime.invoke` working as a compatibility API for current app/runtime work without freezing it as the long-term frontend-to-plugin contract.
