@module light_composite
@header package world
@header import sg "../sokol/gfx"

@vs vs_light_composite
@glsl_options flip_vert_y
in vec2 pos;
out vec2 uv;

void main() {
    gl_Position = vec4(pos * 2.0, 0.0, 1.0);
    uv = pos + vec2(0.5);
    uv.y = 1.0 - uv.y;
}
@end

@fs fs_light_composite
layout(binding=0) uniform texture2D color_tex;
layout(binding=1) uniform texture2D light_tex;
layout(binding=0) uniform sampler canvas_smp;
layout(binding=0) uniform fs_params {
    float ambient;
};

in vec2 uv;
out vec4 frag_color;

void main() {
    vec4 color = texture(sampler2D(color_tex, canvas_smp), uv);
    vec3 light = texture(sampler2D(light_tex, canvas_smp), uv).rgb;
    vec3 illumination = vec3(ambient) + (1.0 - ambient) * light;
    frag_color = vec4(color.rgb * illumination, color.a);
}
@end

@program light_composite vs_light_composite fs_light_composite
