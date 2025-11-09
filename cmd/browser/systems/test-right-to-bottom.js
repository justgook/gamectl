import { SplitLayout } from './split-layout.js'

console.log("=== Test: Right merges into Bottom ===")
const layout = new SplitLayout(200, 150, 4, 4)
const rootId = layout.root.id

// Create the layout:
// ┌──────┬────────┐
// │ top  │        │ 
// ├──────┤ right  │
// │ bot  │        │
// └──────┴────────┘

const split1 = layout.split(rootId, true, 96)  // rootId left, split1.newPanelId right
const split2 = layout.split(rootId, false, 70)  // split2.newPanelId top-left, rootId bottom-left

console.log("Layout structure:")
console.log("  top-left:", split2.newPanelId)
console.log("  bottom-left:", rootId)
console.log("  right:", split1.newPanelId)

console.log("\nBefore merge:")
layout.getPanels().forEach(p => {
  console.log(`  ${p.id}: (${p.x},${p.y}) ${p.w}x${p.h}`)
})

console.log("\nBST before:")
console.log(JSON.stringify(layout.root, null, 2))

// Merge right into bottom
console.log(`\nMerging ${split1.newPanelId} (right) into ${rootId} (bottom-left)`)
const success = layout.join(split1.newPanelId, rootId)
console.log("Success:", success)

console.log("\nAfter merge:")
layout.getPanels().forEach(p => {
  console.log(`  ${p.id}: (${p.x},${p.y}) ${p.w}x${p.h}`)
})

console.log("\nBST after:")
console.log(JSON.stringify(layout.root, null, 2))

console.log("\nExpected:")
console.log("  Two panels: top and bottom (full width)")
console.log("  top should be at y=0 with smaller height")
console.log("  bottom should be below top with its original height")

const panels = layout.getPanels()
if (panels.length === 2) {
  const top = panels.find(p => p.y === 0)
  const bot = panels.find(p => p.y > 0)
  console.log("\nValidation:")
  console.log(`  2 panels: ✓`)
  console.log(`  top width 200: ${top.w === 200 ? '✓' : '✗ (got ' + top.w + ')'}`)
  console.log(`  bot width 200: ${bot.w === 200 ? '✓' : '✗ (got ' + bot.w + ')'}`)
  console.log(`  top.id is ${split2.newPanelId}: ${top.id === split2.newPanelId ? '✓' : '✗ (got ' + top.id + ')'}`)
  console.log(`  bot.id is ${rootId}: ${bot.id === rootId ? '✓' : '✗ (got ' + bot.id + ')'}`)
} else {
  console.log(`\n✗ Wrong number of panels: ${panels.length} (expected 2)`)
}
