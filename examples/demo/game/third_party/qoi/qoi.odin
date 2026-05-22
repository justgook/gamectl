package qoi

Image :: struct {
	width:    int,
	height:   int,
	pixels:   []u8,
}

add_u8 :: proc(v: u8, delta: int) -> u8 {
	return u8((int(v) + delta) & 0xFF)
}

read_u32be :: proc(data: []u8, offset: int) -> u32 {
	return u32(data[offset]) << 24 |
		u32(data[offset + 1]) << 16 |
		u32(data[offset + 2]) << 8 |
		u32(data[offset + 3])
}

hash_pixel :: proc(pixel: [4]u8) -> int {
	return int((pixel[0] * 3 + pixel[1] * 5 + pixel[2] * 7 + pixel[3] * 11) % 64)
}

decode_to_buffer :: proc(data: []u8, pixels: []u8) -> (width, height: int, decoded: []u8, ok: bool) {
	if len(data) < 14 + 8 {
		return 0, 0, nil, false
	}
	if string(data[:4]) != "qoif" {
		return 0, 0, nil, false
	}

	decoded_width := int(read_u32be(data, 4))
	decoded_height := int(read_u32be(data, 8))
	channels := int(data[12])
	if decoded_width <= 0 || decoded_height <= 0 || (channels != 3 && channels != 4) {
		return 0, 0, nil, false
	}
	out_len := decoded_width * decoded_height * 4
	if len(pixels) < out_len {
		return 0, 0, nil, false
	}
	out := pixels[:out_len]

	index: [64][4]u8
	pix := [4]u8{0, 0, 0, 255}
	read_pos := 14
	write_pos := 0
	total_pixels := decoded_width * decoded_height
	written_pixels := 0

	for written_pixels < total_pixels {
		if read_pos >= len(data) {
			return 0, 0, nil, false
		}
		b1 := data[read_pos]
		read_pos += 1

		if b1 == 0xFE {
			if read_pos + 2 >= len(data) {
				return 0, 0, nil, false
			}
			pix[0] = data[read_pos]
			pix[1] = data[read_pos + 1]
			pix[2] = data[read_pos + 2]
			read_pos += 3
			index[hash_pixel(pix)] = pix
		} else if b1 == 0xFF {
			if read_pos + 3 >= len(data) {
				return 0, 0, nil, false
			}
			pix[0] = data[read_pos]
			pix[1] = data[read_pos + 1]
			pix[2] = data[read_pos + 2]
			pix[3] = data[read_pos + 3]
			read_pos += 4
			index[hash_pixel(pix)] = pix
		} else {
			tag := b1 >> 6
			switch tag {
			case 0:
				pix = index[b1 & 0x3F]
			case 1:
				pix[0] = add_u8(pix[0], int((b1 >> 4) & 0x03) - 2)
				pix[1] = add_u8(pix[1], int((b1 >> 2) & 0x03) - 2)
				pix[2] = add_u8(pix[2], int(b1 & 0x03) - 2)
				index[hash_pixel(pix)] = pix
			case 2:
				if read_pos >= len(data) {
					return 0, 0, nil, false
				}
				b2 := data[read_pos]
				read_pos += 1
				dg := int(b1 & 0x3F) - 32
				pix[0] = add_u8(pix[0], dg + int((b2 >> 4) & 0x0F) - 8)
				pix[1] = add_u8(pix[1], dg)
				pix[2] = add_u8(pix[2], dg + int(b2 & 0x0F) - 8)
				index[hash_pixel(pix)] = pix
			case 3:
				run := int(b1 & 0x3F) + 1
				if written_pixels + run > total_pixels {
					return 0, 0, nil, false
				}
				for _ in 0..<run {
					copy(out[write_pos:write_pos + 4], pix[:])
					write_pos += 4
					written_pixels += 1
				}
				continue
			case:
				return 0, 0, nil, false
			}
		}

		copy(out[write_pos:write_pos + 4], pix[:])
		write_pos += 4
		written_pixels += 1
	}

	return decoded_width, decoded_height, out, true
}

load_from_bytes :: proc(data: []u8, allocator := context.allocator) -> (^Image, bool) {
	if len(data) < 14 + 8 {
		return nil, false
	}
	width := int(read_u32be(data, 4))
	height := int(read_u32be(data, 8))
	out := make([]u8, width * height * 4, allocator)
	decoded_w, decoded_h, decoded, ok := decode_to_buffer(data, out)
	if !ok {
		return nil, false
	}
	img := new(Image, allocator)
	img.width = decoded_w
	img.height = decoded_h
	img.pixels = decoded
	return img, true
}
