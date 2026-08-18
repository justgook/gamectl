@module sprite_normal
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32

@vs vs_sprite_normal
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 atlas_size;
};

in vec2 pos;
in vec2 inst_pos;
in float inst_z;
in float inst_opacity;
in uint inst_flip_flags;
in vec4 inst_uv;
in vec4 inst_color_add;
in ivec2 inst_offset;

out vec2 frag_uv;
out float opacity;

const mat2 FLIP_MATRICES[8] = mat2[](
    mat2(1, 0, 0, 1),
    mat2(-1, 0, 0, 1),
    mat2(1, 0, 0, -1),
    mat2(-1, 0, 0, -1),
    mat2(0, 1, 1, 0),
    mat2(0, -1, 1, 0),
    mat2(0, 1, -1, 0),
    mat2(0, -1, -1, 0)
);

void main() {
    vec2 sprite_size = abs(inst_uv.zw - inst_uv.xy) * atlas_size;
    vec2 pos_in_px = pos * sprite_size + inst_pos + vec2(inst_offset);
    gl_Position = ortho * vec4(pos_in_px, inst_z, 1.0);
    opacity = inst_opacity;

    vec2 transformed_uv = FLIP_MATRICES[inst_flip_flags] * pos;
    frag_uv = inst_uv.xy + (transformed_uv + vec2(0.5)) * (inst_uv.zw - inst_uv.xy);
}
@end

@fs fs_sprite_normal
layout(binding=0) uniform texture2D color_tex;
layout(binding=0) uniform sampler color_smp;

in vec2 frag_uv;
in float opacity;

out vec4 frag_color;

void main() {
    float coverage = texture(sampler2D(color_tex, color_smp), frag_uv).a * opacity;
    if (coverage < 0.001) {
        discard;
    }

    // RGB is a neutral tangent-space normal. Alpha remains available for
    // material/specular strength rather than representing coverage.
    frag_color = vec4(0.5, 0.5, 1.0, 0.0);
}
@end

@program sprite_normal vs_sprite_normal fs_sprite_normal
