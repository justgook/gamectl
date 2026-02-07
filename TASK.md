# Next TODO

1. view-settings
  - tab with keybindings
  - appearance
    - choose theme
    - choose font
    - change theme colors
    - change theme spacing
  - plugins 
    - choose (enable/disable) build in (`local:`) plugins
    - choose remote plugins - by passing url to plugin 
    - enable/disable views allow to load local / remote views to dynamically add new functionality

2. refactor theme
  - drop tokens
  - migrate to css variables
  - split to theme.css theme1.css theme2.css etc. (colors / spacings variables and specific css based on custom element tags and subtags/data-attrs) and base.css (basic stuff that must be - position, display )
3. add new plugin/view for particle system
  - R&D: [godot](https://docs.godotengine.org/en/stable/tutorials/2d/particle_systems_2d.html)
  - add renderer of CPU / GPU (maybe build it as game example in wasm that renders to webgl - odin game stripped down to single component of rendering particles.)

4. add audio system [godot]( https://docs.godotengine.org/en/stable/tutorials/audio/audio_buses.html )
