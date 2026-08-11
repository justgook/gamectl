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
    float direction_radians;
    float inner_fov_radians;
    float outer_fov_radians;
};

in vec2 pos;

out vec2 frag_screen_pos;
out vec2 light_screen_pos;
out vec4 color;
out float radius;
out float direction;
out float inner_fov;
out float outer_fov;

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
    direction = direction_radians;
    inner_fov = inner_fov_radians;
    outer_fov = outer_fov_radians;
}
@end

@fs fs_light_base

in vec2 frag_screen_pos;
in vec2 light_screen_pos;
in vec4 color;
in float radius;
in float direction;
in float inner_fov;
in float outer_fov;

out vec4 frag_color;

void main() {
    vec2 light_to_fragment = frag_screen_pos - light_screen_pos;
    float distance_squared = dot(light_to_fragment, light_to_fragment);
    float dist = sqrt(distance_squared);
    float radial_strength = 1.0 - smoothstep(0.0, radius, dist);
    radial_strength *= radial_strength;

    float angular_strength = 1.0;
    const float TAU = 6.283185307179586;
    if (outer_fov < TAU) {
        vec2 light_direction = vec2(cos(direction), sin(direction));
        vec2 fragment_direction = distance_squared > 0.0
            ? light_to_fragment * inversesqrt(distance_squared)
            : light_direction;
        float alignment = dot(light_direction, fragment_direction);
        angular_strength = smoothstep(
            cos(outer_fov * 0.5),
            cos(inner_fov * 0.5),
            alignment
        );
    }

    float strength = radial_strength * angular_strength;

    // RGB is accumulated into the light canvas. Alpha is zero so the
    // blend state resets the current light's shadow mask.
    frag_color = vec4(color.rgb * strength, 0.0);
}
@end

@program light vs_light_base fs_light_base
