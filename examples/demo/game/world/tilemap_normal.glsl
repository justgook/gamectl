@module tilemap_normal
@header package world
@header import sg "../sokol/gfx"
@ctype mat4 matrix[4,4]f32

@vs vs
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 normal_tex_size;
    vec2 lut_tex_size;
    vec2 camera_pos;
    vec2 viewport_size;
    float camera_zoom;
};

in vec2 pos;
in vec2 inst_pos;
in vec2 inst_tile_size;
in vec4 inst_tileset_uv;
in vec4 inst_lut_uv;
in vec2 inst_parallax;
in vec2 inst_repeat;

out vec2 frag_tile_size;
out vec4 frag_normal_uv;
out vec4 frag_lut_uv;
out vec2 frag_normal_size_px;
out vec2 frag_lut_size_px;
out vec2 frag_normal_tex_size;
out vec2 frag_lut_tex_size;
out vec2 frag_repeat;
out vec2 frag_map_pixel;

void main() {
    frag_lut_size_px = (inst_lut_uv.zw - inst_lut_uv.xy) * lut_tex_size;
    frag_normal_size_px = (inst_tileset_uv.zw - inst_tileset_uv.xy) * normal_tex_size;

    vec2 map_size = frag_lut_size_px * inst_tile_size;
    vec2 draw_pos = inst_pos + camera_pos * inst_parallax;
    bool has_repeat = inst_repeat.x > 0.5 || inst_repeat.y > 0.5;
    vec2 uv = pos + vec2(0.5);

    if (has_repeat) {
        gl_Position = vec4(pos * 2.0, 0.0, 1.0);
        vec2 world_pos = camera_pos + pos * viewport_size * camera_zoom;
        frag_map_pixel = (world_pos - draw_pos) / inst_tile_size;
    } else {
        vec2 world_pos = uv * map_size + draw_pos;
        gl_Position = ortho * vec4(world_pos, 0.0, 1.0);
        frag_map_pixel = uv * frag_lut_size_px;
    }

    frag_tile_size = inst_tile_size;
    frag_normal_uv = inst_tileset_uv;
    frag_lut_uv = inst_lut_uv;
    frag_normal_tex_size = normal_tex_size;
    frag_lut_tex_size = lut_tex_size;
    frag_repeat = inst_repeat;
}
@end

@fs fs
layout(binding=0) uniform texture2D normal_tex;
layout(binding=1) uniform texture2D lut_tex;
layout(binding=0) uniform sampler normal_smp;
layout(binding=1) uniform sampler lut_smp;

in vec2 frag_tile_size;
in vec4 frag_normal_uv;
in vec4 frag_lut_uv;
in vec2 frag_normal_size_px;
in vec2 frag_lut_size_px;
in vec2 frag_normal_tex_size;
in vec2 frag_lut_tex_size;
in vec2 frag_repeat;
in vec2 frag_map_pixel;

out vec4 frag_color;

float decode_tile_index(vec4 color) {
    vec4 bytes = floor(color * 255.0 + 0.5);
    return bytes.r + bytes.g * 256.0 + bytes.b * 65536.0;
}

void main() {
    vec2 map_pixel = frag_map_pixel;

    if (frag_repeat.x > 0.5) {
        map_pixel.x = mod(map_pixel.x, frag_lut_size_px.x);
    } else if (map_pixel.x < 0.0 || map_pixel.x >= frag_lut_size_px.x) {
        discard;
    }

    if (frag_repeat.y > 0.5) {
        map_pixel.y = mod(map_pixel.y, frag_lut_size_px.y);
    } else if (map_pixel.y < 0.0 || map_pixel.y >= frag_lut_size_px.y) {
        discard;
    }

    vec2 lut_uv = frag_lut_uv.xy + (floor(map_pixel) + 0.5) / frag_lut_tex_size;
    float index = decode_tile_index(texture(sampler2D(lut_tex, lut_smp), lut_uv));
    if (index <= 0.0) {
        discard;
    }

    vec2 tiles_per_row = floor(frag_normal_size_px / frag_tile_size);
    float tile_index = index - 1.0;
    vec2 tile_coord = vec2(
        mod(tile_index, tiles_per_row.x),
        tiles_per_row.y - 1.0 - floor(tile_index / tiles_per_row.x)
    );
    vec2 tile_offset = floor(fract(map_pixel) * frag_tile_size);
    vec2 normal_uv = frag_normal_uv.xy +
        (floor(tile_coord * frag_tile_size + tile_offset) + 0.5) / frag_normal_tex_size;
    frag_color = texture(sampler2D(normal_tex, normal_smp), normal_uv);
}
@end

@program tilemap_normal vs fs
