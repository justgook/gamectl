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
out vec4 normal_transform;

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

    mat2 flip_matrix = FLIP_MATRICES[inst_flip_flags];
    vec2 transformed_uv = flip_matrix * pos;
    frag_uv = inst_uv.xy + (transformed_uv + vec2(0.5)) * (inst_uv.zw - inst_uv.xy);
    normal_transform = vec4(flip_matrix[0], flip_matrix[1]);
}
@end

@fs fs_sprite_normal
layout(binding=0) uniform texture2D normal_tex;
layout(binding=1) uniform texture2D color_tex;
layout(binding=0) uniform sampler atlas_smp;

in vec2 frag_uv;
in float opacity;
in vec4 normal_transform;

out vec4 frag_color;

void main() {
    float coverage = texture(sampler2D(color_tex, atlas_smp), frag_uv).a * opacity;
    if (coverage < 0.001) {
        discard;
    }

    // Coverage comes from the color atlas so normal alpha remains available
    // for authored material/specular strength.
    vec4 normal_material = texture(sampler2D(normal_tex, atlas_smp), frag_uv);
    vec2 tangent_normal = normal_material.xy * 2.0 - 1.0;

    // UVs map screen coordinates back into the source sprite with M, so the
    // sampled tangent-space vector must use the inverse transform M^-1 = M^T.
    mat2 flip_matrix = mat2(normal_transform.xy, normal_transform.zw);
    tangent_normal = transpose(flip_matrix) * tangent_normal;

    frag_color = vec4(tangent_normal * 0.5 + 0.5, normal_material.zw);
}
@end

@program sprite_normal vs_sprite_normal fs_sprite_normal
