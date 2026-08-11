@module light
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32

@vs vs_light_base
@msl_options fixup_clipspace
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 viewport_size;
    vec2 light_pos;
    vec4 light_color;
    float light_radius;
};

in vec2 pos;

out vec2 frag_screen_pos;
out vec2 light_screen_pos;
out vec4 color;
out float radius;

void main() {
    vec4 light_clip = ortho * vec4(light_pos, 0.0, 1.0);
    vec2 light_ndc = light_clip.xy / light_clip.w;
    light_screen_pos = (light_ndc * 0.5 + 0.5) * viewport_size;

    // Expand the base quad to a conservative screen-space bounding box.
    // The extra pixel guarantees that every scissored shadow-mask pixel is
    // covered and reset even when the light position is fractional.
    float bounds_radius = light_radius + 1.0;
    frag_screen_pos = light_screen_pos + pos * (bounds_radius * 2.0);
    vec2 vertex_ndc = frag_screen_pos / viewport_size * 2.0 - 1.0;
    gl_Position = vec4(vertex_ndc, 0.0, 1.0);

    color = light_color;
    radius = light_radius;
}
@end

@fs fs_light_base

in vec2 frag_screen_pos;
in vec2 light_screen_pos;
in vec4 color;
in float radius;

out vec4 frag_color;

void main() {
    float dist = distance(frag_screen_pos, light_screen_pos);
    float strength = 1.0 - smoothstep(0.0, radius, dist);
    strength *= strength;

    // RGB is accumulated into the light canvas. Alpha is zero so the
    // blend state resets the current light's shadow mask.
    frag_color = vec4(color.rgb * strength, 0.0);
}
@end

@program light vs_light_base fs_light_base
