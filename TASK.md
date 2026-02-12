# Next TODO

1. view-settings
  - tab with keybindings
  - appearance
    - choose theme
    - choose font
    - change theme colors
    - change theme spacing
  - plugins 
    - choose (enable/disable) build in (using `local:` prefix) plugins
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

5. add different WebDAV support for FS, and store url to it in localStorage, use `rclone serve webdav` for local dev

6. add [sqlite-vector](https://github.com/sqliteai/sqlite-vector) to the sql lite 

7. add LPC view/plugin to the application
  - use sqlite-vector instead of tags to define each item / equipment / character / tile (how much it is related to each "category")
  - use image-processing to recolor it in same way as lpctools do it

8. improve image processing based on [magick](https://imagemagick.org/script/command-line-tools.php#gsc.tab=0) sub commands

9. maybe add add plugin of [neural network](https://github.com/codeplea/genann) / https://github.com/attractivechaos/kann
10. investigate what good in https://github.com/MichaelMackus/libroguelike 
11. sbt_* plugins - [stb_herringbone_wang_tile.h](https://github.com/nothings/stb/blob/master/stb_herringbone_wang_tile.h) Stb_perlin / Stb_rect_pack / Stb_image / Stb_image_resize / stb_truetype.h / stb_voxel_render.h???
12. [WFC](https://github.com/krychu/wfc)
13. [constrain solewer](https://github.com/starwing/amoeba?tab=readme-ov-file) - to generate rooms / items in rooms
14. add support for bulletML parser, editor and renderer
15. add [BMFont](https://angelcode.com/products/bmfont/) xml/txt/binary formats to preview and edit
