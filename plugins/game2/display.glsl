@module display
@header package main
@header import sg "./sokol/gfx"

@vs vs
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 tileset_tex_size;
    vec2 lut_tex_size;
};

in vec2 pos;
in vec2 inst_pos;
in vec2 inst_tile_size;
in vec4 inst_tileset_uv;
in vec4 inst_lut_uv;

out vec2 frag_uv;
out vec2 frag_tile_size;
out vec4 frag_tileset_uv;
out vec4 frag_lut_uv;
out vec2 frag_tileset_size_px;
out vec2 frag_lut_size_px;
out vec2 frag_tileset_tex_size;
out vec2 frag_lut_tex_size;

void main() {
    frag_lut_size_px = (inst_lut_uv.zw - inst_lut_uv.xy) * lut_tex_size;
    frag_tileset_size_px = (inst_tileset_uv.zw - inst_tileset_uv.xy) * tileset_tex_size;

    vec2 world_pos = (pos + vec2(0.5)) * frag_lut_size_px * inst_tile_size + inst_pos;
    gl_Position = ortho * vec4(world_pos, 0.0, 1.0);

    frag_uv = pos + vec2(0.5);
    frag_tile_size = inst_tile_size;
    frag_tileset_uv = inst_tileset_uv;
    frag_lut_uv = inst_lut_uv;
    frag_tileset_tex_size = tileset_tex_size;
    frag_lut_tex_size = lut_tex_size;
}
@end

@fs fs
layout(binding=0) uniform texture2D display_tex;
layout(binding=0) uniform sampler display_smp;

in vec2 frag_uv;
in vec2 frag_tile_size;
in vec4 frag_tileset_uv;
in vec4 frag_lut_uv;
in vec2 frag_tileset_size_px;
in vec2 frag_lut_size_px;
in vec2 frag_tileset_tex_size;
in vec2 frag_lut_tex_size;

out vec4 frag_color;

void main() {
    frag_color = vec4(1,0,0,1);
}
@end

@program display vs fs
