@module nine_patch
@header package world
@header import sg "../sokol/gfx"
@ctype mat4 matrix[4,4]f32

@vs vs
layout(binding=0) uniform vs_params {
    mat4 ortho;
};

in vec2 position;
in vec4 inst_bounds;
in vec4 inst_slices;
in vec2 inst_size;
in vec4 inst_uv;

out vec2 uv;
out vec2 frag_repeat;
out vec2 frag_repeat_part;
out vec2 frag_repeat_offset;
out vec2 patch_coord;

void main() {
    float bounds_width = inst_bounds.z - inst_bounds.x;
    float bounds_height = inst_bounds.w - inst_bounds.y;

    float left_corner_width = inst_slices.x;
    float top_corner_height = inst_slices.y;
    float right_corner_width = inst_size.x - inst_slices.z;
    float bottom_corner_height = inst_size.y - inst_slices.w;
    float middle_width = bounds_width - (left_corner_width + right_corner_width);
    float middle_height = bounds_height - (top_corner_height + bottom_corner_height);

    vec2 final_pos = vec2(0.0);
    uv = inst_uv.xy;
    frag_repeat = vec2(0.0);
    frag_repeat_part = vec2(0.0);
    frag_repeat_offset = vec2(0.0);

    float uv_width = inst_uv.z - inst_uv.x;
    float uv_height = inst_uv.w - inst_uv.y;

    frag_repeat_offset.x = inst_uv.x + uv_width * inst_slices.x / inst_size.x;
    frag_repeat_offset.y = inst_uv.y + uv_height * inst_slices.y / inst_size.y;

    frag_repeat_part.x =
        (inst_uv.x + uv_width * inst_slices.z / inst_size.x) -
        (inst_uv.x + uv_width * inst_slices.x / inst_size.x);
    frag_repeat_part.y =
        (inst_uv.y + uv_height * inst_slices.w / inst_size.y) -
        (inst_uv.y + uv_height * inst_slices.y / inst_size.y);

    if (position.x == 1.0) {
        uv.x = inst_uv.x + uv_width * inst_slices.x / inst_size.x;
        final_pos.x = left_corner_width;
    } else if (position.x == 2.0) {
        frag_repeat.x = middle_width / (inst_slices.z - inst_slices.x) * frag_repeat_part.x;
        uv.x = inst_uv.x + uv_width * inst_slices.z / inst_size.x;
        final_pos.x = left_corner_width + middle_width;
    } else if (position.x == 3.0) {
        uv.x = inst_uv.z;
        final_pos.x = bounds_width;
    }

    if (position.y == 1.0) {
        uv.y = inst_uv.y + uv_height * inst_slices.y / inst_size.y;
        final_pos.y = top_corner_height;
    } else if (position.y == 2.0) {
        frag_repeat.y = middle_height / (inst_slices.w - inst_slices.y) * frag_repeat_part.y;
        uv.y = inst_uv.y + uv_height * inst_slices.w / inst_size.y;
        final_pos.y = top_corner_height + middle_height;
    } else if (position.y == 3.0) {
        uv.y = inst_uv.w;
        final_pos.y = bounds_height;
    }

    final_pos += inst_bounds.xy;
    gl_Position = ortho * vec4(final_pos, 0.0, 1.0);
    patch_coord = position;
}
@end

@fs fs
layout(binding=0) uniform texture2D tex0;
layout(binding=0) uniform sampler smp;

in vec2 uv;
in vec2 frag_repeat;
in vec2 frag_repeat_part;
in vec2 frag_repeat_offset;
in vec2 patch_coord;

out vec4 frag_color;

void main() {
    vec2 uv2 = uv;
    frag_color = texture(sampler2D(tex0, smp), uv2);
    frag_color.a = 1.0;

    if (patch_coord.x > 1.0 && patch_coord.x < 2.0) {
        uv2.x = frag_repeat_offset.x + mod(frag_repeat.x, frag_repeat_part.x);
        frag_color = texture(sampler2D(tex0, smp), uv2);
    }
    if (patch_coord.y > 1.0 && patch_coord.y < 2.0) {
        uv2.y = frag_repeat_offset.y + mod(frag_repeat.y, frag_repeat_part.y);
        frag_color = texture(sampler2D(tex0, smp), uv2);
    }
}
@end

@program nine_patch vs fs
