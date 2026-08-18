@module bloom
@header package world
@header import sg "../sokol/gfx"

@vs vs_bloom
@glsl_options flip_vert_y
in vec2 pos;
out vec2 uv;

void main() {
    gl_Position = vec4(pos * 2.0, 0.0, 1.0);
    uv = pos + vec2(0.5);
    uv.y = 1.0 - uv.y;
}
@end

@fs fs_bloom
layout(binding=0) uniform texture2D light_tex;
layout(binding=0) uniform sampler light_smp;
layout(binding=0) uniform fs_params {
    vec2 texel_size;
    float threshold;
    float knee;
};

in vec2 uv;
out vec4 frag_color;

float gaussian_weight(int offset) {
    int distance = abs(offset);
    if (distance == 0) return 6.0;
    if (distance == 1) return 4.0;
    return 1.0;
}

vec3 extract_bright(vec3 color) {
    float brightness = max(max(color.r, color.g), color.b);
    float soft = clamp(brightness - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 0.0001);
    float contribution = max(brightness - threshold, soft) / max(brightness, 0.0001);
    return color * contribution;
}

void main() {
    vec3 bloom = vec3(0.0);
    float total_weight = 0.0;
    for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
            float weight = gaussian_weight(x) * gaussian_weight(y);
            vec2 sample_uv = uv + vec2(float(x), float(y)) * texel_size;
            vec3 direct_light = texture(sampler2D(light_tex, light_smp), sample_uv).rgb;
            bloom += extract_bright(direct_light) * weight;
            total_weight += weight;
        }
    }
    frag_color = vec4(bloom / total_weight, 0.0);
}
@end

@program bloom vs_bloom fs_bloom
