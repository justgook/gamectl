@module debug_collision
@header package world
@header import sg "../sokol/gfx"

@ctype vec2 [2]f32
@ctype vec4 [4]f32
@ctype mat4 matrix[4,4]f32

@vs vs_debug_collision
layout(binding=0) uniform vs_params {
    mat4 ortho;
};

in vec2 pos;
in vec4 color0;

out vec4 color;

void main() {
    gl_Position = ortho * vec4(pos, 0.0, 1.0);
    color = color0;
}
@end

@fs fs_debug_collision
in vec4 color;
out vec4 frag_color;

void main() {
    frag_color = color;
}
@end

@program debug_collision vs_debug_collision fs_debug_collision
