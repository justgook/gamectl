@module light_shadow
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32

@vs vs_light_base
@msl_options fixup_clipspace
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 light_pos;
};

in vec2 pos;
in vec4 inst_pos;

void main() {
    // inst_pos stores the line's two endpoints: xy and zw. Use pos.x to
    // select the matching endpoint for each side of the quad.
    vec2 pos_in_px = pos.x < 0.0 ? inst_pos.xy : inst_pos.zw;

    if (pos.y > 0.0) {
        vec2 dis = pos_in_px - light_pos;
        float distance_squared = max(dot(dis, dis), 0.0001);
        pos_in_px += dis * inversesqrt(distance_squared) * 100000.0;
    }

    gl_Position = ortho * vec4(pos_in_px, 0.0, 1.0);
}
@end

@fs fs_light_base

out vec4 frag_color;

void main() {
    // The shadow pipeline writes only alpha. RGB in the light canvas is
    // preserved while alpha marks pixels blocked from the current light.
    frag_color = vec4(0.0, 0.0, 0.0, 1.0);
}
@end

@program light_shadow vs_light_base fs_light_base
