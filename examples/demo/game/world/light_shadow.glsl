@module light_shadow
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32


@vs vs_light_base
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 viewport_size;
};


in vec2 pos;
in vec4 inst_pos;

void main() {
    mat4 aa = ortho;
    float inst_z = 0.0;
    // vec2 pos_in_px = pos * inst_size + inst_pos;
    vec2 pos_in_px = pos + inst_pos.xy;
    gl_Position = ortho * vec4(pos_in_px, inst_z, 1.0);
    gl_Position = vec4(pos, 0, 1.0);
}
@end

@fs fs_light_base


out vec4 frag_color;

void main() {
    frag_color = vec4(1,0,1,1);
}

@end

@program light_shadow vs_light_base fs_light_base

