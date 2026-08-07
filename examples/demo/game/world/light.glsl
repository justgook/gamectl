@module light
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32


@vs vs_light_base
layout(binding=0) uniform vs_params {
    mat4 ortho;
};


in vec2 pos;
in vec2 inst_pos;
in vec2 inst_size;
in vec4 inst_color;

out vec4 color;


void main() {
    float inst_z = 0.0;
    vec2 pos_in_px = pos * inst_size + inst_pos;
    gl_Position = ortho * vec4(pos_in_px, inst_z, 1.0);
    color = inst_color;
}
@end

@fs fs_light_base
in vec4 color;

out vec4 frag_color;
void main() {
    frag_color = vec4(1.0, 0, 0, 1.0);
    frag_color = color;
}
@end

@program light vs_light_base fs_light_base

