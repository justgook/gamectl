@header package sprite
@header import sg "../../sokol/gfx"
@ctype mat4 matrix[4,4]f32

@vs vs_sprite
layout(binding=0) uniform vs_params {
    mat4 ortho;
};

in vec2 pos;
in vec2 inst_pos;
in vec2 inst_size;
in vec4 inst_uv;

out vec2 frag_uv;

void main() {
    vec2 pos_in_px = pos * inst_size + inst_pos;
    gl_Position = ortho * vec4(pos_in_px, 0.0, 1.0);
    frag_uv = inst_uv.xy + (pos + vec2(0.5)) * (inst_uv.zw - inst_uv.xy);
}
@end

@fs fs_sprite
layout(binding=0) uniform texture2D tex0;
layout(binding=0) uniform sampler smp;

in vec2 frag_uv;

out vec4 frag_color;

void main() {
    vec4 tex_color = texture(sampler2D(tex0, smp), frag_uv);
    if (tex_color.a < 0.001) {
        discard;
    }
    frag_color = tex_color;
}
@end

@program sprite vs_sprite fs_sprite
