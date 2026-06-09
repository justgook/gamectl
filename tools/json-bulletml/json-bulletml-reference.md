# JSON BulletML Reference

This document describes a normalized JSON representation of BulletML.

The format preserves the behavior of BulletML while simplifying its structure for JSON and YAML authoring:

- labeled definitions are stored in top-level arrays;
- labels are replaced by zero-based array indices;
- inline bullets, actions, and fires are moved into their corresponding top-level arrays;
- references may be plain indices or parameterized reference objects;
- numeric values may be numbers or expression strings.

---

## Root object — Defines the BulletML body

### Shape

```json
{
  "type": "vertical",
  "bullets": [],
  "actions": [],
  "fires": []
}
```

### Properties

- `type`: one of `"none"`, `"vertical"`, or `"horizontal"`
- `bullets`: array of bullet definitions
- `actions`: array of action definitions
- `fires`: array of fire definitions

The `type` property specifies whether the barrage is intended for a vertical-scrolling or horizontal-scrolling shooter. Use `"none"` when no orientation is specified.

Definitions are referenced by their zero-based position in the corresponding array.

---

## Bullet object — Defines attributes of a bullet

### Shape

```json
{
  "direction": {
    "type": "aim",
    "value": 230
  },
  "speed": {
    "type": "absolute",
    "value": 2
  },
  "actionRefs": [0, 8, 23]
}
```

### Contents

```text
direction?, speed?, actionRefs?
```

- `direction`: optional direction object
- `speed`: optional speed object
- `actionRefs`: optional array of action references

A bullet may contain at most one `direction` and at most one `speed`.

A bullet may run any number of actions. Actions are referenced by index through `actionRefs`.

### Parameterized action reference example

```json
{
  "actionRefs": [
    {
      "ref": 8,
      "params": [12, "0.5 + $rank"]
    }
  ]
}
```

---

## Action array — Defines an action of a bullet

An action is an ordered array of command objects.

### Shape

```json
[
  {
    "changeSpeed": {
      "speed": {
        "type": "absolute",
        "value": 0
      },
      "term": 60
    }
  },
  {
    "wait": 60
  },
  {
    "fireRef": 2
  },
  {
    "vanish": true
  }
]
```

### Allowed commands

```text
repeat
fireRef
changeSpeed
changeDirection
accel
wait
vanish
actionRef
```

Each command object contains exactly one command property.

Actions and fires are not nested inline. They are moved into the top-level `actions` and `fires` arrays and referenced by index.

---

## Fire object — Fires a bullet

### Shape

```json
{
  "direction": {
    "type": "absolute",
    "value": 270
  },
  "speed": {
    "type": "absolute",
    "value": 2
  },
  "bulletRef": 4
}
```

### Contents

```text
direction?, speed?, bulletRef
```

- `direction`: optional direction object
- `speed`: optional speed object
- `bulletRef`: required bullet reference

A fire object fires the referenced bullet in the specified direction and at the specified speed.

### Parameterized bullet reference example

```json
{
  "direction": {
    "type": "absolute",
    "value": "180 + $1"
  },
  "bulletRef": {
    "ref": 4,
    "params": [30]
  }
}
```

---

## `changeDirection` command — Changes the direction of a bullet

### Shape

```json
{
  "changeDirection": {
    "direction": {
      "type": "absolute",
      "value": 270
    },
    "term": 30
  }
}
```

### Contents

```text
direction, term
```

Changes the direction of the bullet to `direction` degrees over `term` frames.

One frame is normally `1 / 60` of a second.

---

## `changeSpeed` command — Changes the speed of a bullet

### Shape

```json
{
  "changeSpeed": {
    "speed": {
      "type": "relative",
      "value": 2
    },
    "term": 60
  }
}
```

### Contents

```text
speed, term
```

Changes the speed of the bullet to `speed` over `term` frames.

---

## `accel` command — Accelerates a bullet

### Shape

```json
{
  "accel": {
    "horizontal": {
      "type": "absolute",
      "value": 1
    },
    "vertical": {
      "type": "absolute",
      "value": 3
    },
    "term": 120
  }
}
```

### Contents

```text
horizontal?, vertical?, term
```

- `horizontal`: optional horizontal acceleration
- `vertical`: optional vertical acceleration
- `term`: required duration in frames

Accelerates a bullet horizontally and vertically over `term` frames.

Either `horizontal` or `vertical` may be omitted.

### Vertical-only example

```json
{
  "accel": {
    "vertical": {
      "type": "absolute",
      "value": 3
    },
    "term": 120
  }
}
```

---

## `wait` command — Waits

### Shape

```json
{
  "wait": 60
}
```

### Contents

```text
number | expression
```

Waits for the specified number of frames.

### Expression example

```json
{
  "wait": "30 + $rank * 20"
}
```

---

## `vanish` command — Vanishes a bullet

### Shape

```json
{
  "vanish": true
}
```

Vanishes the current bullet.

The value is always `true`.

---

## `repeat` command — Repeats an action

### Shape

```json
{
  "repeat": {
    "times": 100,
    "actionRef": 4
  }
}
```

### Contents

```text
times, actionRef
```

Repeats the referenced action `times` times.

### Parameterized reference example

```json
{
  "repeat": {
    "times": "10 + $rank * 20",
    "actionRef": {
      "ref": 4,
      "params": [6]
    }
  }
}
```

---

## `actionRef` command — Refers to an action

### Simple reference

```json
{
  "actionRef": 8
}
```

### Parameterized reference

