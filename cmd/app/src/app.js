import { runtime } from "/core/runtime.js"

console.log((new TextDecoder).decode(await runtime.call("fs", "list", ".")))
console.log("aa", localStorage)

