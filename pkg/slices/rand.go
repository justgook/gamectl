package slices

func Rand[T any](slice []T, position float32) T {
	if len(slice) == 0 {
		panic("slice is empty")
	}

	if position <= 0 {
		return slice[0]
	}

	if position >= 1 {
		return slice[len(slice)-1]
	}

	idx := int(position*float32(len(slice)-1) + 0.5)

	return slice[idx]
}

func PopAt[T any](slice []T, position float32) (T, []T) {
	var zero T
	if len(slice) == 0 {
		return zero, slice
	}

	if position < 0 {
		position = 0
	}

	if position > 1 {
		position = 1
	}

	idx := int(position*float32(len(slice)-1) + 0.5)
	if idx >= len(slice) {
		idx = len(slice) - 1
	}

	item := slice[idx]

	copy(slice[idx:], slice[idx+1:])

	return item, slice[:len(slice)-1]
}
