# BulletML Reference ver. 0.21

Source: <https://www.asahi-net.or.jp/~cs8k-cyu/bulletml/bulletml_ref_e.html>  
Author/copyright: Kenta Cho (ABA."Saba")  
Captured for `tools/gbml-import` importer implementation notes.

This file is a local Markdown copy of the BulletML 0.21 reference page for implementation convenience. Treat the upstream page as the original source.

## `<bulletml>` - Defines the BulletML body

- **Attribute**: `type = (none | vertical | horizontal)`
- **Contents**: `(bullet | action | fire)*`

Defines the BulletML body.

A `type` attribute specifies that this barrage is for vertical-scroll shooting or horizontal-scroll shooting.

## `<bullet>` - Defines attributes of a bullet

- **Attribute**: `label = STRING`
- **Contents**: `direction?, speed?, (action | actionRef)*`

Example:

```xml
<bullet label="downAccel">
  <direction>270</direction>
  <speed>2</speed>
  <action>
    <accel>
      <vertical>3</vertical>
      <term>120</term>
    </accel>
  </action>
</bullet>
```

Defines the direction, speed, and action of a bullet.

A `label` attribute labels the bullet. The labeled bullet element is referred to by `bulletRef` elements.

## `<action>` - Defines the action of a bullet

- **Attribute**: `label = STRING`
- **Contents**: `(repeat | fire | fireRef | changeSpeed | changeDirection | accel | wait | vanish | action | actionRef)*`

Example:

```xml
<action>
  <changeSpeed>
    <speed>0</speed>
    <term>60</term>
  </changeSpeed>
  <wait>60</wait>
  <fire><bullet/></fire>
  <fire>
    <direction type="absolute">330+$rand*25</direction>
    <bulletRef label="downAccel"/>
  </fire>
  <vanish/>
</action>
```

Defines the action of a bullet. The labeled action element is referred to by `actionRef` elements.

## `<fire>` - Fires a bullet

- **Attribute**: `label = STRING`
- **Contents**: `direction?, speed?, (bullet | bulletRef)`

Example:

```xml
<fire>
  <direction type="absolute">270</direction>
  <speed>2</speed>
  <bulletRef label="rocket"/>
</fire>
```

Fires a bullet to `<direction>` degrees at `<speed>`. The labeled fire element is referred to by `fireRef` elements.

## `<changeDirection>` - Changes the direction of a bullet

- **Contents**: `direction, term`

Changes the direction of a bullet to `<direction>` degrees in `<term>` frames. One frame is 1/60 seconds.

## `<changeSpeed>` - Changes the speed of a bullet

- **Contents**: `speed, term`

Changes the speed of a bullet to `<speed>` in `<term>` frames.

## `<accel>` - Accelerates a bullet

- **Contents**: `horizontal?, vertical?, term`

Accelerates a bullet `<horizontal>` in a horizontal line and `<vertical>` in a vertical line in `<term>` frames.

## `<wait>` - Waits

- **Contents**: `NUMBER`

Waits for `NUMBER` frames.

## `<vanish>` - Vanishes a bullet

Vanishes a bullet.

## `<repeat>` - Repeats an action

- **Contents**: `times, (action | actionRef)`

Example:

```xml
<repeat>
  <times>100</times>
  <action>
    <fire>
      <direction type="absolute">220+$rand*100</direction>
      <bulletRef label="backBurst"/>
    </fire>
    <wait>6</wait>
  </action>
</repeat>
```

Repeats the action `<times>` times.

## `<direction>` - Specifies a direction

- **Attribute**: `type = (aim | absolute | relative | sequence)`
- **Contents**: `NUMBER`

Specifies the direction in degrees.

- `aim`: `NUMBER` is relative to the direction to my ship. The direction to my ship is 0, clockwise.
- `absolute`: `NUMBER` is the absolute value. 12 o'clock is 0, clockwise.
- `relative`: `NUMBER` is relative to the direction of this bullet. 0 means that the direction of this fire and the direction of the bullet are the same.
- `sequence`: `NUMBER` is relative to the direction of the previous fire. 0 means that the direction of this fire and the direction of the previous fire are the same.

## `<speed>` - Specifies a speed

- **Attribute**: `type = (absolute | relative | sequence)`
- **Contents**: `NUMBER`

Specifies the speed.

- `relative`: if included in `changeSpeed`, speed is relative to the current speed of this bullet. Otherwise, speed is relative to the speed of this bullet.
- `sequence`: if included in `changeSpeed`, speed is changing successively. Otherwise, speed is relative to the speed of the previous fire.

## `<horizontal>` - Specifies acceleration in a horizontal line

- **Attribute**: `type = (absolute | relative | sequence)`
- **Contents**: `NUMBER`

Specifies acceleration in a horizontal line.

- `relative`: acceleration is relative to the acceleration of this bullet.
- `sequence`: acceleration is changing successively.

## `<vertical>` - Specifies acceleration in a vertical line

- **Attribute**: `type = (absolute | relative | sequence)`
- **Contents**: `NUMBER`

Specifies acceleration in a vertical line.

- `relative`: acceleration is relative to the acceleration of this bullet.
- `sequence`: acceleration is changing successively.

## `<term>` - Specifies a term

- **Contents**: `NUMBER`

Specifies a term.

## `<times>` - Specifies the number of times

- **Contents**: `NUMBER`

Specifies the number of times.

## `<bulletRef>` - Refers to a bullet

- **Attribute**: `label = STRING`
- **Contents**: `param*`

Refers to the labeled bullet. This element is handled as the bullet element that has the same label.

Variables (`$1`, `$2`, `$3`, ...) in the referred element are replaced with parameters in `<param>`. The first parameter replaces `$1`, the second parameter replaces `$2`, etc.

## `<actionRef>` - Refers to an action

- **Attribute**: `label = STRING`
- **Contents**: `param*`

Refers to the labeled action. This element is handled as the action element that has the same label.

Variables in the referred element are replaced with parameters in `<param>`.

## `<fireRef>` - Refers to a fire action

- **Attribute**: `label = STRING`
- **Contents**: `param*`

Refers to the labeled fire action. This element is handled as the fire action element that has the same label.

Variables in the referred element are replaced with parameters in `<param>`.

## `<param>` - Specifies a parameter

- **Contents**: `NUMBER`

Specifies the parameter.

## `STRING` - any string

String for labels.

## `NUMBER` - expression

Examples:

```text
35
360/16
0.7 + 0.9*$rand
180-$rank*20
(2+$1)*0.3
```

Expression for specifying a number.

Available syntax:

- addition;
- subtraction;
- multiplication;
- division;
- modulo;
- brackets/parentheses;
- variables `$1`, `$2`, `$3`, ... for parameters;
- `$rand` for random value from 0 to 1;
- `$rank` for game difficulty rank from 0 to 1.
