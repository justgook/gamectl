@module light_shadow
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32

@vs vs_light_base
@msl_options fixup_clipspace
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 light_pos;
    float shadow_softness;
};

in vec2 pos;
in vec4 inst_pos;

out float transverse_distance;
out float light_distance;
out float softness;

void main() {
    // inst_pos stores the line's two endpoints: xy and zw. Use pos.x to
    // select the matching endpoint for each side of the quad.
    vec2 pos_in_px = pos.x < 0.0 ? inst_pos.xy : inst_pos.zw;
    vec2 dis = pos_in_px - light_pos;
    float distance_squared = max(dot(dis, dis), 0.0001);
    const float SHADOW_LENGTH = 100000.0;
    float side = pos.x + 0.5;

    if (pos.y > 0.0) {
        pos_in_px += dis * inversesqrt(distance_squared) * SHADOW_LENGTH;
        transverse_distance = side;
        light_distance = 1.0;
    } else {
        light_distance = sqrt(distance_squared) / SHADOW_LENGTH;
        transverse_distance = mix(0.5, side, light_distance);
    }

    softness = shadow_softness;
    gl_Position = ortho * vec4(pos_in_px, 0.0, 1.0);
}
@end

@fs fs_light_base

in float transverse_distance;
in float light_distance;
in float softness;

out vec4 frag_color;

void main() {
    float shadow_strength = 1.0;
    if (softness > 0.0) {
        float distance_from_center = abs(transverse_distance - 0.5) * 2.0;
        float penumbra = 1.0 - distance_from_center / max(light_distance, 0.0001);
        shadow_strength = clamp(penumbra / softness, 0.0, 1.0);
    }

    // The shadow pipeline writes only alpha. RGB in the light canvas is
    // preserved while alpha marks pixels blocked from the current light.
    // MAX blending combines overlapping caster masks without allowing a
    // weak penumbra to erase or over-darken an existing stronger shadow.
    frag_color = vec4(0.0, 0.0, 0.0, shadow_strength);
}
@end

@program light_shadow vs_light_base fs_light_base
