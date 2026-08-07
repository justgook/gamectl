@module light
@header package world
@header import sg "../sokol/gfx"

@ctype mat4 matrix[4,4]f32


@vs vs_light_base
layout(binding=0) uniform vs_params {
    mat4 ortho;
    vec2 viewport_size;
};


in vec2 pos;
in vec2 inst_pos;
in vec4 inst_color;

out vec2 frag_screen_pos;
out vec2 light_screen_pos;
out vec4 color;

void main() {
    // float inst_z = 0.0;
    // vec2 pos_in_px = pos * inst_size + inst_pos;
    // gl_Position = ortho * vec4(pos_in_px, inst_z, 1.0);
    // color = inst_color;

  // new stuff
    // Your vertices are -0.5 .. +0.5.
    // Convert to fullscreen NDC: -1 .. +1.
    vec2 ndc = pos * 2.0;

    gl_Position = vec4(ndc, 0.0, 1.0);

    // Convert fullscreen vertex position from NDC to pixels.
    frag_screen_pos = (ndc * 0.5 + 0.5) * viewport_size;

    // Transform world-space light position through camera.
    vec4 light_clip = ortho * vec4(inst_pos, 0.0, 1.0);
    vec2 light_ndc = light_clip.xy / light_clip.w;

    // Convert light position to pixels too.
    light_screen_pos = (light_ndc * 0.5 + 0.5) * viewport_size;

    color = inst_color;
}
@end

@fs fs_light_base

in vec2 frag_screen_pos;
in vec2 light_screen_pos;
in vec4 color;

out vec4 frag_color;
const float zz = 32.;

void main() {
    float radius = 128.0; // pixels
    float dist = distance(frag_screen_pos, light_screen_pos);
    float strength = 1.0 - smoothstep(0.0, radius, dist);

    // nicer falloff
    strength *= strength;

    frag_color = vec4(color.rgb * strength, strength);

/// TUTORIAL REMAP
  vec2 pos = frag_screen_pos;
  vec2 u_pos = light_screen_pos;

/// TUTORIAL PART
  vec2 dis = pos - u_pos;
  float str = 1./(sqrt(dis.x*dis.x + dis.y*dis.y + zz*zz) - zz);
  frag_color = vec4(vec3(str),1.);

}

@end

@program light vs_light_base fs_light_base

