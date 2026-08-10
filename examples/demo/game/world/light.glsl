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
    float depth;
};


in vec2 pos;

out vec2 frag_screen_pos;
out vec2 light_screen_pos;
out vec4 color;

void main() {
    // Your vertices are -0.5 .. +0.5.
    // Convert to fullscreen NDC: -1 .. +1.
    vec2 ndc = pos * 2.0;

    gl_Position = vec4(ndc, depth, 1.0);

    // Convert fullscreen vertex position from NDC to pixels.
    frag_screen_pos = (ndc * 0.5 + 0.5) * viewport_size;

    // Transform world-space light position through camera.
    vec4 light_clip = ortho * vec4(light_pos, 0.0, 1.0);
    vec2 light_ndc = light_clip.xy / light_clip.w;

    // Convert light position to pixels too.
    light_screen_pos = (light_ndc * 0.5 + 0.5) * viewport_size;

    color = light_color;
}
@end

@fs fs_light_base

in vec2 frag_screen_pos;
in vec2 light_screen_pos;
in vec4 color;

out vec4 frag_color;

void main() {
    float radius = 128.0;
    float dist = distance(frag_screen_pos, light_screen_pos);
    float strength = 1.0 - smoothstep(0.0, radius, dist);
    strength *= strength;

    frag_color = vec4(color.rgb * strength, 0.0);
}

@end

@program light vs_light_base fs_light_base

