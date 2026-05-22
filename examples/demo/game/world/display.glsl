@module display
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32

@vs vs_display
@glsl_options flip_vert_y // fixes the different `origin_top_left` in webgl and native
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 pos_px;
    vec2 size_px;
};

in vec2 pos;

out vec2 uv;

void main() {
    vec2 p = pos * size_px + pos_px;
    gl_Position = ortho * vec4(p, 0.0, 1.0);

    uv = pos + vec2(0.5);
    uv.y = 1.0 - uv.y;
}
@end

@fs fs_display
layout(binding=0) uniform texture2D tex0;
layout(binding=0) uniform sampler smp;

in vec2 uv;
out vec4 frag_color;

void main() {
    frag_color = texture(sampler2D(tex0, smp), uv);
}
@end

@program display vs_display fs_display
