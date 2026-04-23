package lua

// import jsmn "jsmn"
import "pdk"

@(export)
init :: proc() -> u32 {
	err := "Hello world"
	ok := false

	if !ok {
		return respond_error(err)
	}

	return respond_ok("ok")
}

respond_ok :: proc(msg: string) -> u32 {
	pdk.output_string(msg)

	return 0
}

respond_error :: proc(msg: string) -> u32 {

	pdk.output_string(msg)
	return 1
}
