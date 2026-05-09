package must

func Must0(err error) {
	if err != nil {
		panic(err)
	}
}

func Must[T any](x T, err error) T {
	if err != nil {
		panic(err)
	}

	return x
}

func Must2[T1 any, T2 any](obj1 T1, obj2 T2, err error) (T1, T2) {
	if err != nil {
		panic(err)
	}

	return obj1, obj2
}
