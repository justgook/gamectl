
// ---------- IndexedDB Helpers ----------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("handles-db", 1)

    req.onupgradeneeded = () => {
      req.result.createObjectStore("handles")
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveHandle(handle) {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite")
    const store = tx.objectStore("handles")

    const req = store.put(handle, "dir")
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function loadHandle() {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readonly")
    const store = tx.objectStore("handles")

    const req = store.get("dir")
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}


// ---------- Permission helper ----------
async function verifyPermission(handle, mode = "readwrite") {
  const opts = { mode }

  // Check if already allowed
  if ((await handle.queryPermission(opts)) === "granted") return true

  // Request permission if not
  if ((await handle.requestPermission(opts)) === "granted") return true

  return false
}

async function handleExists(dirHandle) {
  try {
    // Try listing at least 1 item
    for await (const _ of dirHandle.values()) {
      break
    }
    return true
  } catch (err) {
    // Directory was deleted OR permissions invalid
    return false
  }
}


// ---------- Main Logic ----------
export async function getDirectoryHandle() {
  let handle = await loadHandle()

  if (handle && handle.queryPermission) {
    const ok = await verifyPermission(handle)
    if (ok) {
      const exists = await handleExists(handle)
      if (exists) {
        return handle
      }
      console.warn("Stored directory no longer exists")
    }
  }

  // Otherwise ask user once
  handle = await new Promise((resolve) => {
    document.addEventListener("click", async function(evnt) {
      console.log(evnt.target.id)
      const dir = await window.showDirectoryPicker({ id: 'demo', mode: 'readwrite' })
      resolve(dir)
    }, { once: true })
  })

  // Persist for next time
  await saveHandle(handle)

  return handle
}