```json
{
  "actionRef": {
    "ref": 8,
    "params": [12, "0.5 + $rank"]
  }
}
```

Refers to an action by its zero-based index in the top-level `actions` array.

Variables such as `$1`, `$2`, and `$3` in the referenced action are replaced with values from `params`.

---

## `fireRef` command — Refers to a fire object

### Simple reference

```json
{
  "fireRef": 3
}
```

### Parameterized reference

```json
{
  "fireRef": {
    "ref": 3,
    "params": [12, "0.5 + $rank"]
  }
}
```

Refers to a fire object by its zero-based index in the top-level `fires` array.

Variables in the referenced fire object are replaced with values from `params`.

---

## Bullet reference — Refers to a bullet object

A bullet reference is used by a fire object.

### Simple reference

```json
{
  "bulletRef": 4
}
```

### Parameterized reference

```json
{
  "bulletRef": {
    "ref": 4,
    "params": [12, "0.5 + $rank"]
  }
}
```

Refers to a bullet by its zero-based index in the top-level `bullets` array.

Variables in the referenced bullet are replaced with values from `params`.

---

## Direction object — Specifies a direction

### Shape

```json
{
  "type": "aim",
  "value": 0
}
```

### Properties

- `type`: one of `"aim"`, `"absolute"`, `"relative"`, or `"sequence"`
- `value`: number or expression, measured in degrees

### Direction types

- `"aim"`: the value is relative to the direction toward the player. The direction toward the player is `0`.
- `"absolute"`: the value is an absolute direction. Twelve o'clock is `0`, increasing clockwise.
- `"relative"`: the value is relative to the direction of the current bullet.
- `"sequence"`: the value is relative to the direction of the previous fire.

---

## Speed object — Specifies a speed

### Shape

```json
{
  "type": "absolute",
  "value": 2
}
```

### Properties

- `type`: one of `"absolute"`, `"relative"`, or `"sequence"`
- `value`: number or expression

### Speed types

- `"absolute"`: the value is an absolute speed.
- `"relative"`: the value is relative to the current bullet speed.
- `"sequence"`: the value changes successively or is relative to the speed of the previous fire, depending on context.

---

## Horizontal acceleration object — Specifies horizontal acceleration

### Shape

```json
{
  "type": "absolute",
  "value": 1
}
```

### Properties

- `type`: one of `"absolute"`, `"relative"`, or `"sequence"`
- `value`: number or expression

### Types

- `"absolute"`: the value is an absolute horizontal acceleration.
- `"relative"`: the value is relative to the current horizontal acceleration.
- `"sequence"`: the horizontal acceleration changes successively.

---

## Vertical acceleration object — Specifies vertical acceleration

### Shape

```json
{
  "type": "absolute",
  "value": 3
}
```

### Properties

- `type`: one of `"absolute"`, `"relative"`, or `"sequence"`
- `value`: number or expression

### Types

- `"absolute"`: the value is an absolute vertical acceleration.
- `"relative"`: the value is relative to the current vertical acceleration.
- `"sequence"`: the vertical acceleration changes successively.

---

## `term` value — Specifies a duration

A `term` value is a number or expression representing a duration in frames.

### Examples

```json
{
  "term": 60
}
```

```json
{
  "term": "30 + $rank * 20"
}
```

---

## `times` value — Specifies a repeat count

A `times` value is a number or expression representing the number of repetitions.

### Examples

```json
{
  "times": 100
}
```

```json
{
  "times": "10 + $rank * 20"
}
```

---

## Reference object — Refers to a reusable definition

A reference may be written as a plain zero-based array index:

```json
3
```

When parameters are required, use an object:

```json
{
  "ref": 3,
  "params": [12, "0.5 + $rank"]
}
```

### Properties

- `ref`: zero-based index of the referenced object
- `params`: array of number or expression values

The array being indexed depends on the reference location:

| Reference | Target array |
| --- | --- |
| `bulletRef` | `bullets` |
| `actionRef` | `actions` |
| `fireRef` | `fires` |

---

## Numeric value — Number or expression

Numeric fields accept either JSON numbers:

```json
35
```

or expression strings:

```json
"360 / 16"
```

```json
"0.7 + 0.9 * $rand"
```

```json
"180 - $rank * 20"
```

```json
"(2 + $1) * 0.3"
```

Expressions may use:

- addition: `+`
- subtraction: `-`
- multiplication: `*`
- division: `/`
- modulo: `%`
- parentheses: `(` and `)`
- positional parameters: `$1`, `$2`, `$3`, ...
- random value from `0` to `1`: `$rand`
- game difficulty rank from `0` to `1`: `$rank`

---

## Complete example

```json
{
  "type": "vertical",
  "bullets": [
    {
      "direction": {
        "type": "absolute",
        "value": 270
      },
      "speed": {
        "type": "absolute",
        "value": 2
      },
      "actionRefs": [1]
    }
  ],
  "actions": [
    [
      {
        "changeSpeed": {
          "speed": {
            "type": "absolute",
            "value": 0
          },
          "term": 60
        }
      },
      {
        "wait": 60
      },
      {
        "fireRef": 0
      },
      {
        "vanish": true
      }
    ],
    [
      {
        "accel": {
          "vertical": {
            "type": "absolute",
            "value": 3
          },
          "term": 120
        }
      }
    ]
  ],
  "fires": [
    {
      "direction": {
        "type": "absolute",
        "value": "330 + $rand * 25"
      },
      "bulletRef": 0
    }
  ]
}
```
