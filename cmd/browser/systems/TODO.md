# 🧩 SplitLayout Merge System — Developer Notes

## Overview

The `SplitLayout` system organizes a 2D panel layout using a **Binary Space Partition (BSP) tree**.

* Each **leaf node** (`type: "panel"`) represents a visible rectangular panel.
* Each **internal node** (`type: "split"`) represents a divider (handle) that splits space either **vertically** or **horizontally** between two child nodes.

Splitting panels works by replacing a leaf with a split node and two child panels.

**Merging**, by contrast, works in reverse — we want to remove a split and merge its two child panels back into one continuous panel.

---

## 🌳 BSP Structure Recap

Example layout:

```
Root (split vertical at x=600)
├── LeftPanel
└── (split horizontal at y=400)
    ├── TopRight
    └── BottomRight
```

Visually:

```
+------------------------+-------------+
|                        |    Top R    |
|        Left            |-------------|
|                        | Bottom R    |
+------------------------+-------------+
```

This produces a tree:

```ts
root = {
  type: "split",
  id: "handle_v",
  vertical: true,
  pos: 600,
  left: { type: "panel", id: "left", ... },
  right: {
    type: "split",
    id: "handle_h",
    vertical: false,
    pos: 400,
    left: { type: "panel", id: "topRight", ... },
    right: { type: "panel", id: "bottomRight", ... }
  }
};
```

---

## 🎯 Goal of Merging

A merge should **collapse a split** when the two panels on either side of it become one continuous rectangle.

### Example

If user drags the corner of `bottomRight` *outwards* into the `Left` panel area (horizontally), the layout should merge horizontally:

* Remove the vertical split (`handle_v`).
* Combine the two panel areas (`Left` + `Right subtree`).
* Recompute bounds.

---

## 🧠 Conceptual Steps for Merge

### Step 1: Locate the Target Panel

Use `findPanelAt(x, y)` to determine which panel the user initiated the merge from.

### Step 2: Locate the Neighbor Panel

Depending on the direction (`joinFromWest`, `joinFromEast`, etc.), find which panel lies **adjacent** in that direction.

* Traverse the BSP tree.
* Find the **lowest common ancestor** (LCA) split that separates these two panels.
* Verify that:

  * The split orientation matches the merge direction.
  * The two panels **fully align** on the perpendicular axis (e.g., same `y` range for horizontal merges).

If such a split exists, it’s safe to collapse it.

---

## 🔍 Finding Merge Candidates

Each merge direction corresponds to a split orientation:

| Merge Direction                   | Split Orientation | Description                    |
| --------------------------------- | ----------------- | ------------------------------ |
| `joinFromWest` / `joinFromEast`   | Vertical          | Merging across a vertical handle   |
| `joinFromNorth` / `joinFromSouth` | Horizontal        | Merging across a horizontal handle |

Algorithm sketch:

```ts
function findMergeableSplit(root, panelId, direction): BSPNode | null {
  // Recursively traverse
  // For each split:
  //   - if vertical and merging east/west:
  //       check if panelId is in left (merge east)
  //       or in right (merge west)
  //   - if horizontal and merging north/south:
  //       same idea for top/bottom
  // Return the first matching split where both children are panels
  // and their edges are aligned (y-range or x-range match)
}
```

---

## 🧩 Step 3: Verify Full Overlap

Before merging, ensure both panels **align fully** on the perpendicular axis.

Example for horizontal merge (`joinFromNorth`):

```ts
if (panelBelow.x === panelAbove.x && panelBelow.w === panelAbove.w) {
  // Perfect vertical alignment → merge possible
}
```

If alignment is partial, **do not merge** — that would cause overlapping geometry or uneven edges.

---

## 🧱 Step 4: Collapse the Split Node

Once a valid split is found:

1. Replace the split node in the tree with a new panel node.
2. The new panel’s bounds = union of the two merged panels.
3. Recompute bounds up the tree to keep everything consistent.

Example code:

```ts
function mergeSplitNode(split: SplitNode) {
  const a = split.left as PanelNode;
  const b = split.right as PanelNode;

  const merged: BSPNode = {
    type: "panel",
    id: a.id, // keep left’s ID
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: a.w + b.w + handleW, // add handle space
    h: Math.max(a.h, b.h),
  };

  // Replace the split in its parent
  return merged;
}
```

---

## 🔄 Step 5: Replace Split in Parent

To modify the tree in place, you need to track parent references or recurse with mutation:

```ts
function replaceSplit(node, splitId, mergedPanel): boolean {
  if (node.type === "split") {
    if (node.left.type === "split" && node.left.id === splitId) {
      node.left = mergedPanel;
      return true;
    }
    if (node.right.type === "split" && node.right.id === splitId) {
      node.right = mergedPanel;
      return true;
    }
    return replaceSplit(node.left, splitId, mergedPanel) ||
           replaceSplit(node.right, splitId, mergedPanel);
  }
  return false;
}
```

After replacement, call `recomputePanelBounds(root, 0, 0, width, height)` to realign everything.

---

## 🧭 Step 6: Handle Partial Merges (Edge Cases)

Sometimes the user merges into a neighboring panel that’s subdivided further.

Example:

```
|   Left   | TopRight |
|          |----------|
|          | BotRight |
```

If the user merges **bottom-right → left**, we should only merge the **bottom half** of left.

Solution:

* Find the **matching Y-range overlap** between the two panels.
* If partial, modify the corresponding split node within the neighbor subtree instead of removing the entire vertical split.
* This can be implemented recursively by checking intersection areas.

To keep v1 clean, you can initially **skip partial merges**, then extend later with geometric merging.

---

## ✅ Step 7: Cleanup

Once merged:

* Remove the handle associated with that split.
* Remove the merged panel’s subtree.
* Recompute layout bounds.

---

## 🔧 Example Merge Implementation Flow

### `joinFromEast({ panelId, x, y })`:

1. Find the panel at `(x, y)`.
2. Find its parent split that is:

   * Vertical
   * This panel is the left child
3. Check if right child is a leaf panel.
4. Verify y and height alignment.
5. Merge both panels → replace split with merged panel.
6. Recompute layout bounds.

---

## 🧩 Example Merge Result

Before:

```
[Panel A] | [Panel B]
```

Tree:

```
split(vertical)
├── A
└── B
```

After `joinFromEast(A)`:

```
[Panel A+B]
```

Tree:

```
panel (merged)
```

---

## 🧠 Future Extensions

You can later extend merges to:

* Handle **nested merges** (e.g., merging across multiple adjacent handles).
* Support **weighted splits** (ratios instead of absolute positions).
* Add **undo/redo** history for editor workflows.
* Serialize/deserialize tree for save/load.

---

## 💡 Implementation Tips

* The `joinFrom*` methods are symmetrical — implement one (`joinFromEast`), then generalize.
* Use a **helper function** `findSplitForMerge(panelId, direction)` that returns `(split, side)` to unify logic.
* Always recompute panel bounds after merge to ensure no floating errors accumulate.
* Test merges visually by dumping `getPanels()` and `getHandles()` after each operation.

---

## 🧩 Summary of Merge Algorithm

| Step | Action                                     | Result                |
| ---- | ------------------------------------------ | --------------------- |
| 1    | Find panel by ID                           | Identify source panel |
| 2    | Traverse BSP tree to find separating split | Target handle found   |
| 3    | Check alignment on perpendicular axis      | Validates merge       |
| 4    | Replace split with merged panel            | Tree simplified       |
| 5    | Recompute bounds                           | Layout consistent     |
| 6    | Remove handle                              | Clean final state     |


