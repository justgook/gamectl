@module tile_edge
@header package world
@header import sg "../sokol/gfx"

@vs vs_tile_edge
@glsl_options flip_vert_y
in vec2 pos;
out vec2 uv;

void main() {
    gl_Position = vec4(pos * 2.0, 0.0, 1.0);
    uv = pos + vec2(0.5);
    uv.y = 1.0 - uv.y;
}
@end

@fs fs_tile_edge
layout(binding=0) uniform texture2D normal_tex;
layout(binding=1) uniform texture2D light_tex;
layout(binding=0) uniform sampler canvas_smp;
layout(binding=0) uniform fs_params {
    vec2 texel_size;
    float threshold;
    float softness;
};

in vec2 uv;
out vec4 frag_color;

vec3 decode_normal(vec2 sample_uv) {
    return normalize(texture(sampler2D(normal_tex, canvas_smp), sample_uv).rgb * 2.0 - 1.0);
}

void main() {
    vec3 center = decode_normal(uv);
    float discontinuity = 0.0;
    discontinuity = max(discontinuity, 1.0 - dot(center, decode_normal(uv + vec2(texel_size.x, 0.0))));
    discontinuity = max(discontinuity, 1.0 - dot(center, decode_normal(uv - vec2(texel_size.x, 0.0))));
    discontinuity = max(discontinuity, 1.0 - dot(center, decode_normal(uv + vec2(0.0, texel_size.y))));
    discontinuity = max(discontinuity, 1.0 - dot(center, decode_normal(uv - vec2(0.0, texel_size.y))));

    float edge = smoothstep(threshold, threshold + softness, discontinuity);
    vec3 direct_light = texture(sampler2D(light_tex, canvas_smp), uv).rgb;
    frag_color = vec4(direct_light * edge, 0.0);
}
@end

@program tile_edge vs_tile_edge fs_tile_edge
