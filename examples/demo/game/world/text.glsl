@module text
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32

@vs vs
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 atlas_size;
};

in vec2 position;
in vec2 inst_pos;
in vec4 inst_uv;
in vec4 inst_color;

out vec2 uv;
out vec4 color;

void main() {
    vec2 glyph_size = abs(inst_uv.zw - inst_uv.xy) * atlas_size;
    vec2 pos_in_px = inst_pos + position * glyph_size;
    gl_Position = ortho * vec4(pos_in_px, 0.0, 1.0);
    uv = inst_uv.xy + position * (inst_uv.zw - inst_uv.xy);
    color = inst_color;
}
@end

@fs fs
layout(binding=0) uniform texture2D tex0;
layout(binding=0) uniform sampler smp;

in vec2 uv;
in vec4 color;

out vec4 frag_color;

void main() {
    vec4 tex_color = texture(sampler2D(tex0, smp), uv) * color;
    if (tex_color.a < 0.001) {
        discard;
    }
    frag_color = tex_color;
}
@end

@program text vs fs
