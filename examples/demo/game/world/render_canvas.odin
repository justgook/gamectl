package world

import sg "../sokol/gfx"

Render_Canvas :: struct {
	image:            sg.Image,
	color_attachment: sg.View,
	texture:          sg.View,
	depth_image:      sg.Image,
	depth_attachment: sg.View,
	pass:             sg.Pass,
}

render_canvas_init :: proc(
	clear_color: [4]f32,
	with_depth: bool,
	pixel_format: sg.Pixel_Format = .DEFAULT,
) -> Render_Canvas {
	canvas: Render_Canvas
	canvas.image = sg.make_image(
		{
			usage = {color_attachment = true},
			width = GAME_RESOLUTION_WIDTH,
			height = GAME_RESOLUTION_HEIGHT,
			sample_count = OFFSCREEN_SAMPLE_COUNT,
			pixel_format = pixel_format,
		},
	)
	canvas.color_attachment = sg.make_view({color_attachment = {image = canvas.image}})
	canvas.texture = sg.make_view({texture = {image = canvas.image}})
	canvas.pass = {
		action = {
			colors = {
				0 = {
					load_action = .CLEAR,
					clear_value = {clear_color[0], clear_color[1], clear_color[2], clear_color[3]},
				},
			},
		},
		attachments = {colors = {0 = canvas.color_attachment}},
	}

	if with_depth {
		canvas.depth_image = sg.make_image(
			{
				usage = {depth_stencil_attachment = true},
				width = GAME_RESOLUTION_WIDTH,
				height = GAME_RESOLUTION_HEIGHT,
				sample_count = OFFSCREEN_SAMPLE_COUNT,
				pixel_format = .DEPTH_STENCIL,
			},
		)
		canvas.depth_attachment = sg.make_view({depth_stencil_attachment = {image = canvas.depth_image}})
		canvas.pass.attachments.depth_stencil = canvas.depth_attachment
		canvas.pass.action.depth = {
			load_action = .CLEAR,
			clear_value = 1.0,
		}
	}

	return canvas
}

render_canvas_cleanup :: proc(canvas: ^Render_Canvas) {
	if canvas.depth_attachment.id != 0 {
		sg.destroy_view(canvas.depth_attachment)
		sg.destroy_image(canvas.depth_image)
	}
	sg.destroy_view(canvas.texture)
	sg.destroy_view(canvas.color_attachment)
	sg.destroy_image(canvas.image)
	canvas^ = {}
}
