@module light_shadow
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32


@vs vs_light_base
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 viewport_size;
    vec2 u_pos;
};


in vec2 pos;
in vec4 inst_pos;

void main() {
    // inst_pos stores the line's two endpoints: xy and zw. Use pos.x to
    // select the matching endpoint for each side of the quad.
    vec2 pos_in_px = pos.x < 0.0 ? inst_pos.xy : inst_pos.zw;

    // Offset the +Y row downward. Using the -Y row here reverses the base
    // quad's winding after the orthographic Y flip, so back-face culling
    // removes the entire shadow quad.
    if (pos.y > 0.0) {
      vec2 dis = pos_in_px - u_pos;
        // pos_in_px.y += 16.0;
      pos_in_px += dis/sqrt(dis.x*dis.x+dis.y*dis.y) * 100000;
    }

    gl_Position = ortho * vec4(pos_in_px, 0.0, 1.0);
}
@end

@fs fs_light_base

out vec4 frag_color;

void main() {
    frag_color = vec4(1,0,1,1);
}
@end

@program light_shadow vs_light_base fs_light_base

